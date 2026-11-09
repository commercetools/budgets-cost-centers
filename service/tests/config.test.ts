// [BCC-DEPLOY-6] [BCC-PROJ-3]
import { readConfig } from 'budgets-cost-centers-shared';

const base = {
  CTP_PROJECT_KEY: 'demo',
  CTP_REGION: 'europe-west1.gcp',
  CTP_CLIENT_ID: 'id',
  CTP_CLIENT_SECRET: 'secret',
  CTP_SCOPE: 'view_orders:demo',
  BCC_EXTENSION_SECRET: 'x'.repeat(32),
};

test('region derives the hosts and defaults apply', () =>
  expect(readConfig(base, 'service')).toEqual({
    projectKey: 'demo',
    authUrl: 'https://auth.europe-west1.gcp.commercetools.com',
    apiUrl: 'https://api.europe-west1.gcp.commercetools.com',
    clientId: 'id',
    clientSecret: 'secret',
    scope: 'view_orders:demo',
    extensionSecret: 'x'.repeat(32),
    typeKeys: { order: 'bcc-order', lineItem: 'bcc-line-item', shoppingList: 'bcc-shopping-list', quote: 'bcc-quote' },
    projectRetentionDays: 365,
    cacheSeconds: 60,
  }));
test('explicit hosts win over the region', () => {
  const c = readConfig({ ...base, CTP_AUTH_URL: 'https://auth.x', CTP_API_URL: 'https://api.x' }, 'service');
  expect([c.authUrl, c.apiUrl]).toEqual(['https://auth.x', 'https://api.x']);
});
test('the Extension secret is required for service only', () => {
  const { BCC_EXTENSION_SECRET: _s, ...rest } = base;
  expect(() => readConfig(rest, 'service')).toThrow(/BCC_EXTENSION_SECRET/);
  expect(readConfig(rest, 'ledger').extensionSecret).toBeUndefined();
});
test('a short Extension secret is rejected', () =>
  expect(() => readConfig({ ...base, BCC_EXTENSION_SECRET: 'short' }, 'service')).toThrow(/BCC_EXTENSION_SECRET/));
test.each(['0', '365251', 'abc'])('retention %s is rejected', (v) =>
  expect(() => readConfig({ ...base, BCC_PROJECT_RETENTION_DAYS: v }, 'service')).toThrow(/BCC_PROJECT_RETENTION_DAYS/));
test('the master data cache defaults to 60 seconds and 0 turns it off [BCC-CART-13]', () => {
  expect(readConfig(base, 'service').cacheSeconds).toBe(60);
  expect(readConfig({ ...base, BCC_CACHE_SECONDS: '0' }, 'service').cacheSeconds).toBe(0);
  expect(readConfig({ ...base, BCC_CACHE_SECONDS: '3600' }, 'service').cacheSeconds).toBe(3600);
});
test.each(['-1', '3601', 'abc', '1.5'])('cache seconds %s is rejected [BCC-CART-13]', (v) =>
  expect(() => readConfig({ ...base, BCC_CACHE_SECONDS: v }, 'service')).toThrow(/BCC_CACHE_SECONDS/));
test('all missing keys are listed at once', () => {
  expect(() => readConfig({}, 'ledger')).toThrow(/CTP_PROJECT_KEY.*CTP_CLIENT_ID.*CTP_CLIENT_SECRET/s);
});
