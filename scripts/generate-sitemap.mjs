import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSitemapXml } from '../src/utils/sitemap.js';

const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';
const SITE_URL = process.env.SITE_URL || 'https://msfragrance.in';
const OUT = resolve(process.cwd(), 'public', 'sitemap.xml');
const VERCEL_JSON = resolve(process.cwd(), 'vercel.json');

function normalizeLoc(loc, siteUrl) {
    if (!loc) return loc;
    const baseUrl = siteUrl.replace(/\/$/, '');
    if (!loc.startsWith('http')) {
        return baseUrl + '/' + loc.replace(/^\/+/, '');
    }
    try {
        const parsed = new URL(loc);
        return baseUrl + parsed.pathname + parsed.search + parsed.hash;
    } catch {
        return loc;
    }
}

async function main() {
    if (!process.env.VITE_API_URL) {
        console.warn(
            '[sitemap] WARNING: VITE_API_URL is not set. Falling back to http://localhost:5000. ' +
            'Sitemap generation will fail unless the backend is running locally. ' +
            'Set VITE_API_URL (e.g. https://attar-backend-vert.vercel.app) in your build environment.'
        );
    }
    try {
        const res = await fetch(`${API_URL}/api/seo/public/sitemap`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const xml = buildSitemapXml(data, SITE_URL);
        writeFileSync(OUT, xml, 'utf8');
        console.log(`[sitemap] wrote ${OUT} with ${data?.urls?.length ?? 0} urls`);

        // ── Generate legacy numeric → descriptive product redirects for Vercel ──
        const baseUrl = SITE_URL.replace(/\/$/, '');
        const urls = Array.isArray(data?.urls) ? data.urls : [];
        const productUrls = urls
            .filter((u) => u && u.loc)  // descriptive product URLs are detected below
            .map((u) => {
                const path = normalizeLoc(u.loc, SITE_URL).replace(baseUrl, '');
                return { loc: u.loc, path };
            })
            .filter(({ path }) => /^\/product\/.+-\d+$/.test(path))
            .map(({ path }) => {
                const match = path.match(/^\/product\/.+-(\d+)$/);
                return match ? { id: match[1], path } : null;
            })
            .filter(Boolean);

        const redirects = productUrls.map(({ id, path }) => ({
            source: `/product/${id}`,
            destination: path,
            statusCode: 301,
        }));

        // Read existing vercel.json, preserve rewrites, replace redirects array.
        let vercelConfig = { rewrites: [], redirects: [] };
        try {
            const existing = JSON.parse(readFileSync(VERCEL_JSON, 'utf8'));
            vercelConfig = { ...vercelConfig, ...existing };
        } catch {
            // File missing or invalid; start fresh.
        }
        // Preserve any manually specified redirects (e.g. from vercel.json) that
        // aren't already covered by generated redirects. This keeps vercel.json
        // redirects intact when the build regenerates the redirects array.
        const generatedSourceSet = new Set(redirects.map((r) => r.source));
        const manualRedirects = (vercelConfig.redirects || []).filter(
            (r) => !generatedSourceSet.has(r.source)
        );
        vercelConfig.redirects = [...redirects, ...manualRedirects];
        writeFileSync(VERCEL_JSON, JSON.stringify(vercelConfig, null, 2) + '\n', 'utf8');
        console.log(`[redirects] wrote ${redirects.length} legacy product redirects to vercel.json`);
    } catch (err) {
        console.warn(`[sitemap] failed to generate: ${err.message}`);
        // Leave any existing sitemap.xml in place; do not fail the build.
    }
}

main();