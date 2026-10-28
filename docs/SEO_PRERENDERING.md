# SEO Prerendering Strategy (MS Fragrance)

## Current setup
- Frontend is a Vite + React SPA deployed on Vercel (`vercel.json` rewrites all routes to `/index.html`).
- Metadata is injected client-side by `SeoHead` after route changes. This improves UX and sharing previews in modern crawlers, but **does not guarantee indexing** by search engines that do not execute JavaScript.

## Implemented strategy
1. Keep client-side `SeoHead` injection for navigation and social previews.
2. **Build-time prerendering (metadata)** is implemented via `scripts/prerender.mjs`:
   - Runs after `vite build` as part of `npm run build`.
   - Fetches the public product list and per-route SEO metadata from the backend public APIs (`/api/products`, `/api/seo/public/:route`).
   - Generates static HTML files under `dist/` for `/`, `/shop`, `/collections`, `/about`, and every published product (`/product/:id`).
   - Injects route-specific `<title>`, meta description, robots, canonical, Open Graph, Twitter, and JSON-LD tags into the Vite HTML template `<head>`.
   - Skips non-indexable routes and handles API failures per-route without failing the build.
3. `vercel.json` serves prerendered static files first (filesystem precedence), falling back to `/index.html` for non-prerendered routes; `/sitemap.xml` and `/robots.txt` are served statically.
4. `public/sitemap.xml` is regenerated during build via `scripts/generate-sitemap.mjs` (consumes `GET /api/seo/public/sitemap`).
5. `robots.txt` allows product pages and disallows private routes.
6. Verification: `npm run verify:prerender` checks generated HTML, metadata, product routes, and sitemap consistency.

## Notes
- Body content remains client-rendered; only `<head>` metadata is prerendered. This avoids React hydration mismatches while guaranteeing metadata exists before JavaScript executes.
- Re-run prerender on every deploy; keep sitemap in sync.
- Requires `VITE_API_URL` (backend URL) and optionally `SITE_URL` at build time.
