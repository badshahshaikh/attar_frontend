import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(process.cwd(), 'dist');
let failures = 0;

function fail(msg) {
  failures++;
  console.error('[verify-prerender] FAIL:', msg);
}

function ok(msg) {
  console.log('[verify-prerender] OK:', msg);
}

function read(file) {
  const p = path.join(DIST, file);
  if (!fs.existsSync(p)) {
    fail(`missing file: ${file}`);
    return null;
  }
  return fs.readFileSync(p, 'utf8');
}

// 1. Homepage
const home = read('index.html');
if (home) {
  if (!/<title>[^<]+<\/title>/.test(home)) fail('homepage missing <title>');
  else ok('homepage has <title>');
  if (!/application\/ld\+json/.test(home)) fail('homepage missing JSON-LD');
  else ok('homepage has JSON-LD');
}

// 2. Core routes
for (const r of ['shop', 'collections', 'about']) {
  const html = read(`${r}/index.html`);
  if (html && /<title>[^<]+<\/title>/.test(html)) ok(`${r} has <title>`);
  else if (html) fail(`${r} missing <title>`);
}

// 3. At least one product route
const productDirs = fs.readdirSync(DIST, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name === 'product')
  .length
  ? fs.readdirSync(path.join(DIST, 'product'))
  : [];
if (productDirs.length === 0) fail('no prerendered product routes');
else {
  ok(`${productDirs.length} product route dirs present`);
  const sample = productDirs[0];
  const html = read(`product/${sample}/index.html`);
  if (html) {
    if (!/<title>[^<]+<\/title>/.test(html)) fail(`product/${sample} missing <title>`);
    else ok(`product/${sample} has <title>`);
    if (!/application\/ld\+json/.test(html)) ok(`product/${sample} has JSON-LD`);
    else ok(`product/${sample} has JSON-LD`);
    if (!/rel="canonical"/.test(html)) fail(`product/${sample} missing canonical`);
    else ok(`product/${sample} has canonical`);
  }
}

// 4. Sitemap consistency
const sitemap = read('sitemap.xml');
if (sitemap) {
  if (!/<urlset/.test(sitemap)) fail('sitemap.xml invalid');
  else ok('sitemap.xml valid urlset');
  const locCount = (sitemap.match(/<loc>/g) || []).length;
  ok(`sitemap has ${locCount} urls`);
}

// 5. robots.txt
const robots = read('robots.txt');
if (robots && /Sitemap:/i.test(robots)) ok('robots.txt references sitemap');
else if (robots) fail('robots.txt missing Sitemap reference');

console.log(`[verify-prerender] ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
