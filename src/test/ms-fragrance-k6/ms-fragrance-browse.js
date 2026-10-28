import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Read-only HTTP load test. It does not execute React or fetch all page assets.
const BASE_URL = (__ENV.BASE_URL || 'https://msfragrance.in').replace(/\/+$/, '');
const API_BASE_URL = (__ENV.API_BASE_URL || 'https://attar-backend-vert.vercel.app').replace(/\/+$/, '');
const PRODUCTS_PATH = __ENV.PRODUCTS_PATH || '/api/products';
const PRODUCT_DETAIL_URL = (__ENV.PRODUCT_DETAIL_URL || '').trim(); // Optional, read-only GET URL.
const THINK_MIN = Number(__ENV.THINK_MIN || 2);
const THINK_MAX = Number(__ENV.THINK_MAX || 5);
const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || '30s';

// Default profile: 1 -> 10 -> 25 -> 50 VUs, hold 50 VUs for 5 minutes, ramp down.
// Override with STAGES="1m:10,2m:25,2m:50,5m:50,2m:0" (duration:target pairs).
const DEFAULT_STAGES = '1m:10,2m:25,2m:50,5m:50,2m:0';

function parseStages(raw) {
    const stages = raw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const [duration, target] = entry.split(':');

            if (!duration || target === undefined) {
                throw new Error(`Invalid stage "${entry}". Expected "<duration>:<target>".`);
            }

            return { duration: duration.trim(), target: Number(target) };
        });

    if (stages.length === 0) {
        throw new Error('At least one stage is required.');
    }

    return stages;
}

const STAGES = parseStages(__ENV.STAGES || DEFAULT_STAGES);

const businessErrors = new Rate('business_errors');
const homepageDuration = new Trend('homepage_duration', true);
const productsDuration = new Trend('products_duration', true);
const detailDuration = new Trend('product_detail_duration', true);

// Per-endpoint counters and error rates so the homepage and the product API are
// reported separately in the end-of-test summary.
const homepageRequests = new Counter('homepage_requests');
const productsRequests = new Counter('products_requests');
const homepageFailures = new Rate('homepage_errors');
const productsFailures = new Rate('products_errors');

export const options = {
  scenarios: {
    production_browse: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: STAGES,
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Explicit targets (not guarantees): HTTP failure rate below 1% and
    // p95 response time below 2 seconds. The failure-rate threshold aborts the
    // run after a sustained breach so an unhealthy deployment is not hammered.
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '2m' }],
    http_req_duration: [{ threshold: 'p(95)<2000', abortOnFail: false }],
    homepage_duration: [{ threshold: 'p(95)<2000', abortOnFail: false }],
    products_duration: [{ threshold: 'p(95)<2000', abortOnFail: false }],
    homepage_errors: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '2m' }],
    products_errors: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '2m' }],
    business_errors: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '2m' }],
  },
  userAgent: 'MS-Fragrance-k6-readonly-load-test/1.0',
};

function pause() {
  sleep(THINK_MIN + Math.random() * Math.max(0, THINK_MAX - THINK_MIN));
}

export default function () {
  const home = http.get(`${BASE_URL}/`, { tags: { name: 'GET homepage' }, timeout: REQUEST_TIMEOUT });
  homepageRequests.add(1);
  homepageDuration.add(home.timings.duration);
  const homeOk = check(home, {
    'homepage returns 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
    'homepage response is not empty': (r) => r.body && r.body.length > 0,
  });
  homepageFailures.add(!homeOk);
  businessErrors.add(!homeOk);
  pause();

  const path = PRODUCTS_PATH.startsWith('/') ? PRODUCTS_PATH : `/${PRODUCTS_PATH}`;
  const products = http.get(`${API_BASE_URL}${path}`, { tags: { name: 'GET product listing API' }, timeout: REQUEST_TIMEOUT });
  productsRequests.add(1);
  productsDuration.add(products.timings.duration);
  const productsOk = check(products, {
    'product listing returns 2xx': (r) => r.status >= 200 && r.status < 300,
    'product listing response is not empty': (r) => r.body && r.body.length > 0,
  });
  productsFailures.add(!productsOk);
  businessErrors.add(!productsOk);
  pause();

  if (PRODUCT_DETAIL_URL) {
    const detail = http.get(PRODUCT_DETAIL_URL, { tags: { name: 'GET product detail API' }, timeout: REQUEST_TIMEOUT });
    detailDuration.add(detail.timings.duration);
    const detailOk = check(detail, {
      'product detail returns 2xx': (r) => r.status >= 200 && r.status < 300,
      'product detail response is not empty': (r) => r.body && r.body.length > 0,
    });
    businessErrors.add(!detailOk);
    pause();
  }
}
