// [BCC-BUDGET-3] [BCC-BUDGET-8] [BCC-CART-4] [BCC-BUDGET-7]
import type { Budget } from '../src/budget';
import { applicableScopes, type CheckContext } from '../src/scopes';

const ctx: CheckContext = {
  unitKey: 'unit-a',
  costObjectKey: 'unit-a~PRJ-1001',
  customerId: 'cust-1',
  buyerRoles: ['buyer'],
  currencyCode: 'EUR',
  at: '2026-11-02T10:00:00Z',
};
const budget = (kind: Budget['scope']['kind'], ref: string, patch: Partial<Budget> = {}): Budget => ({
  scope: { kind, ref },
  ownerBusinessUnitKey: 'unit-a',
  amount: { currencyCode: 'EUR', centAmount: 100000 },
  period: { kind: 'quarter', from: '2026-01-01' },
  mode: 'approval',
  warnAtPercent: 80,
  active: true,
  ...patch,
});
const keysOf = (c: CheckContext, budgets: Array<{ key: string; value: Budget }>) =>
  applicableScopes(c, budgets).scopes.map((s) => s.key).sort();

const project = { key: 'unit-a~b-prj', value: budget('cost-object', 'unit-a~PRJ-1001') };
const unit = { key: 'unit-a~b-unit', value: budget('business-unit', 'unit-a') };
const role = { key: 'unit-a~b-role', value: budget('role', 'buyer', { period: { kind: 'month', from: '2026-01-01' } }) };

test('cost object, unit and role scopes apply', () =>
  expect(keysOf(ctx, [project, unit, role])).toEqual(['unit-a~b-prj', 'unit-a~b-role', 'unit-a~b-unit']));
test('the interval in effect is attached', () =>
  expect(applicableScopes(ctx, [role]).scopes[0]?.interval).toEqual({ from: '2026-11-01T00:00:00.000Z', to: '2026-11-30T23:59:59.999Z' }));
test('a parent unit budget does not cover a division', () => expect(keysOf({ ...ctx, unitKey: 'division-a1' }, [unit])).toEqual([]));
test('a role limit of another unit does not apply', () =>
  expect(keysOf(ctx, [{ key: 'unit-b~r', value: budget('role', 'buyer', { ownerBusinessUnitKey: 'unit-b' }) }])).toEqual([]));
test('a role the buyer does not hold does not apply', () =>
  expect(keysOf(ctx, [{ key: 'unit-a~r2', value: budget('role', 'approver') }])).toEqual([]));
test('an associate limit replaces the role limits', () =>
  expect(keysOf(ctx, [project, unit, role, { key: 'unit-a~b-cust', value: budget('associate', 'cust-1') }])).toEqual([
    'unit-a~b-cust',
    'unit-a~b-prj',
    'unit-a~b-unit',
  ]));
test('an associate limit of another person does not apply', () =>
  expect(keysOf(ctx, [role, { key: 'unit-a~b-c2', value: budget('associate', 'cust-2') }])).toEqual(['unit-a~b-role']));
test('inactive budgets and budgets out of period are absent', () =>
  expect(
    keysOf(ctx, [
      { key: 'unit-a~off', value: budget('business-unit', 'unit-a', { active: false }) },
      { key: 'unit-a~old', value: budget('business-unit', 'unit-a', { period: { kind: 'range', from: '2025-01-01', to: '2025-12-31' } }) },
    ]),
  ).toEqual([]));
test('a budget in another currency is skipped for currency', () => {
  const usd = { key: 'unit-a~usd', value: budget('business-unit', 'unit-a', { amount: { currencyCode: 'USD', centAmount: 1 } }) };
  expect(applicableScopes(ctx, [usd])).toEqual({ scopes: [], skipped: [{ key: 'unit-a~usd', skipped: 'currency' }] });
});
test('no cost object on the cart: cost-object budgets do not apply', () =>
  expect(keysOf({ ...ctx, costObjectKey: undefined }, [project, unit])).toEqual(['unit-a~b-unit']));

test('an associate limit in another currency does not remove the role limits (review fix)', () => {
  const usdCust = { key: 'unit-a~b-cust-usd', value: budget('associate', 'cust-1', { amount: { currencyCode: 'USD', centAmount: 500000 } }) };
  const r = applicableScopes(ctx, [role, usdCust]);
  expect(r.scopes.map((s) => s.key)).toEqual(['unit-a~b-role']);
  expect(r.skipped).toEqual([{ key: 'unit-a~b-cust-usd', skipped: 'currency' }]);
});

test('scopes come sorted by key, independent of query order (review minor)', () =>
  expect(applicableScopes(ctx, [unit, role, project]).scopes.map((s) => s.key)).toEqual([
    'unit-a~b-prj',
    'unit-a~b-role',
    'unit-a~b-unit',
  ]));
