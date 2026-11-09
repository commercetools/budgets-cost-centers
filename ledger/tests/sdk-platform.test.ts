// [BCC-APPR-5] [BCC-APPR-6]
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createApiRoot } from 'budgets-cost-centers-shared';
import { PlatformError } from '../src/platform';
import { sdkPlatform } from '../src/sdk-platform';
import { API, config, ctError, tokenHandler } from './fixtures';

const server = setupServer(tokenHandler);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const platform = () => sdkPlatform(createApiRoot(config()));
const order = { id: 'o-1', version: 7, custom: { type: { typeId: 'type', id: 'type-order' }, fields: { bccApprovalStatus: 'pending' } } };

test('getOrder maps the order', async () => {
  server.use(http.get(`${API}/orders/o-1`, () => HttpResponse.json({ ...order, lineItems: [] })));
  expect(await platform().getOrder('o-1')).toEqual({
    id: 'o-1',
    version: 7,
    custom: { type: { id: 'type-order' }, fields: { bccApprovalStatus: 'pending' } },
  });
});
test('getOrder maps an order without custom', async () => {
  server.use(http.get(`${API}/orders/o-1`, () => HttpResponse.json({ id: 'o-1', version: 1 })));
  expect(await platform().getOrder('o-1')).toEqual({ id: 'o-1', version: 1 });
});
test('getOrder maps 404 to undefined', async () => {
  server.use(http.get(`${API}/orders/o-1`, () => ctError(404)));
  expect(await platform().getOrder('o-1')).toBeUndefined();
});
test('getOrder 503 throws a PlatformError with the status', async () => {
  server.use(http.get(`${API}/orders/o-1`, () => ctError(503)));
  const error = await platform().getOrder('o-1').catch((e: unknown) => e);
  expect(error).toBeInstanceOf(PlatformError);
  expect((error as PlatformError).status).toBe(503);
});
test('updateOrder posts version and actions', async () => {
  let body: unknown;
  server.use(
    http.post(`${API}/orders/o-1`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ ...order, version: 8 });
    }),
  );
  const actions = [{ action: 'setCustomField' as const, name: 'bccApprovalStatus', value: 'approved' }];
  await platform().updateOrder('o-1', 7, actions);
  expect(body).toEqual({ version: 7, actions });
});
test('updateOrder 409 throws a PlatformError with the status', async () => {
  server.use(http.post(`${API}/orders/o-1`, () => ctError(409, 'ConcurrentModification')));
  const error = await platform().updateOrder('o-1', 7, []).catch((e: unknown) => e);
  expect((error as PlatformError).status).toBe(409);
});
test('typeIdByKey returns the id', async () => {
  server.use(http.get(`${API}/types/key=bcc-order`, () => HttpResponse.json({ id: 'type-order', key: 'bcc-order', version: 1 })));
  expect(await platform().typeIdByKey('bcc-order')).toBe('type-order');
});
test('typeIdByKey maps 404 to undefined', async () => {
  server.use(http.get(`${API}/types/key=bcc-order`, () => ctError(404)));
  expect(await platform().typeIdByKey('bcc-order')).toBeUndefined();
});
