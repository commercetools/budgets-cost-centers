// The SeedPort on the SDK: endpoints, 404 as absent, other errors surface. [BCC-SEED-2] [BCC-SEED-3]
import { type AppConfig, createApiRoot } from 'budgets-cost-centers-shared';
import { sdkPort } from '../src/sdk-port';

const config: AppConfig = {
  projectKey: 'bcc-sandbox',
  authUrl: 'https://auth.example.com',
  apiUrl: 'https://api.example.com',
  clientId: 'id',
  clientSecret: 'secret',
  scope: 'view_types:bcc-sandbox',
  typeKeys: { order: 'bcc-order', lineItem: 'bcc-line-item', shoppingList: 'bcc-shopping-list', quote: 'bcc-quote' },
  projectRetentionDays: 365,
  cacheSeconds: 60,
};

type Call = { method: string; path: string; body?: unknown };
type Route = (call: Call) => { status: number; body: unknown } | undefined;

let calls: Call[];
function stubFetch(route: Route) {
  calls = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname.startsWith('/oauth/token')) return json(200, { access_token: 't', expires_in: 3600, token_type: 'Bearer' });
    const call: Call = { method: init?.method ?? 'GET', path: decodeURIComponent(url.pathname) };
    if (typeof init?.body === 'string') call.body = JSON.parse(init.body);
    calls.push(call);
    const r = route(call) ?? { status: 404, body: { statusCode: 404, message: 'not found', errors: [{ code: 'ResourceNotFound', message: 'not found' }] } };
    return json(r.status, r.body);
  });
}

// A fresh config object per test, since the API root is cached per config.
const port = () => sdkPort(createApiRoot({ ...config }));

afterEach(() => jest.restoreAllMocks());

test('typeExists reads the type by key; 404 means missing', async () => {
  stubFetch((c) => (c.path.endsWith('/types/key=bcc-order') ? { status: 200, body: { id: 't1', key: 'bcc-order' } } : undefined));
  const p = port();
  expect(await p.typeExists('bcc-order')).toBe(true);
  expect(await p.typeExists('bcc-shopping-list')).toBe(false);
});

test.each([
  ['associate-role', 'associate-roles'],
  ['customer', 'customers'],
  ['business-unit', 'business-units'],
  ['cart', 'carts'],
  ['shopping-list', 'shopping-lists'],
] as const)('findByKey(%s) reads /%s/key=<key>', async (kind, segment) => {
  stubFetch((c) => (c.method === 'GET' ? { status: 200, body: { id: 'x1', key: 'bcc-demo-k' } } : undefined));
  expect(await port().findByKey(kind, 'bcc-demo-k')).toEqual({ id: 'x1' });
  expect(calls).toEqual([{ method: 'GET', path: `/bcc-sandbox/${segment}/key=bcc-demo-k` }]);
});

test('findByKey returns undefined on 404 and throws on other errors', async () => {
  stubFetch((c) => (c.path.includes('carts') ? { status: 500, body: { statusCode: 500, message: 'boom', errors: [{ code: 'General', message: 'boom' }] } } : undefined));
  const p = port();
  expect(await p.findByKey('customer', 'bcc-demo-k')).toBeUndefined();
  await expect(p.findByKey('cart', 'bcc-demo-k')).rejects.toBeDefined();
});

test.each([
  ['associate-role', 'associate-roles', { id: 'r1' }],
  ['customer', 'customers', { customer: { id: 'r1' } }],
  ['business-unit', 'business-units', { id: 'r1' }],
  ['cart', 'carts', { id: 'r1' }],
  ['shopping-list', 'shopping-lists', { id: 'r1' }],
] as const)('create(%s) posts the draft to /%s', async (kind, segment, response) => {
  stubFetch((c) => (c.method === 'POST' ? { status: 201, body: response } : undefined));
  expect(await port().create(kind, { key: 'bcc-demo-k' })).toEqual({ id: 'r1' });
  expect(calls).toEqual([{ method: 'POST', path: `/bcc-sandbox/${segment}`, body: { key: 'bcc-demo-k' } }]);
});

test('Custom Objects are read by container and key and written with the version', async () => {
  stubFetch((c) =>
    c.method === 'GET'
      ? { status: 200, body: { id: 'o1', container: 'bcc-budgets', key: 'bcc-demo-u~b', value: { a: 1 }, version: 3 } }
      : { status: 200, body: { id: 'o1', version: 4 } },
  );
  const p = port();
  expect(await p.getCustomObject('bcc-budgets', 'bcc-demo-u~b')).toEqual({ value: { a: 1 }, version: 3 });
  await p.putCustomObject('bcc-budgets', 'bcc-demo-u~b', { a: 2 }, 3);
  await p.putCustomObject('bcc-budgets', 'bcc-demo-u~c', { a: 1 });
  expect(calls).toEqual([
    { method: 'GET', path: '/bcc-sandbox/custom-objects/bcc-budgets/bcc-demo-u~b' },
    { method: 'POST', path: '/bcc-sandbox/custom-objects', body: { container: 'bcc-budgets', key: 'bcc-demo-u~b', value: { a: 2 }, version: 3 } },
    { method: 'POST', path: '/bcc-sandbox/custom-objects', body: { container: 'bcc-budgets', key: 'bcc-demo-u~c', value: { a: 1 } } },
  ]);
});

test('Approval Rules go through the as-associate endpoint of the unit', async () => {
  stubFetch((c) => (c.method === 'POST' ? { status: 201, body: { id: 'rule-1' } } : undefined));
  const p = port();
  expect(await p.findApprovalRule('admin-1', 'bcc-demo-installer', 'bcc-demo-rule')).toBeUndefined();
  expect(await p.createApprovalRule('admin-1', 'bcc-demo-installer', { key: 'bcc-demo-rule' })).toEqual({ id: 'rule-1' });
  const base = '/bcc-sandbox/as-associate/admin-1/in-business-unit/key=bcc-demo-installer/approval-rules';
  expect(calls).toEqual([
    { method: 'GET', path: `${base}/key=bcc-demo-rule` },
    { method: 'POST', path: base, body: { key: 'bcc-demo-rule' } },
  ]);
});
