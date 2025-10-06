import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: Number(__ENV.K6_VUS || 10),
  duration: __ENV.K6_DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01']
  }
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000/api/v1';

export default function () {
  const list = http.get(`${BASE_URL}/orders`);
  check(list, {
    'list status is 200': res => res.status === 200,
    'list contains data': res => res.json('data') !== undefined
  });

  const payload = JSON.stringify({
    contactName: 'Load Test User',
    contactPhone: '0900123456',
    address: '台北市大安區測試路 123 號',
    paymentMethod: 'cash',
    subtotal: 100,
    deliveryFee: 30,
    totalAmount: 130,
    items: []
  });

  const headers = { 'Content-Type': 'application/json' };
  const create = http.post(`${BASE_URL}/orders`, payload, { headers });

  check(create, {
    'create status is 201': res => res.status === 201,
    'create returns order id': res => Boolean(res.json('data.id'))
  });

  sleep(1);
}
