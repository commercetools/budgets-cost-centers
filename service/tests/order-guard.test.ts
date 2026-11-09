// [BCC-CART-9] [BCC-QUOTE-2] [BCC-PROJ-4]
import { DEFAULT_SETTINGS } from 'budgets-cost-centers-core';
import { readConfig } from 'budgets-cost-centers-shared';
import { guardOrder, type OrderDraftLike } from '../src/order-guard';
import { FakePlatform } from './fake-platform';

const config = readConfig(
  { CTP_PROJECT_KEY: 'demo', CTP_REGION: 'r', CTP_CLIENT_ID: 'i', CTP_CLIENT_SECRET: 's', CTP_SCOPE: 'view_orders:demo', BCC_EXTENSION_SECRET: 'x'.repeat(32) },
  'service',
);
const PRJ = 'unit-a~PRJ-1001';
const setup = (required = false) => {
  const p = new FakePlatform();
  p.units = [{ key: 'unit-a', associates: [] }];
  p.objects = [
    { container: 'bcc-settings', key: 'unit-a', value: { ...DEFAULT_SETTINGS, costObjectRequired: required } },
    { container: 'bcc-cost-objects', key: PRJ, value: { code: 'PRJ-1001', name: 'Depot', type: 'project', ownerBusinessUnitKey: 'unit-a', active: true, project: { status: 'active' } } },
  ];
  p.quotes = [{ id: 'q-1', custom: { type: { id: 'type-quote' }, fields: { bccCostObject: PRJ } } }, { id: 'q-2' }];
  return p;
};
const fromCart = (fields?: Record<string, unknown>): OrderDraftLike => ({
  cart: { id: 'c-1' },
  customerId: 'cust-1',
  businessUnit: { key: 'unit-a' },
  ...(fields ? { custom: { type: { id: 'type-order' }, fields } } : {}),
});
const run = (p: FakePlatform, o: OrderDraftLike, deadlineMs = 1500) =>
  guardOrder(o, { platform: p, config, now: () => '2026-11-02T10:00:00.000Z', deadlineMs });
const rejected = (message: string) => ({ status: 400, message });
const blockScopes = JSON.stringify([
  { key: 'unit-a~Q4-UNIT', kind: 'business-unit', amount: 1, used: 0, projected: 1, level: 'ok', mode: 'block' },
  { key: 'unit-a~Q4-PRJ-1001', kind: 'cost-object', amount: 100, used: 90, projected: 130, level: 'exceeded', mode: 'block' },
]);

test('a blocked cart names the budget', async () =>
  expect(await run(setup(), fromCart({ bccBudgetStatus: 'blocked', bccBudgetScopes: blockScopes }))).toEqual(
    rejected('This order exceeds the budget Q4-PRJ-1001 and cannot be placed.'),
  ));
test('a cart blocked because the budget was unchecked', async () =>
  expect(await run(setup(), fromCart({ bccBudgetStatus: 'blocked', bccBudgetScopes: '{"error":"unchecked"}' }))).toEqual(
    rejected('The budget could not be checked and no approval applies to this buyer, so the order cannot be placed.'),
  ));
test('a cart never checked', async () =>
  expect(await run(setup(), fromCart())).toEqual(rejected('The budget of this cart has not been checked yet. Update the cart and try again.')));
test('a foreign order type counts as never checked', async () =>
  expect(await run(setup(), { ...fromCart(), custom: { type: { id: 'type-shop' }, fields: { bccBudgetStatus: 'ok' } } })).toEqual(
    rejected('The budget of this cart has not been checked yet. Update the cart and try again.'),
  ));
test('status none while a cost object is required', async () =>
  expect(await run(setup(true), fromCart({ bccBudgetStatus: 'none' }))).toEqual(
    rejected('This business unit requires a cost object. Choose one on the cart before ordering.'),
  ));
test('a warned cart is ordered', async () => expect(await run(setup(), fromCart({ bccBudgetStatus: 'warn' }))).toEqual({ status: 200, actions: [] }));
test('a project closed since the last cart update is rejected', async () => {
  const p = setup();
  (p.objects[1]!.value as { project: { status: string } }).project.status = 'closed';
  expect(await run(p, fromCart({ bccBudgetStatus: 'ok', bccCostObject: PRJ }))).toEqual(rejected('Project PRJ-1001 is closed and cannot be ordered against.'));
});
test('a platform failure fails closed', async () => {
  const p = setup();
  p.failWith.getBusinessUnit = new Error('503');
  expect(await run(p, fromCart({ bccBudgetStatus: 'ok', bccCostObject: PRJ }))).toEqual(rejected('The budget could not be checked. Please try again.'));
});
test('a hanging platform call fails closed within the time budget', async () => {
  const p = setup();
  p.hang.getBusinessUnit = true;
  expect(await run(p, fromCart({ bccBudgetStatus: 'ok', bccCostObject: PRJ }), 50)).toEqual(rejected('The budget could not be checked. Please try again.'));
});
test('an order from a quote gets the quote cost object', async () =>
  expect(await run(setup(), { quote: { id: 'q-1' }, businessUnit: { key: 'unit-a' } })).toEqual({
    status: 200,
    actions: [{ action: 'setCustomType', type: { typeId: 'type', key: 'bcc-order' }, fields: { bccCostObject: PRJ } }],
  }));
test('an order from a quote without a cost object is left alone', async () =>
  expect(await run(setup(), { quote: { id: 'q-2' }, businessUnit: { key: 'unit-a' } })).toEqual({ status: 200, actions: [] }));
test('an order without a Business Unit is left alone', async () =>
  expect(await run(setup(), { cart: { id: 'c-1' } })).toEqual({ status: 200, actions: [] }));

test('a cost object required after the last cart check is enforced (review M6)', async () =>
  expect(await run(setup(true), fromCart({ bccBudgetStatus: 'ok' }))).toEqual(
    rejected('This business unit requires a cost object. Choose one on the cart before ordering.'),
  ));
test('status none after the requirement was switched off asks for a fresh check (review M6)', async () =>
  expect(await run(setup(false), fromCart({ bccBudgetStatus: 'none' }))).toEqual(
    rejected('The budget of this cart has not been checked yet. Update the cart and try again.'),
  ));
test('a recreated order type is re-resolved (review M7)', async () => {
  const p = setup();
  await run(p, fromCart({ bccBudgetStatus: 'ok' }));
  p.types['bcc-order'] = 'type-order-new';
  expect(await run(p, { ...fromCart(), custom: { type: { id: 'type-order-new' }, fields: { bccBudgetStatus: 'warn' } } })).toEqual({ status: 200, actions: [] });
});
test('a missing order type says the check is not set up, not "update the cart" (review minor 12)', async () => {
  const p = setup();
  p.types = {};
  expect(await run(p, fromCart({ bccBudgetStatus: 'ok' }))).toEqual(rejected('The budget check is not set up: the Custom Type bcc-order is missing.'));
});
