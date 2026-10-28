import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'https://msfragrance.in').replace(/\/+$/, '');
const API_BASE_URL = (__ENV.API_BASE_URL || 'https://attar-backend-vert.vercel.app').replace(/\/+$/, '');
const PRODUCTS_PATH = __ENV.PRODUCTS_PATH || '/api/products';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const home = http.get(`${BASE_URL}/`, { tags: { name: 'GET homepage' }, timeout: '30s' });
  check(home, { 'homepage returns 2xx/3xx': (r) => r.status >= 200 && r.status < 400 });
  sleep(2);
  const path = PRODUCTS_PATH.startsWith('/') ? PRODUCTS_PATH : `/${PRODUCTS_PATH}`;
  const products = http.get(`${API_BASE_URL}${path}`, { tags: { name: 'GET product listing API' }, timeout: '30s' });
  check(products, { 'product listing returns 2xx': (r) => r.status >= 200 && r.status < 300 });
  sleep(2);
}
