/**
 * invoice.generator.js — Renders an order into a professional A4 invoice PDF.
 *
 * Uses PDFKit with a bundled Unicode font (DejaVu Sans) so the ₹ symbol and
 * other non-Latin-1 glyphs render correctly (PDFKit's built-in fonts use
 * WinAnsi encoding and cannot display ₹). The MS Fragrances logo is embedded
 * when the asset is present; generation never throws if it is missing.
 *
 * Input is a mapped order detail (the same shape returned by
 * GET /api/orders/:id) — totals, prices and customer details are already
 * server-authoritative, so this layer only lays them out. It never mutates the
 * order or recomputes money.
 */
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BRAND_NAME, invoiceNumberFor, formatINR, statusLabel } from './invoice.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAGE = { size: 'A4', margin: 48 };
const COLORS = {
    text: '#2b2724',
    muted: '#8f8883',
    accent: '#8e7a63',
    rule: '#e5e1da',
    band: '#f6f3ee',
    zebra: '#fbfaf8',
};

// DejaVu Sans ships with the npm dependency; resolve it relative to the module.
const FONT_DIR = path.join(__dirname, '../../../../node_modules/dejavu-fonts-ttf/ttf');
const FONT_REGULAR = path.join(FONT_DIR, 'DejaVuSans.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'DejaVuSans-Bold.ttf');

// Business logo, resolved from the frontend public assets (single source of
// truth for the brand mark). Absent in some deploy layouts — handled below.
const LOGO_CANDIDATES = [
    path.join(__dirname, '../../../../../public/ms-fragrance-logo.png'),
    path.join(__dirname, '../../../../../public/ms-fragrance-horizontal.jpg'),
];

function registerFonts(doc) {
    const regular = fs.existsSync(FONT_REGULAR) ? FONT_REGULAR : 'Helvetica';
    const bold = fs.existsSync(FONT_BOLD) ? FONT_BOLD : 'Helvetica-Bold';
    doc.registerFont('Body', regular);
    doc.registerFont('BodyBold', bold);
    return { regular: 'Body', bold: 'BodyBold' };
}

function resolveLogo() {
    for (const candidate of LOGO_CANDIDATES) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

/** Joins the non-empty parts of the delivery address into wrapped lines. */
function addressLines(address) {
    if (!address || typeof address !== 'object') return [];
    return [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
        .map((part) => (part ? String(part).trim() : ''))
        .filter(Boolean);
}

/** Format the order date as a short, locale-stable string. */
function formatOrderDate(iso) {
    const date = iso ? new Date(iso) : null;
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Generate the invoice PDF buffer for a mapped order detail.
 * @param {object} order - toAdminOrderDetail(orderRow) shape
 * @returns {Promise<Buffer>} A valid PDF document
 */
function generateInvoicePdf(order) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: PAGE.size,
                margin: PAGE.margin,
                info: { Title: `MS Fragrances Invoice ${order.orderNumber}`, Author: BRAND_NAME },
            });

            const fonts = registerFonts(doc);
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const left = PAGE.margin;
            const contentWidth = doc.page.width - PAGE.margin * 2;
            const right = doc.page.width - PAGE.margin;
            let y = PAGE.margin;

            // ── Header: logo + brand + invoice meta ──
            const logo = resolveLogo();
            let headerBottom = y;
            if (logo) {
                try {
                    doc.image(logo, left, y, { fit: [150, 60] });
                    headerBottom = y + 64;
                } catch {
                    // A corrupt/unsupported image must never break the invoice.
                    headerBottom = y + 20;
                }
            }

            const metaX = right - 230;
            const metaW = 230;
            doc.font(fonts.bold).fontSize(20).fillColor(COLORS.text)
                .text(BRAND_NAME, left, logo ? y + 34 : y);
            doc.font(fonts.regular).fontSize(10).fillColor(COLORS.muted)
                .text('INVOICE', metaX, y + 2, { width: metaW, align: 'right' });

            const invoiceNo = invoiceNumberFor(order.orderNumber);
            const dateText = formatOrderDate(order.orderDate);

            doc.font(fonts.bold).fontSize(11).fillColor(COLORS.text)
                .text(invoiceNo, metaX, y + 20, { width: metaW, align: 'right' });
            doc.font(fonts.regular).fontSize(9).fillColor(COLORS.muted)
                .text(`Date: ${dateText}`, metaX, y + 36, { width: metaW, align: 'right' });

            y = Math.max(headerBottom, y + 54);
            doc.moveTo(left, y).lineTo(right, y).strokeColor(COLORS.accent).lineWidth(1.5).stroke();
            y += 18;

            // ── Bill to + order/payment meta blocks ──
            const colGap = 24;
            const colWidth = (contentWidth - colGap) / 2;
            const blockTop = y;

            doc.font(fonts.bold).fontSize(9).fillColor(COLORS.accent)
                .text('BILL TO', left, blockTop, { width: colWidth });
            // doc.text() updates doc.y (and returns the doc, not a number), so we
            // advance by nudging doc.y down rather than reassigning it.
            doc.y = blockTop + 16;
            doc.font(fonts.bold).fontSize(11).fillColor(COLORS.text);
            const customerName = order.customerName || order.contactName || '';
            doc.text(customerName || 'Customer', left, doc.y, { width: colWidth });
            doc.y += 2;
            doc.font(fonts.regular).fontSize(10).fillColor(COLORS.text);
            const phone = order.customerPhone || order.contactPhone || '';
            if (phone) {
                doc.text(`Phone: ${phone}`, left, doc.y, { width: colWidth });
                doc.y += 1;
            }
            for (const line of addressLines(order.shippingAddress)) {
                doc.text(line, left, doc.y, { width: colWidth });
            }
            const cy = doc.y;

            const rx = left + colWidth + colGap;
            let my = blockTop;
            doc.font(fonts.bold).fontSize(9).fillColor(COLORS.accent)
                .text('ORDER', rx, my, { width: colWidth });
            my += 16;
            const meta = [
                ['Order number', order.orderNumber],
                ['Invoice number', invoiceNo],
                ['Order status', statusLabel(order.status)],
                ['Payment status', statusLabel(order.paymentStatus)],
            ];
            for (const [label, value] of meta) {
                doc.font(fonts.regular).fontSize(10).fillColor(COLORS.muted)
                    .text(label, rx, my, { width: colWidth * 0.55 });
                doc.font(fonts.bold).fontSize(10).fillColor(COLORS.text)
                    .text(String(value), rx + colWidth * 0.55, my, { width: colWidth * 0.45, align: 'right' });
                my += 16;
            }

            y = Math.max(cy, my) + 16;

            // A single mutable cursor threaded through the layout helpers keeps
            // the vertical position correct across the items table (which may
            // page-break) and the totals/footer.
            const cursor = { y };
            drawItemsTable(doc, { fonts, order, left, right, contentWidth, cursor });
            drawTotalsAndFooter(doc, { fonts, order, left, right, contentWidth, cursor });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// Column layout for the items table: product | size | qty | unit price | total.
const SIZE_W = 54;
const QTY_W = 40;
const PRICE_W = 92;
const TOTAL_W = 96;

function drawItemsTable(doc, { fonts, order, left, right, contentWidth, cursor }) {
    const productW = contentWidth - SIZE_W - QTY_W - PRICE_W - TOTAL_W;
    const xSize = left + productW;
    const xQty = xSize + SIZE_W;
    const xPrice = xQty + QTY_W;
    const xTotal = xPrice + PRICE_W;

    function drawHeader() {
        doc.rect(left, cursor.y, contentWidth, 24).fill(COLORS.band);
        doc.font(fonts.bold).fontSize(9).fillColor(COLORS.text);
        doc.text('Product', left + 8, cursor.y + 8, { width: productW - 12 });
        doc.text('Size', xSize, cursor.y + 8, { width: SIZE_W - 8, align: 'right' });
        doc.text('Qty', xQty, cursor.y + 8, { width: QTY_W - 8, align: 'right' });
        doc.text('Unit price', xPrice, cursor.y + 8, { width: PRICE_W - 8, align: 'right' });
        doc.text('Total', xTotal, cursor.y + 8, { width: TOTAL_W - 8, align: 'right' });
        cursor.y += 24;
    }

    // Reserve room for the totals block so a row never collides with it.
    function ensureSpace(needed) {
        if (cursor.y + needed > doc.page.height - PAGE.margin - 110) {
            doc.addPage({ size: PAGE.size, margin: PAGE.margin });
            cursor.y = PAGE.margin;
            drawHeader();
        }
    }

    drawHeader();
    const items = Array.isArray(order.items) ? order.items : [];
    items.forEach((item, index) => {
        doc.font(fonts.regular).fontSize(10);
        const nameHeight = doc.heightOfString(item.productName || '', { width: productW - 12 });
        const rowHeight = Math.max(nameHeight, 14) + 14;

        ensureSpace(rowHeight);
        if (index % 2 === 1) {
            doc.rect(left, cursor.y, contentWidth, rowHeight).fill(COLORS.zebra);
        }

        const textY = cursor.y + 7;
        doc.font(fonts.regular).fontSize(10).fillColor(COLORS.text)
            .text(item.productName || '', left + 8, textY, { width: productW - 12 });
        doc.text(item.size || '—', xSize, textY, { width: SIZE_W - 8, align: 'right' });
        doc.text(String(item.quantity), xQty, textY, { width: QTY_W - 8, align: 'right' });
        doc.text(formatINR(item.unitPrice), xPrice, textY, { width: PRICE_W - 8, align: 'right' });
        doc.font(fonts.bold).fontSize(10).fillColor(COLORS.text)
            .text(formatINR(item.lineTotal), xTotal, textY, { width: TOTAL_W - 8, align: 'right' });

        cursor.y += rowHeight;
        doc.moveTo(left, cursor.y).lineTo(right, cursor.y).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
    });
}

function drawTotalsAndFooter(doc, { fonts, order, left, right, contentWidth, cursor }) {
    cursor.y += 16;
    const totalsWidth = 260;
    const totalsX = right - totalsWidth;
    const totals = [
        ['Subtotal', formatINR(order.subtotal)],
        ['Shipping', Number(order.shipping) === 0 ? 'Free' : formatINR(order.shipping)],
    ];
    for (const [label, value] of totals) {
        doc.font(fonts.regular).fontSize(10).fillColor(COLORS.muted)
            .text(label, totalsX, cursor.y, { width: totalsWidth - 100 });
        doc.font(fonts.regular).fontSize(10).fillColor(COLORS.text)
            .text(value, totalsX + totalsWidth - 100, cursor.y, { width: 100, align: 'right' });
        cursor.y += 18;
    }

    cursor.y += 2;
    doc.rect(totalsX, cursor.y, totalsWidth, 30).fill(COLORS.band);
    doc.font(fonts.bold).fontSize(12).fillColor(COLORS.text)
        .text('Total', totalsX + 10, cursor.y + 9, { width: totalsWidth - 110 });
    doc.font(fonts.bold).fontSize(12).fillColor(COLORS.text)
        .text(formatINR(order.total), totalsX + totalsWidth - 110, cursor.y + 9, { width: 100, align: 'right' });
    cursor.y += 44;

    // Thank-you footer, pinned near the bottom of the page.
    cursor.y = Math.max(cursor.y, doc.page.height - PAGE.margin - 56);
    doc.moveTo(left, cursor.y).lineTo(right, cursor.y).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
    cursor.y += 10;
    doc.font(fonts.regular).fontSize(10).fillColor(COLORS.text)
        .text(`Thank you for shopping with ${BRAND_NAME}.`, left, cursor.y, { width: contentWidth, align: 'center' });
    cursor.y += 16;
    doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted)
        .text(
            'This is a computer-generated invoice. Prices and totals are as recorded at the time of order.',
            left, cursor.y, { width: contentWidth, align: 'center' }
        );
}

export { generateInvoicePdf };


