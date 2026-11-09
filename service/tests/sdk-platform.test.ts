// [BCC-SPEND-1] [BCC-CART-4] [BCC-BUDGET-2]
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createApiRoot } from 'budgets-cost-centers-shared';
import { readConfig } from 'budgets-cost-centers-shared';
import { sdkPlatform } from '../src/sdk-platform';

const config = readConfig(
  {
    CTP_PROJECT_KEY: 'demo', CTP_AUTH_URL: 'https://auth.test', CTP_API_URL: 'https://api.test', CTP_CLIENT_ID: 'i',
    CTP_CLIENT_SECRET: 's', CTP_SCOPE: 'view_orders:demo', BCC_EXTENSION_SECRET: 'x'.repeat(32),
  },
  'service',
);
const server = setupServer(
  http.post('https://auth.test/oauth/token', () =>
    HttpResponse.json({ access_token: 'token', expires_in: 172800, token_type: 'Bearer', scope: 'view_orders:demo' })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const platform = () => sdkPlatform(createApiRoot(config));
const order = (id: string) => ({ id, createdAt: '2026-10-01T00:00:00.000Z', orderState: 'Open', totalPrice: { currencyCode: 'EUR', centAmount: 1 } });
const notFound = () => HttpResponse.json({ statusCode: 404, message: 'not found', errors: [{ code: 'ResourceNotFound', message: 'not found' }] }, { status: 404 });

const gqlOrder = (id: string) => ({
  id, createdAt: '2026-10-01T00:00:00.000Z', orderState: 'Open', customerId: 'cust-1', businessUnit: { key: 'unit-a' },
  totalPrice: { currencyCode: 'EUR', centAmount: 1 }, taxedPrice: null,
  custom: { customFieldsRaw: [{ name: 'bccCostObject', value: 'unit-a~PRJ-1001' }] },
});
test('queryOrders projects the needed fields with GraphQL and pages by id (review I4)', async () => {
  const seen: Array<{ query: string; variables: Record<string, unknown> }> = [];
  server.use(
    http.post('https://api.test/demo/graphql', async ({ request }) => {
      const body = (await request.json()) as { query: string; variables: Record<string, unknown> };
      seen.push(body);
      const first = seen.length === 1;
      return HttpResponse.json({ data: { orders: { results: first ? Array.from({ length: 500 }, (_, i) => gqlOrder(`o-${String(i).padStart(3, '0')}`)) : [gqlOrder('o-999')] } } });
    }),
  );
  const orders = await platform().queryOrders('businessUnit(key="unit-a")');
  expect(orders).toHaveLength(501);
  expect(orders[0]).toEqual({
    id: 'o-000', createdAt: '2026-10-01T00:00:00.000Z', orderState: 'Open', customerId: 'cust-1', businessUnit: { key: 'unit-a' },
    totalPrice: { currencyCode: 'EUR', centAmount: 1 }, custom: { fields: { bccCostObject: 'unit-a~PRJ-1001' } },
  });
  expect(seen[0]!.query).not.toMatch(/lineItems/);
  expect(seen[0]!.variables).toEqual({ where: 'businessUnit(key="unit-a")', sort: ['id asc'], limit: 500 });
  expect(seen[1]!.variables.where).toBe('(businessUnit(key="unit-a")) and id > "o-499"');
});
test('GraphQL errors are thrown, not hidden', async () => {
  server.use(http.post('https://api.test/demo/graphql', () => HttpResponse.json({ errors: [{ message: 'bad' }] })));
  await expect(platform().queryOrders('x')).rejects.toThrow(/GraphQL/);
});
test('queryBudgets uses the container endpoint, not the deprecated query', async () => {
  let where: string[] = [];
  server.use(
    http.get('https://api.test/demo/custom-objects/bcc-budgets', ({ request }) => {
      where = new URL(request.url).searchParams.getAll('where');
      return HttpResponse.json({ results: [{ key: 'unit-a~b', value: { x: 1 } }] });
    }),
  );
  expect(await platform().queryBudgets(['unit-a', 'unit-b'])).toEqual([{ key: 'unit-a~b', value: { x: 1 } }]);
  expect(where[0]).toBe('value(ownerBusinessUnitKey in ("unit-a", "unit-b"))');
});
test('getCustomObjects asks for exact keys', async () => {
  let where: string[] = [];
  server.use(
    http.get('https://api.test/demo/custom-objects/bcc-settings', ({ request }) => {
      where = new URL(request.url).searchParams.getAll('where');
      return HttpResponse.json({ results: [] });
    }),
  );
  await platform().getCustomObjects('bcc-settings', ['unit-a', 'division-a1']);
  expect(where[0]).toBe('key in ("unit-a", "division-a1")');
});
test('a missing Business Unit is undefined', async () => {
  server.use(http.get('https://api.test/demo/business-units/key=nope', notFound));
  expect(await platform().getBusinessUnit('nope')).toBeUndefined();
});
test('a Business Unit maps to the port shape', async () => {
  server.use(
    http.get('https://api.test/demo/business-units/key=division-a1', () =>
      HttpResponse.json({
        key: 'division-a1', unitType: 'Division', parentUnit: { typeId: 'business-unit', key: 'unit-a' }, approvalRuleMode: 'ExplicitAndFromParent',
        associates: [{ customer: { typeId: 'customer', id: 'cust-1' }, associateRoleAssignments: [{ associateRole: { typeId: 'associate-role', key: 'buyer' }, inheritance: 'Disabled' }] }],
        inheritedAssociates: [],
      })),
  );
  expect(await platform().getBusinessUnit('division-a1')).toEqual({
    key: 'division-a1', parentUnit: { key: 'unit-a' }, approvalRuleMode: 'ExplicitAndFromParent',
    associates: [{ customer: { id: 'cust-1' }, associateRoleAssignments: [{ associateRole: { key: 'buyer' } }] }],
    inheritedAssociates: [],
  });
});
test('a missing type is undefined, a found type gives its id', async () => {
  server.use(
    http.get('https://api.test/demo/types/key=nope', notFound),
    http.get('https://api.test/demo/types/key=bcc-order', () => HttpResponse.json({ id: 'type-1', key: 'bcc-order' })),
  );
  expect(await platform().typeIdByKey('nope')).toBeUndefined();
  expect(await platform().typeIdByKey('bcc-order')).toBe('type-1');
});
test('a server error is thrown, not hidden', async () => {
  server.use(http.get('https://api.test/demo/carts/c-1', () => HttpResponse.json({ statusCode: 503 }, { status: 503 })));
  await expect(platform().getCart('c-1')).rejects.toBeDefined();
});
