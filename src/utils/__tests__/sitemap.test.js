import { describe, it, expect } from 'vitest';
import { buildSitemapXml } from '../sitemap';

describe('buildSitemapXml', () => {
    it('builds urlset with escaped locs', () => {
        const xml = buildSitemapXml({ urls: [{ loc: 'https://x.com/a?b=1', changefreq: 'daily', priority: 1.0 }] });
        expect(xml).toContain('<loc>https://x.com/a?b=1</loc>');
        expect(xml).toContain('<changefreq>daily</changefreq>');
        expect(xml).toContain('<priority>1.0</priority>');
        expect(xml).toContain('<urlset');
    });

    it('handles empty urls', () => {
        const xml = buildSitemapXml({});
        expect(xml).toContain('<urlset');
        expect(xml).not.toContain('<url>');
    });

    it('includes lastmod when provided', () => {
        const xml = buildSitemapXml({ urls: [{ loc: 'https://x.com/b', lastmod: '2026-01-01T00:00:00.000Z' }] });
        expect(xml).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>');
    });
});