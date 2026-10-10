/**
 * invoice.generator.js — Renders an order into a premium A4 invoice PDF.
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

// A4 portrait, generous margins, clean white page background.
const PAGE = { size: 'A4', margin: 50 };

// Premium fragrance-inspired palette.
const COLORS = {
    brown: '#3D2914',
    softText: '#6B5A44',
    muted: '#9A8B74',
    gold: '#B8955A',
    rule: '#E4D8C3',
    beige: '#F3E8D7',
    ivory: '#FCFBF9',
    goldSoft: '#E7D9BE',
    zebra: '#F8F3EA',
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

            const invoiceNo = invoiceNumberFor(order.orderNumber);
            const dateText = formatOrderDate(order.orderDate);

            // ── Header: logo + brand wordmark left, INVOICE block right ──
            const logo = resolveLogo();
            let logoBottom = y;
            if (logo) {
                try {
                    doc.image(logo, left, y, { fit: [120, 44], valign: 'top' });
                    logoBottom = y + 48;
                } catch {
                    // A corrupt/unsupported image must never break the invoice.
                    logoBottom = y + 40;
                }
                doc.font(fonts.bold).fontSize(13).fillColor(COLORS.brown)
                    .text(BRAND_NAME, left, logoBottom);
                doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted)
                    .text('Premium Fragrances', left, logoBottom + 17, { characterSpacing: 2 });
                logoBottom += 30;
            } else {
                doc.font(fonts.bold).fontSize(18).fillColor(COLORS.brown)
                    .text(BRAND_NAME, left, y + 4);
                doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted)
                    .text('PREMIUM FRAGRANCES', left, y + 28, { characterSpacing: 2 });
                logoBottom = y + 44;
            }

            const titleW = 250;
            const titleX = right - titleW;
            doc.font(fonts.bold).fontSize(28).fillColor(COLORS.brown)
                .text('INVOICE', titleX, y + 2, { width: titleW, align: 'right', characterSpacing: 6 });
            doc.font(fonts.regular).fontSize(9.5).fillColor(COLORS.softText)
                .text(invoiceNo, titleX, y + 38, { width: titleW, align: 'right' });
            doc.font(fonts.regular).fontSize(9).fillColor(COLORS.muted)
                .text(`Invoice date: ${dateText}`, titleX, y + 53, { width: titleW, align: 'right' });

            y = Math.max(logoBottom, y + 70) + 10;
            doc.moveTo(left, y).lineTo(right, y).strokeColor(COLORS.gold).lineWidth(2).stroke();
            y += 3;
            doc.moveTo(left, y).lineTo(right, y).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
            y += 16;

            // ── Bill-to card (lightly shaded) + order meta ──
            const colGap = 24;
            const colWidth = (contentWidth - colGap) / 2;
            const cardPad = 14;

            doc.font(fonts.bold).fontSize(9).fillColor(COLORS.gold)
                .text('BILL TO', left, y, { characterSpacing: 2 });
            y += 16;

            // Collect card lines first so the shaded box fits wrapped text.
            const customerName = order.customerName || order.contactName || 'Customer';
            const cardLines = [{ text: customerName, bold: true, size: 11 }];
            const phone = order.customerPhone || order.contactPhone || '';
            if (phone) cardLines.push({ text: phone, bold: false, size: 9.5 });
            const email = order.customerEmail || '';
            if (email) cardLines.push({ text: email, bold: false, size: 9.5 });
            for (const line of addressLines(order.shippingAddress)) {
                cardLines.push({ text: line, bold: false, size: 9.5 });
            }
            let cardHeight = cardPad * 2;
            for (const line of cardLines) {
                cardHeight += doc.heightOfString(line.text, { width: colWidth - cardPad * 2, font: line.bold ? fonts.bold : fonts.regular, size: line.size }) + 4;
            }

            const cardTop = y;
            doc.save();
            doc.roundedRect(left, cardTop, colWidth, cardHeight, 6).fill(COLORS.beige);
            // Thin gold spine on the card's left edge.
            doc.roundedRect(left, cardTop, 4, cardHeight, 2).fill(COLORS.gold);
            doc.restore();

            let cardY = cardTop + cardPad;
            for (const line of cardLines) {
                doc.font(line.bold ? fonts.bold : fonts.regular).fontSize(line.size).fillColor(COLORS.brown)
                    .text(line.text, left + cardPad, cardY, { width: colWidth - cardPad * 2 });
                cardY += doc.heightOfString(line.text, { width: colWidth - cardPad * 2 }) + 4;
            }

            const cardBottom = cardTop + cardHeight;

            // ── Right column: order details + subtle status badges ──
            const rx = left + colWidth + colGap;
            let my = y - 16;
            doc.font(fonts.bold).fontSize(9).fillColor(COLORS.gold)
                .text('ORDER DETAILS', rx, my, { characterSpacing: 2 });
            my += 18;
            const meta = [
                ['Order no.', String(order.orderNumber || '—')],
                ['Invoice no.', invoiceNo],
                ['Order date', dateText],
            ];
            for (const [label, value] of meta) {
                doc.font(fonts.regular).fontSize(9).fillColor(COLORS.softText)
                    .text(label, rx, my, { width: colWidth * 0.52 });
                doc.font(fonts.bold).fontSize(9).fillColor(COLORS.brown)
                    .text(value, rx + colWidth * 0.52, my, { width: colWidth * 0.48, align: 'right' });
                my += 18;
            }

            my += 4;
            for (const [label, value] of [
                ['Order status', statusLabel(order.status)],
                ['Payment status', statusLabel(order.paymentStatus)],
            ]) {
                doc.font(fonts.regular).fontSize(9).fillColor(COLORS.softText)
                    .text(label, rx, my, { width: colWidth * 0.5 });
                // Subtle text badge: ivory pill with a hairline gold outline.
                const badgeText = String(value).toUpperCase();
                const badgeW = Math.min(
                    colWidth * 0.5,
                    doc.widthOfString(badgeText, { font: fonts.bold, size: 8.5 }) + 20
                );
                const badgeX = rx + colWidth - badgeW;
                doc.save();
                doc.roundedRect(badgeX, my - 5, badgeW, 21, 10).fill(COLORS.ivory);
                doc.roundedRect(badgeX, my - 5, badgeW, 21, 10).strokeColor(COLORS.goldSoft).lineWidth(0.75).stroke();
                doc.restore();
                doc.font(fonts.bold).fontSize(8.5).fillColor(COLORS.brown)
                    .text(badgeText, badgeX, my + 1, { width: badgeW, align: 'center' });
                my += 29;
            }

            y = Math.max(cardBottom, my) + 20;

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

// Column layout for the items table: item (name + size sub-line) | qty | unit price | total.
const QTY_W = 52;
const PRICE_W = 104;
const TOTAL_W = 108;

function drawItemsTable(doc, { fonts, order, left, right, contentWidth, cursor }) {
    const productW = contentWidth - QTY_W - PRICE_W - TOTAL_W;
    const xQty = left + productW;
    const xPrice = xQty + QTY_W;
    const xTotal = xPrice + PRICE_W;

    function drawHeader() {
        doc.save();
        doc.roundedRect(left, cursor.y, contentWidth, 32, 4).fill(COLORS.brown);
        doc.restore();
        doc.font(fonts.bold).fontSize(9).fillColor('#FFFFFF');
        const headY = cursor.y + 9;
        doc.text('ITEM', left + 10, headY, { width: productW - 14, characterSpacing: 1 });
        doc.font(fonts.regular).fontSize(7.5).fillColor(COLORS.goldSoft)
            .text('SIZE', left + 10, headY + 11, { width: productW - 14, characterSpacing: 1 });
        doc.font(fonts.bold).fontSize(9).fillColor('#FFFFFF');
        doc.text('QTY', xQty, headY, { width: QTY_W - 8, align: 'center', characterSpacing: 1 });
        doc.text('UNIT PRICE', xPrice, headY, { width: PRICE_W - 8, align: 'right', characterSpacing: 1 });
        doc.text('TOTAL', xTotal, headY, { width: TOTAL_W - 10, align: 'right', characterSpacing: 1 });
        cursor.y += 32;
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
        const itemLabel = item.size
            ? `${item.productName || ''}`
            : (item.productName || '');
        const nameHeight = doc.heightOfString(itemLabel, { width: productW - 14 });
        const sizeHeight = item.size
            ? doc.heightOfString(String(item.size), { width: productW - 14, size: 8.5 }) + 2
            : 0;
        const rowHeight = Math.max(nameHeight + sizeHeight, 16) + 14;

        ensureSpace(rowHeight);
        if (index % 2 === 1) {
            doc.save();
            doc.rect(left, cursor.y, contentWidth, rowHeight).fill(COLORS.zebra);
            doc.restore();
        }

        const textY = cursor.y + 7;
        doc.font(fonts.bold).fontSize(10).fillColor(COLORS.brown)
            .text(item.productName || '', left + 10, textY, { width: productW - 14 });
        let subY = textY + doc.heightOfString(item.productName || '', { width: productW - 14 });
        if (item.size) {
            doc.font(fonts.regular).fontSize(8.5).fillColor(COLORS.softText)
                .text(String(item.size), left + 10, subY + 1, { width: productW - 14 });
        }
        doc.font(fonts.regular).fontSize(10).fillColor(COLORS.brown)
            .text(String(item.quantity), xQty, textY, { width: QTY_W - 8, align: 'center' });
        doc.text(formatINR(item.unitPrice), xPrice, textY, { width: PRICE_W - 8, align: 'right' });
        doc.font(fonts.bold).fontSize(10).fillColor(COLORS.brown)
            .text(formatINR(item.lineTotal), xTotal, textY, { width: TOTAL_W - 10, align: 'right' });

        cursor.y += rowHeight;
        doc.moveTo(left, cursor.y).lineTo(right, cursor.y).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
    });
}

function drawTotalsAndFooter(doc, { fonts, order, left, right, contentWidth, cursor }) {
    cursor.y += 18;
    // Keep the whole summary together — push to a fresh page if it won't fit.
    const summaryHeight = 24 * 3 + 44 + 20;
    if (cursor.y + summaryHeight > doc.page.height - PAGE.margin - 70) {
        doc.addPage({ size: PAGE.size, margin: PAGE.margin });
        cursor.y = PAGE.margin;
    }

    const totalsWidth = 272;
    const totalsX = right - totalsWidth;
    const rows = [['Subtotal', formatINR(order.subtotal)]];
    // Only show a discount line when the order data actually carries one.
    const discount = Number(order.discount);
    if (Number.isFinite(discount) && discount > 0) {
        rows.push(['Discount', `− ${formatINR(discount)}`]);
    }
    rows.push(['Shipping', Number(order.shipping) === 0 ? 'Free' : formatINR(order.shipping)]);
    for (const [label, value] of rows) {
        doc.font(fonts.regular).fontSize(10).fillColor(COLORS.softText)
            .text(label, totalsX, cursor.y, { width: totalsWidth - 110 });
        doc.font(fonts.regular).fontSize(10).fillColor(COLORS.brown)
            .text(value, totalsX + totalsWidth - 110, cursor.y, { width: 110, align: 'right' });
        cursor.y += 22;
    }

    cursor.y += 4;
    doc.save();
    doc.roundedRect(totalsX, cursor.y, totalsWidth, 38, 6).fill(COLORS.brown);
    doc.restore();
    doc.font(fonts.bold).fontSize(10).fillColor('#FFFFFF')
        .text('Amount Payable', totalsX + 14, cursor.y + 13, { width: totalsWidth - 134 });
    doc.font(fonts.bold).fontSize(14).fillColor(COLORS.gold)
        .text(formatINR(order.total), totalsX + totalsWidth - 124, cursor.y + 11, { width: 110, align: 'right' });
    cursor.y += 54;

    // Elegant footer, pinned near the bottom of the page.
    cursor.y = Math.max(cursor.y, doc.page.height - PAGE.margin - 70);
    doc.moveTo(left, cursor.y).lineTo(right, cursor.y).strokeColor(COLORS.goldSoft).lineWidth(0.75).stroke();
    cursor.y += 12;
    doc.font(fonts.bold).fontSize(11).fillColor(COLORS.brown)
        .text('Thank you for choosing MS Fragrances.', left, cursor.y, { width: contentWidth, align: 'center' });
    cursor.y += 18;
    doc.font(fonts.regular).fontSize(8).fillColor(COLORS.muted)
        .text(
            'This is a computer-generated invoice. Prices and totals are as recorded at the time of order.',
            left, cursor.y, { width: contentWidth, align: 'center' }
        );
}

export { generateInvoicePdf };


