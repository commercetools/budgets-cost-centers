// [BCC-CART-1] [BCC-CART-3] [BCC-CART-9] [BCC-CART-13] [BCC-QUOTE-1]
import request from 'supertest';
import { DEFAULT_SETTINGS } from 'budgets-cost-centers-core';
import { readConfig } from 'budgets-cost-centers-shared';
import { createApp } from '../src/app';
import { FakePlatform } from './fake-platform';

const SECRET = 's'.repeat(32);
const config = readConfig(
  { CTP_PROJECT_KEY: 'demo', CTP_REGION: 'r', CTP_CLIENT_ID: 'i', CTP_CLIENT_SECRET: 's', CTP_SCOPE: 'view_orders:demo', BCC_EXTENSION_SECRET: SECRET },
  'service',
);
const setup = () => {
  const p = new FakePlatform();
  p.units = [{ key: 'unit-a', associates: [] }];
  p.objects = [{ container: 'bcc-settings', key: 'unit-a', value: DEFAULT_SETTINGS }];
  return { p, app: createApp({ platform: p, config, now: () => '2026-11-02T10:00:00.000Z' }) };
};
const cartBody = (fields?: Record<string, unknown>) => ({
  action: 'Update',
  resource: {
    typeId: 'cart',
    id: 'c-1',
    obj: { id: 'c-1', customerId: 'cust-1', businessUnit: { key: 'unit-a' }, totalPrice: { currencyCode: 'EUR', centAmount: 100 }, ...(fields ? { custom: { type: { id: 'type-order' }, fields } } : {}) },
  },
});

describe('authorization', () => {
  test.each([
    ['missing', undefined],
    ['wrong', `Bearer ${'t'.repeat(32)}`],
    ['other length', 'Bearer short'],
    ['without Bearer', SECRET],
  ])('%s header is rejected without platform calls', async (_name, header) => {
    const { p, app } = setup();
    const req = request(app).post('/service').send(cartBody());
    const res = await (header ? req.set('Authorization', header) : req);
    expect(res.status).toBe(401);
    expect(p.calls).toEqual([]);
  });
});

const post = (app: ReturnType<typeof createApp>, body: unknown) =>
  request(app).post('/service').set('Authorization', `Bearer ${SECRET}`).set('X-Correlation-ID', 'corr-1').send(body as object);

test('health', async () => expect((await request(setup().app).get('/service/health')).status).toBe(200));
test('a cart update answers with actions', async () => {
  const res = await post(setup().app, cartBody());
  expect(res.status).toBe(200);
  expect(res.body.actions[0].action).toBe('setCustomType');
});
test('an unchanged result answers 200 without a body', async () => {
  const { app } = setup();
  const first = await post(app, cartBody());
  const fields = first.body.actions[0].fields as Record<string, unknown>;
  const res = await post(app, cartBody(fields));
  expect(res.status).toBe(200);
  expect(res.text).toBe('');
});
test('a validation failure answers 400 InvalidInput', async () => {
  const res = await post(setup().app, cartBody({ bccCostObject: 'unit-a~CC-404' }));
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ errors: [{ code: 'InvalidInput', message: 'Cost object CC-404 does not exist.' }] });
});
test('order Create runs the guard', async () => {
  const res = await post(setup().app, { action: 'Create', resource: { typeId: 'order', id: 'o-1', obj: { cart: { id: 'c-1' }, businessUnit: { key: 'unit-a' } } } });
  expect(res.status).toBe(400);
  expect(res.body.errors[0].message).toMatch(/has not been checked yet/);
});
test('an unknown resource type is acknowledged', async () => {
  const res = await post(setup().app, { action: 'Create', resource: { typeId: 'payment', id: 'p-1', obj: {} } });
  expect([res.status, res.text]).toEqual([200, '']);
});
test('an internal error answers 500 without details and logs the correlation id', async () => {
  const { p } = setup();
  const app = createApp({ platform: p, config, now: () => { throw new TypeError('secret detail'); } });
  const out: string[] = [];
  const spy = jest.spyOn(process.stderr, 'write').mockImplementation((s) => (out.push(String(s)), true));
  const res = await post(app, cartBody());
  spy.mockRestore();
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ errors: [{ code: 'General', message: 'Internal error' }] });
  expect(out.join('')).toMatch(/"correlationId":"corr-1"/);
  expect(out.join('')).toMatch(/"resourceId":"c-1"/);
});
test('a malformed body is rejected as 400', async () => {
  const res = await post(setup().app, { nope: true });
  expect(res.status).toBe(400);
  expect(res.body.errors[0].code).toBe('InvalidInput');
});
test('invalid JSON is rejected as 400', async () => {
  const res = await request(setup().app).post('/service').set('Authorization', `Bearer ${SECRET}`).set('Content-Type', 'application/json').send('{nope');
  expect(res.status).toBe(400);
});

test('an unauthenticated caller gets 401 before the body is parsed (review M9)', async () => {
  const res = await request(setup().app).post('/service').set('Content-Type', 'application/json').send('{nope');
  expect(res.status).toBe(401);
});
test('a cart over 1 MB is still checked (review I3)', async () => {
  const body = cartBody();
  (body.resource.obj as Record<string, unknown>).lineItems = [{ name: 'x'.repeat(2_000_000) }];
  const res = await post(setup().app, body);
  expect(res.status).toBe(200);
});
test('a body over the limit is rejected as 400 with a readable message (review I3)', async () => {
  const body = cartBody();
  (body.resource.obj as Record<string, unknown>).lineItems = [{ name: 'x'.repeat(11_000_000) }];
  const res = await post(setup().app, body);
  expect(res.status).toBe(400);
  expect(res.body.errors[0].message).toBe('The cart is too large for the budget check.');
});

test('the cart check keeps master data for the window, the order guard reads live [BCC-CART-13]', async () => {
  const { p, app } = setup();
  const reads = () => p.calls.filter((c) => ['getBusinessUnit', 'getCustomObjects', 'queryBudgets'].includes(c.method)).length;
  await post(app, cartBody());
  const first = reads();
  expect(first).toBeGreaterThan(0);
  await post(app, cartBody());
  expect(reads()).toBe(first);
  expect(p.calls.filter((c) => c.method === 'queryOrders')).toHaveLength(0);
  const before = p.calls.length;
  await post(app, { action: 'Create', resource: { typeId: 'order', id: 'o-1', obj: { cart: { id: 'c-1' }, businessUnit: { key: 'unit-a' } } } });
  expect(p.calls.length).toBeGreaterThan(before);
});
test('the cache is off with BCC_CACHE_SECONDS=0 [BCC-CART-13]', async () => {
  const p = new FakePlatform();
  p.units = [{ key: 'unit-a', associates: [] }];
  p.objects = [{ container: 'bcc-settings', key: 'unit-a', value: DEFAULT_SETTINGS }];
  const off = createApp({ platform: p, config: { ...config, cacheSeconds: 0 }, now: () => '2026-11-02T10:00:00.000Z' });
  await post(off, cartBody());
  const first = p.calls.length;
  await post(off, cartBody());
  expect(p.calls.length).toBeGreaterThan(first);
  expect(p.calls.filter((c) => c.method === 'getBusinessUnit')).toHaveLength(2);
});
