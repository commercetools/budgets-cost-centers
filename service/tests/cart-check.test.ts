// [BCC-CART-2] [BCC-CART-3] [BCC-CART-4] [BCC-CART-5] [BCC-CART-6] [BCC-CART-7] [BCC-CART-8] [BCC-CART-11]
// [BCC-APPR-2] [BCC-BUDGET-6] [BCC-BUDGET-7] [BCC-PROJ-3]
import { DEFAULT_SETTINGS, type OrderLike, type Settings } from 'budgets-cost-centers-core';
import { readConfig } from 'budgets-cost-centers-shared';
import { checkCart } from '../src/cart-check';
import type { CartLike } from '../src/platform';
import { FakePlatform } from './fake-platform';

const config = readConfig(
  { CTP_PROJECT_KEY: 'demo', CTP_REGION: 'r', CTP_CLIENT_ID: 'i', CTP_CLIENT_SECRET: 's', CTP_SCOPE: 'view_orders:demo', BCC_EXTENSION_SECRET: 'x'.repeat(32) },
  'service',
);
const now = '2026-11-02T10:00:00.000Z';
const eur = (centAmount: number) => ({ currencyCode: 'EUR', centAmount });
const PRJ = 'unit-a~PRJ-1001';
const BUDGET = 'unit-a~Q4-PRJ-1001';

function setup(settings: Partial<Settings> = {}) {
  const p = new FakePlatform();
  p.units = [
    { key: 'unit-a', approvalRuleMode: 'Explicit', associates: [
      { customer: { id: 'cust-1' }, associateRoleAssignments: [{ associateRole: { key: 'buyer' } }] },
      { customer: { id: 'cust-2' }, associateRoleAssignments: [{ associateRole: { key: 'site-buyer' } }] },
    ] },
  ];
  p.objects = [
    { container: 'bcc-settings', key: 'unit-a', value: { ...DEFAULT_SETTINGS, approval: { requesterRoles: ['buyer'] }, ...settings } },
    { container: 'bcc-cost-objects', key: PRJ, value: { code: 'PRJ-1001', name: 'Depot', type: 'project', ownerBusinessUnitKey: 'unit-a', active: true, project: { status: 'active' } } },
    { container: 'bcc-budgets', key: BUDGET, value: {
      scope: { kind: 'cost-object', ref: PRJ }, ownerBusinessUnitKey: 'unit-a', amount: eur(100000),
      period: { kind: 'quarter', from: '2026-01-01' }, mode: 'approval', warnAtPercent: 80, active: true,
    } },
  ];
  const order: OrderLike = {
    id: 'o-1', createdAt: '2026-10-15T09:00:00.000Z', orderState: 'Open', customerId: 'cust-1',
    businessUnit: { key: 'unit-a' }, totalPrice: eur(70000), custom: { fields: { bccCostObject: PRJ } },
  };
  p.orders = [order];
  return p;
}
const cart = (patch: Partial<CartLike> = {}, fields?: Record<string, unknown>): CartLike => ({
  id: 'c-1', customerId: 'cust-1', businessUnit: { key: 'unit-a' }, totalPrice: eur(15000),
  deleteDaysAfterLastModification: 365,
  ...(fields ? { custom: { type: { id: 'type-order' }, fields } } : {}),
  ...patch,
});
const run = (p: FakePlatform, c: CartLike, deadlineMs = 1500) => checkCart(c, { platform: p, config, now: () => now, deadlineMs });
const fieldsOf = (r: Awaited<ReturnType<typeof run>>) => {
  if (r.status !== 200) throw new Error(r.message);
  const out: Record<string, unknown> = {};
  for (const a of r.actions) {
    if (a.action === 'setCustomType') Object.assign(out, a.fields as object);
    if (a.action === 'setCustomField') out[a.name as string] = a.value;
  }
  return out;
};
const warnScopes = JSON.stringify([{ key: BUDGET, kind: 'cost-object', amount: 100000, used: 70000, projected: 85000, level: 'warn', mode: 'approval' }]);

test('a new cart gets the type, the defaulted cost object and a warn snapshot', async () => {
  const r = await run(setup({ defaultCostObject: PRJ }), cart());
  expect(r).toEqual({ status: 200, actions: [{
    action: 'setCustomType', type: { typeId: 'type', key: 'bcc-order' },
    fields: { bccBudgetStatus: 'warn', bccBudgetExceeded: false, bccBudgetScopes: warnScopes, bccCheckedAt: now, bccCostObject: PRJ },
  }] });
});
test('nothing changed: no actions', async () => {
  const fields = { bccCostObject: PRJ, bccBudgetStatus: 'warn', bccBudgetExceeded: false, bccBudgetScopes: warnScopes, bccCheckedAt: '2026-11-01T00:00:00.000Z' };
  expect(await run(setup(), cart({}, fields))).toEqual({ status: 200, actions: [] });
});
test('over budget with a covered buyer goes to approval', async () => {
  const f = fieldsOf(await run(setup(), cart({ totalPrice: eur(40000) }, { bccCostObject: PRJ })));
  expect([f.bccBudgetStatus, f.bccBudgetExceeded]).toEqual(['exceeded', true]);
});
test('over budget with an uncovered buyer is blocked', async () => {
  const f = fieldsOf(await run(setup(), cart({ customerId: 'cust-2', totalPrice: eur(40000) }, { bccCostObject: PRJ })));
  expect([f.bccBudgetStatus, f.bccBudgetExceeded]).toEqual(['blocked', false]);
});
test('a closed project fails the cart update', async () => {
  const p = setup();
  (p.objects[1]!.value as { project: { status: string } }).project.status = 'closed';
  expect(await run(p, cart({}, { bccCostObject: PRJ }))).toEqual({ status: 400, message: 'Project PRJ-1001 is closed and cannot be ordered against.' });
});
test('an invisible default is ignored', async () => {
  const f = fieldsOf(await run(setup({ defaultCostObject: 'unit-b~CC-1' }), cart()));
  expect(f.bccCostObject).toBeUndefined();
  expect(f.bccBudgetStatus).toBe('ok');
});
test('a required cost object that is missing gives status none', async () => {
  expect(fieldsOf(await run(setup({ costObjectRequired: true }), cart())).bccBudgetStatus).toBe('none');
});
test('a foreign cart type fails with the misconfiguration', async () => {
  const r = await run(setup(), { ...cart(), custom: { type: { id: 'type-shop' }, fields: {} } });
  expect(r.status).toBe(400);
  expect(r.status === 400 && r.message).toMatch(/not configured for budgets/);
});
test('a failing order query routes a covered buyer to approval', async () => {
  const p = setup();
  p.failWith.queryOrders = new Error('503');
  const f = fieldsOf(await run(p, cart({}, { bccCostObject: PRJ })));
  expect([f.bccBudgetStatus, f.bccBudgetExceeded, f.bccBudgetScopes]).toEqual(['exceeded', true, '{"error":"unchecked"}']);
});
test('a failing order query blocks an uncovered buyer', async () => {
  const p = setup();
  p.failWith.queryOrders = new Error('503');
  expect(fieldsOf(await run(p, cart({ customerId: 'cust-2' }, { bccCostObject: PRJ }))).bccBudgetStatus).toBe('blocked');
});
test('a hanging order query answers within the time budget', async () => {
  const p = setup();
  p.hang.queryOrders = true;
  const started = Date.now();
  const f = fieldsOf(await run(p, cart({}, { bccCostObject: PRJ }), 50));
  expect(Date.now() - started).toBeLessThan(300);
  expect(f.bccBudgetScopes).toBe('{"error":"unchecked"}');
});
test('a hanging unit read blocks, since coverage is unknown', async () => {
  const p = setup();
  p.hang.getBusinessUnit = true;
  expect(fieldsOf(await run(p, cart({}, { bccCostObject: PRJ }), 50)).bccBudgetStatus).toBe('blocked');
});
test('a corrupt budget record is unchecked, never ok', async () => {
  const p = setup();
  p.objects[2]!.value = { ...(p.objects[2]!.value as object), amount: 'lots' };
  expect(fieldsOf(await run(p, cart({}, { bccCostObject: PRJ }))).bccBudgetScopes).toBe('{"error":"unchecked"}');
});
test('a budget whose key owner differs from its value owner is unchecked', async () => {
  const p = setup();
  p.objects[2]!.key = 'unit-b~Q4-PRJ-1001';
  expect(fieldsOf(await run(p, cart({}, { bccCostObject: PRJ }))).bccBudgetScopes).toBe('{"error":"unchecked"}');
});
test('a project cart is kept for the configured retention', async () => {
  const r = await run(setup(), cart({ deleteDaysAfterLastModification: 90 }, { bccCostObject: PRJ }));
  expect(r.status === 200 && r.actions).toContainEqual({ action: 'setDeleteDaysAfterLastModification', deleteDaysAfterLastModification: 365 });
});
test('a USD cart skips the EUR budget for currency', async () => {
  const f = fieldsOf(await run(setup(), cart({ totalPrice: { currencyCode: 'USD', centAmount: 15000 } }, { bccCostObject: PRJ })));
  expect(JSON.parse(f.bccBudgetScopes as string)).toEqual([{ key: BUDGET, skipped: 'currency' }]);
  expect(f.bccBudgetStatus).toBe('ok');
});
test('a cart without a Business Unit is left alone', async () => {
  expect(await run(setup(), cart({ businessUnit: undefined }))).toEqual({ status: 200, actions: [] });
});
test('a missing configured type fails the cart update (review C1)', async () => {
  const p = setup();
  p.types = {};
  expect(await run(p, cart())).toEqual({ status: 400, message: 'The budget check is not set up: the Custom Type bcc-order is missing.' });
});
test('a failing type lookup fails the update instead of keeping a stale snapshot (review C1)', async () => {
  const p = setup();
  p.failWith.typeIdByKey = new Error('503');
  const stale = { bccCostObject: PRJ, bccBudgetStatus: 'ok', bccBudgetExceeded: false, bccBudgetScopes: '[]', bccCheckedAt: now };
  expect(await run(p, cart({ totalPrice: eur(500000) }, stale))).toEqual({ status: 400, message: 'The budget check is not available right now. Please try again.' });
});
test('type lookup and evaluation share one time budget (review I2)', async () => {
  const p = setup();
  const slow = p.typeIdByKey.bind(p);
  p.typeIdByKey = async (key) => {
    await new Promise((r) => setTimeout(r, 150));
    return slow(key);
  };
  p.hang.queryOrders = true;
  const started = Date.now();
  const f = fieldsOf(await run(p, cart({}, { bccCostObject: PRJ }), 200));
  expect(Date.now() - started).toBeLessThan(300);
  expect(f.bccBudgetScopes).toBe('{"error":"unchecked"}');
});
test('a recreated type is re-resolved once instead of being called foreign (review M7)', async () => {
  const p = setup();
  expect(fieldsOf(await run(p, cart())).bccBudgetStatus).toBe('ok');
  p.types['bcc-order'] = 'type-order-new';
  const r = await run(p, { ...cart(), custom: { type: { id: 'type-order-new' }, fields: { bccCostObject: PRJ } } });
  expect(r.status).toBe(200);
});

// [BCC-CART-12]
test('the cost object and the unit budgets are requested before the unit read answers [BCC-CART-12]', async () => {
  const p = setup();
  p.hang.getBusinessUnit = true;
  void run(p, cart({}, { bccCostObject: PRJ }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const methods = p.calls.map((c) => c.method);
  expect(methods).toContain('getCustomObjects');
  expect(p.calls.find((c) => c.method === 'queryBudgets')?.arg).toEqual(['unit-a']);
});
test('a failing prefetched read does not leave an unhandled rejection [BCC-CART-12]', async () => {
  const p = setup();
  p.failWith.queryBudgets = new Error('boom');
  const seen: unknown[] = [];
  const onRejection = (e: unknown) => seen.push(e);
  process.on('unhandledRejection', onRejection);
  const r = await run(p, cart({}, { bccCostObject: 'unit-a~MISSING' }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  process.off('unhandledRejection', onRejection);
  expect(r.status).toBe(400);
  expect(seen).toEqual([]);
});
test('a division cart on the parent unit cost object sees the budgets of both units [BCC-CART-12]', async () => {
  const p = setup();
  p.units.push({ key: 'unit-a1', parentUnit: { key: 'unit-a' }, approvalRuleMode: 'ExplicitAndFromParent', associates: [], inheritedAssociates: p.units[0]!.associates });
  const r = await run(p, cart({ businessUnit: { key: 'unit-a1' } }, { bccCostObject: PRJ }));
  expect(fieldsOf(r).bccBudgetScopes).toBe(warnScopes);
  expect(p.calls.filter((c) => c.method === 'queryBudgets').map((c) => c.arg)).toEqual([['unit-a1'], ['unit-a']]);
});
