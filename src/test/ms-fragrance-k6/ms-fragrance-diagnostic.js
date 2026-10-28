
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';


const homepageDuration = new Trend('homepage_duration');
const productsApiDuration = new Trend('products_api_duration');
const BASE_URL = (__ENV.BASE_URL || 'https://msfragrance.in').replace(/\/+$/, '');
const API_BASE_URL = (__ENV.API_BASE_URL || 'https://attar-backend-vert.vercel.app').replace(/\/+$/, '');
const PRODUCTS_PATH = __ENV.PRODUCTS_PATH || '/api/products';

export const options = {
  vus: 1,
  iterations: 10,
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {

    
    
  const home = http.get(`${BASE_URL}/`, {
    tags: { endpoint: 'homepage' },
    timeout: '30s',
  });


  homepageDuration.add(home.timings.duration);

  check(home, {
    'homepage returns success': (r) => r.status >= 200 && r.status < 400,
  });

  sleep(2);

  const path = PRODUCTS_PATH.startsWith('/')
    ? PRODUCTS_PATH
    : `/${PRODUCTS_PATH}`;

  const products = http.get(`${API_BASE_URL}${path}`, {
    tags: { endpoint: 'products_api' },
    timeout: '30s',
  });

  productsApiDuration.add(products.timings.duration);

  check(products, {
    'product API returns success': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(2);
}
