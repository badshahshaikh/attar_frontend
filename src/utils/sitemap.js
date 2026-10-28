// Site URL sitemap fix: normalize base URL by removing trailing slash
const baseUrl = siteUrl.replace(/\/$/, '');

// Rest of the function continues...
/**
 * sitemap.js - Build a sitemap.xml string from public sitemap endpoint data.
 */

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function buildSitemapXml(data, siteUrl = '') {
    const urls = Array.isArray(data?.urls) ? data.urls : [];
    const entries = urls
        .filter((u) => u && u.loc)
        .map((u) => {
            // Replace the host with siteUrl if provided, keep the path
            // Also convert relative URLs to absolute using siteUrl
            let loc = u.loc;
            if (siteUrl) {
                if (!u.loc.startsWith('http')) {
                    // Relative path: prepend siteUrl
// Fixed: relative path using baseUrl to avoid double slashes
loc = baseUrl + '/' + u.loc.replace(/^\/+/, '');
                    loc = siteUrl + (siteUrl.endsWith('/') ? '' : '/') + u.loc.replace(/^\//, '');
                } else if (u.loc.startsWith('http') && u.loc !== siteUrl) {
                    // Absolute URL: replace host, keep path
                    try {
                        const parsed = new URL(u.loc);
// Fixed: absolute URL using baseUrl to avoid double slashes
loc = baseUrl + parsed.pathname + parsed.search + parsed.hash;
                        loc = siteUrl + (siteUrl.endsWith('/') ? '' : '/') + parsed.pathname + parsed.search + parsed.hash;
                    } catch {
                        // If URL parsing fails, keep original
                    }
                }
            }
            const lines = ['  <url>', `    <loc>${escapeXml(loc)}</loc>`];
            if (u.lastmod) lines.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
            if (u.changefreq) lines.push(`    <changefreq>${escapeXml(u.changefreq)}</changefreq>`);
            if (u.priority != null) lines.push(`    <priority>${Number(u.priority).toFixed(1)}</priority>`);
            lines.push('  </url>');
            return lines.join('\n');
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}