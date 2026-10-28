# MS Fragrance — Grafana k6 production browse test

This is a **read-only HTTP load test** for the production storefront and product API. It does not create products/orders, submit forms, trigger payments, or download the full image gallery.

## Files

- `ms-fragrance-browse.js` — main load test. Ramps 1 → 10 → 25 → 50 VUs, holds 50 VUs for 5 minutes, ramps down. **12 minutes total.**
- `ms-fragrance-smoke.js` — 1-VU, 30-second smoke test.
- `ms-fragrance-diagnostic.js` — short low-VU run that splits homepage vs API latency.
- `README.md` — setup and safety instructions.

## Before running

1. Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/
2. Confirm the production site and API URLs.
3. Confirm the actual public GET product-list endpoint. The script defaults to `/api/products` based on current project context; change `PRODUCTS_PATH` if the deployed route differs.
4. Optionally set `PRODUCT_DETAIL_URL` to a known **read-only GET product detail API URL**. Do not set it to a write endpoint.
5. Start with the smoke test.

## Windows PowerShell

Run from the directory containing the scripts:

```powershell
$env:BASE_URL = "https://msfragrance.in"
$env:API_BASE_URL = "https://attar-backend-vert.vercel.app"
$env:PRODUCTS_PATH = "/api/products"

# 1) Smoke test - 1 VU for 30s. Must pass before any load test.
k6 run --summary-trend-stats "avg,min,med,max,p(90),p(95),p(99)" `
  --summary-export .\results\smoke-summary.json .\ms-fragrance-smoke.js

# 2) Diagnostic - 5 VUs for 45s. Confirms which endpoint is slow.
$env:STAGES = "45s:5"; $env:THINK_MIN = "1"; $env:THINK_MAX = "3"
k6 run --summary-trend-stats "avg,min,med,max,p(90),p(95),p(99)" `
  --summary-export .\results\diag-5vu.json .\ms-fragrance-browse.js

# 3) Main load test - 50 concurrent VUs.
Remove-Item Env:\STAGES, Env:\THINK_MIN, Env:\THINK_MAX -ErrorAction SilentlyContinue
k6 run --summary-trend-stats "avg,min,med,max,p(90),p(95),p(99)" `
  --summary-export .\results\load-50vu-summary.json .\ms-fragrance-browse.js
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `https://msfragrance.in` | Storefront origin |
| `API_BASE_URL` | `https://attar-backend-vert.vercel.app` | Backend origin |
| `PRODUCTS_PATH` | `/api/products` | Read-only product list path |
| `PRODUCT_DETAIL_URL` | _(empty)_ | Optional read-only product detail GET |
| `STAGES` | `1m:10,2m:25,2m:50,5m:50,2m:0` | Comma-separated `<duration>:<target>` ramp profile |
| `THINK_MIN` / `THINK_MAX` | `2` / `5` | Think-time seconds between requests |
| `REQUEST_TIMEOUT` | `30s` | Per-request timeout |

`STAGES` is parsed at init, so a malformed value fails fast instead of mid-run.

## Load profile

The default profile runs for approximately 12 minutes and peaks at 50 concurrent VUs:

- Ramp 1 → 10 VUs over 1 minute
- Ramp 10 → 25 VUs over 2 minutes
- Ramp 25 → 50 VUs over 2 minutes
- Hold 50 VUs for 5 minutes
- Ramp down to 0 VUs over 2 minutes

Each virtual user requests the homepage and product-list API with 2–5 seconds of think time between requests. Product detail requests are optional. This is an HTTP endpoint test, not a full browser session: k6 does not execute React or automatically fetch page CSS, JavaScript, fonts, or images.

## Thresholds

| Metric | Threshold | Aborts? |
| --- | --- | --- |
| `http_req_failed` | `rate<0.01` | Yes (after 2m sustained) |
| `http_req_duration` | `p(95)<2000` | No |
| `homepage_duration` | `p(95)<2000` | No |
| `products_duration` | `p(95)<2000` | No |
| `homepage_errors` | `rate<0.01` | Yes (after 2m sustained) |
| `products_errors` | `rate<0.01` | Yes (after 2m sustained) |
| `business_errors` | `rate<0.01` | Yes (after 2m sustained) |

Failure-rate thresholds abort the run after a sustained breach so a degraded deployment is not hammered further. Latency thresholds are reported but never abort.

## Reporting

Per-endpoint metrics are tracked separately so the homepage and the product API are never conflated:

- `homepage_requests` / `products_requests` — request counters per endpoint
- `homepage_duration` / `products_duration` — per-endpoint latency trends
- `homepage_errors` / `products_errors` — per-endpoint failure rates
- `business_errors` — combined check-failure rate
- `checks` — per-assertion pass/fail counts

JSON summaries are written to `results/` via `--summary-export`. Read a summary with:

```powershell
$j = Get-Content .\results\load-50vu-summary.json -Raw | ConvertFrom-Json
$j.metrics.products_duration | ConvertTo-Json
$j.metrics.http_req_failed.values.rate
```

The `results/` directory holds generated output only and is safe to delete after a run.

## Production safety

- Prefer staging. If production is the only option, run during a quiet period and notify anyone monitoring the site.
- Run the smoke test first and inspect logs before increasing load.
- Use public GET endpoints only. Do not test admin, login, upload, order, checkout-submit, email/SMS, or payment routes.
- Do not run multiple copies concurrently.
- Stop if customers report issues, HTTP 5xx errors rise, p95 latency grows sharply, or database/function limits are approached.
- Monitor Vercel Function logs/usage and Supabase database health, connection usage, resource utilization where available, and query latency.
- The test simulates up to 50 virtual users making HTTP requests; it does not prove capacity for 50 full browser users.

## Known backend constraints

The product list endpoint is the expected bottleneck, not the homepage:

- Every list request runs **two** queries — a `COUNT(*)` plus the page query — so each request costs two pooled connections.
- The Postgres pool is hard-capped at `max: 5` connections (`ms_fragrance_backend/src/config/env.js`). At 50 concurrent VUs the API is expected to queue at the pool, so API p95 will rise well above homepage p95 even when nothing is broken.
- `console.log('FILTERS:', filters)` and the `[PRODUCT_LIST_TIMING]` log fire on **every** list request. Under load these flood Vercel function logs and slow the response.

## Interpreting results

Review `http_req_failed`, `http_req_duration` p(90)/p(95)/p(99), request rate, checks, and HTTP 429/5xx responses. Compare the results with Vercel and Supabase metrics. If the product API slows while the homepage stays fast, investigate backend/database queries and connection usage. If the homepage is slow but API responses remain fast, investigate frontend delivery/CDN.

