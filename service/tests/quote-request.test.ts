// [BCC-QUOTE-1]
import { DEFAULT_SETTINGS } from 'budgets-cost-centers-core';
import { readConfig } from 'budgets-cost-centers-shared';
import { handleQuoteRequest, type QuoteRequestLike } from '../src/quote-request';
import { FakePlatform } from './fake-platform';

const config = readConfig(
  { CTP_PROJECT_KEY: 'demo', CTP_REGION: 'r', CTP_CLIENT_ID: 'i', CTP_CLIENT_SECRET: 's', CTP_SCOPE: 'view_orders:demo', BCC_EXTENSION_SECRET: 'x'.repeat(32) },
  'service',
);
const PRJ = 'unit-a~PRJ-1001';
const setup = () => {
  const p = new FakePlatform();
  p.units = [{ key: 'unit-a', associates: [] }];
  p.objects = [
    { container: 'bcc-settings', key: 'unit-a', value: DEFAULT_SETTINGS },
    { container: 'bcc-cost-objects', key: PRJ, value: { code: 'PRJ-1001', name: 'Depot', type: 'project', ownerBusinessUnitKey: 'unit-a', active: true, project: { status: 'active' } } },
  ];
  p.carts = [{ id: 'c-1', totalPrice: { currencyCode: 'EUR', centAmount: 1 }, custom: { type: { id: 'type-order' }, fields: { bccCostObject: PRJ } } }];
  return p;
};
const qr = (patch: Partial<QuoteRequestLike> = {}): QuoteRequestLike => ({ cart: { id: 'c-1' }, customerId: 'cust-1', businessUnit: { key: 'unit-a' }, ...patch });
const run = (p: FakePlatform, q: QuoteRequestLike) => handleQuoteRequest(q, { platform: p, config, now: () => '2026-11-02T10:00:00.000Z', deadlineMs: 1500 });

test('copies the cost object from the cart', async () =>
  expect(await run(setup(), qr())).toEqual({
    status: 200,
    actions: [{ action: 'setCustomType', type: { typeId: 'type', key: 'bcc-quote' }, fields: { bccCostObject: PRJ } }],
  }));
test('an explicit value wins', async () =>
  expect(await run(setup(), qr({ custom: { type: { id: 'type-quote' }, fields: { bccCostObject: PRJ } } }))).toEqual({ status: 200, actions: [] }));
test('an existing quote type without the field gets setCustomField', async () =>
  expect(await run(setup(), qr({ custom: { type: { id: 'type-quote' }, fields: {} } }))).toEqual({
    status: 200,
    actions: [{ action: 'setCustomField', name: 'bccCostObject', value: PRJ }],
  }));
test('an invalid cost object is rejected', async () => {
  const p = setup();
  (p.objects[1]!.value as { project: { status: string } }).project.status = 'closed';
  expect(await run(p, qr())).toEqual({ status: 400, message: 'Project PRJ-1001 is closed and cannot be ordered against.' });
});
test('a cart without a cost object leaves the request alone', async () => {
  const p = setup();
  p.carts[0]!.custom = undefined;
  expect(await run(p, qr())).toEqual({ status: 200, actions: [] });
});
test('a platform failure leaves the request alone', async () => {
  const p = setup();
  p.failWith.getCart = new Error('503');
  expect(await run(p, qr())).toEqual({ status: 200, actions: [] });
});
test('a foreign quote type is a misconfiguration', async () => {
  const r = await run(setup(), qr({ custom: { type: { id: 'type-x' }, fields: {} } }));
  expect(r.status === 400 && r.message).toMatch(/not configured for budgets/);
});
test('a recreated quote type is re-resolved (review M7)', async () => {
  const p = setup();
  await run(p, qr());
  p.types['bcc-quote'] = 'type-quote-new';
  expect(await run(p, qr({ custom: { type: { id: 'type-quote-new' }, fields: { bccCostObject: PRJ } } }))).toEqual({ status: 200, actions: [] });
});
