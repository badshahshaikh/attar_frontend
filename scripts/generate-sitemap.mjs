import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSitemapXml } from '../src/utils/sitemap.js';

const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';
const SITE_URL = process.env.SITE_URL || 'https://msfragrance.in';
const OUT = resolve(process.cwd(), 'public', 'sitemap.xml');

async function main() {
    try {
        const res = await fetch(`${API_URL}/api/seo/public/sitemap`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const xml = buildSitemapXml(data, SITE_URL);
        writeFileSync(OUT, xml, 'utf8');
        console.log(`[sitemap] wrote ${OUT} with ${data?.urls?.length ?? 0} urls`);
    } catch (err) {
        console.warn(`[sitemap] failed to generate: ${err.message}`);
        // Leave any existing sitemap.xml in place; do not fail the build.
    }
}

main();