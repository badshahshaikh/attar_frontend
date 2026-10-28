import fs from 'node:fs';
import path from 'node:path';

const API_BASE = (process.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const DIST_DIR = path.resolve(process.cwd(), 'dist');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function buildHeadTags(data) {
  const tags = [];
  if (data.seo_title) {
    tags.push(`<title>${escapeHtml(data.seo_title)}</title>`);
  }
  if (data.meta_description) {
    tags.push(`<meta name="description" content="${escapeAttr(data.meta_description)}" />`);
  }
  if (data.robots) {
    tags.push(`<meta name="robots" content="${escapeAttr(data.robots)}" />`);
  }
  const canonical = data.canonical_url;
  if (canonical) {
    tags.push(`<link rel="canonical" href="${escapeAttr(canonical)}" />`);
  }
  const ogTitle = data.og_title || data.seo_title;
  if (ogTitle) tags.push(`<meta property="og:title" content="${escapeAttr(ogTitle)}" />`);
  const ogDesc = data.og_description || data.meta_description;
  if (ogDesc) tags.push(`<meta property="og:description" content="${escapeAttr(ogDesc)}" />`);
  if (data.og_image) tags.push(`<meta property="og:image" content="${escapeAttr(data.og_image)}" />`);
  if (canonical) tags.push(`<meta property="og:url" content="${escapeAttr(canonical)}" />`);
  tags.push(`<meta property="og:type" content="website" />`);
  const twCard = data.twitter_card || 'summary_large_image';
  tags.push(`<meta name="twitter:card" content="${escapeAttr(twCard)}" />`);
  const twTitle = data.twitter_title || data.seo_title;
  if (twTitle) tags.push(`<meta name="twitter:title" content="${escapeAttr(twTitle)}" />`);
  const twDesc = data.twitter_description || data.meta_description;
  if (twDesc) tags.push(`<meta name="twitter:description" content="${escapeAttr(twDesc)}" />`);
  const twImage = data.twitter_image || data.og_image;
  if (twImage) tags.push(`<meta name="twitter:image" content="${escapeAttr(twImage)}" />`);
  const sd = data.structured_data;
  const hasSd = sd && typeof sd === 'object' && !Array.isArray(sd) && Object.keys(sd).length > 0;
  if (hasSd) {
    tags.push(
      `<script type="application/ld+json" id="seo-jsonld">${JSON.stringify(sd)}</script>`
    );
  }
  return tags.join('\n    ');
}

function injectIntoTemplate(template, tags) {
  let html = template;
  // Replace existing <title>...</title>
  html = html.replace(/<title>[\s\S]*?<\/title>/i, tags.includes('<title>') ? '' : '$&');
  // Remove default title tag line if we inject our own (handled above by replacement)
  // Simpler: remove any existing title tag, then inject tags before </head>
  html = html.replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  html = html.replace(/<\/head>/i, `    ${tags}\n  </head>`);
  return html;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function getProducts() {
  try {
    const data = await fetchJson(`${API_BASE}/products?limit=100`);
    if (Array.isArray(data?.products)) return data.products;
    if (Array.isArray(data)) return data;
    return [];
  } catch (err) {
    console.warn('[prerender] Failed to fetch products:', err.message);
    return [];
  }
}

async function getSeo(route) {
  const encoded = encodeURIComponent(route);
  return fetchJson(`${API_BASE}/seo/public/${encoded}`);
}

async function prerenderRoute(route, template) {
  let data;
  try {
    data = await getSeo(route);
  } catch (err) {
    console.warn(`[prerender] Skipping ${route}: ${err.message}`);
    return false;
  }
  if (!data) return false;
  // Use route URL as default canonical if not provided by API
  if (!data.canonical_url) data.canonical_url = 'https://msfragrance.in' + route;
  const robots = String(data.robots || '');
  if (robots.toLowerCase().includes('noindex')) {
    console.log(`[prerender] Skipping non-indexable route: ${route}`);
    return false;
  }
  const tags = buildHeadTags(data);
  const html = injectIntoTemplate(template, tags);

  // Determine output path
  const clean = route === '/' ? '' : route.replace(/^\/+/, '');
  const outDir = clean ? path.join(DIST_DIR, clean) : DIST_DIR;
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'index.html');
  fs.writeFileSync(outFile, html, 'utf8');
  console.log(`[prerender] Wrote ${route} -> ${path.relative(DIST_DIR, outFile)}`);
  return true;
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('[prerender] dist/ not found. Run vite build first.');
    process.exit(1);
  }
  const templatePath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(templatePath)) {
    console.error('[prerender] dist/index.html not found.');
    process.exit(1);
  }
  const template = fs.readFileSync(templatePath, 'utf8');

  const coreRoutes = ['/', '/shop', '/collections', '/about'];
  const products = await getProducts();
  const productRoutes = products
    .map((p) => (p && p.id != null ? `/product/${p.id}` : null))
    .filter(Boolean);

  const routes = [...coreRoutes, ...productRoutes];
  console.log(`[prerender] Processing ${routes.length} routes (${coreRoutes.length} core + ${productRoutes.length} products)`);

  let success = 0;
  let skipped = 0;
  let coreSuccess = 0;
  for (const route of routes) {
    const ok = await prerenderRoute(route, template);
    if (ok) {
      success++;
      if (coreRoutes.includes(route)) coreSuccess++;
    }
    else skipped++;
  }
  console.log(`[prerender] Done: ${success} written, ${skipped} skipped.`);

  // Fail build if essential core routes could not be prerendered
  if (coreSuccess === 0) {
    console.error('[prerender] FAIL: No core routes (/, /shop, /collections, /about) were successfully prerendered. Check VITE_API_URL.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[prerender] Fatal:', err);
  process.exit(1);
});
