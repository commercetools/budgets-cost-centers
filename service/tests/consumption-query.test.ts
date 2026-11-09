// [BCC-SPEND-1] [BCC-BUDGET-3] [BCC-BUDGET-8]
import type { ApplicableScope, Budget, CheckContext } from 'budgets-cost-centers-core';
import { ordersWhere } from '../src/consumption-query';

const ctx: CheckContext = { unitKey: 'unit-a', costObjectKey: 'unit-a~PRJ-1001', customerId: 'cust-1', buyerRoles: ['buyer'], currencyCode: 'EUR', at: '2026-11-02T10:00:00Z' };
const interval = { from: '2026-10-01T00:00:00.000Z', to: '2026-12-31T23:59:59.999Z' };
const scope = (kind: Budget['scope']['kind'], ref: string): ApplicableScope => ({
  key: 'unit-a~b',
  interval,
  budget: { scope: { kind, ref }, ownerBusinessUnitKey: 'unit-a', amount: { currencyCode: 'EUR', centAmount: 1 }, period: { kind: 'quarter', from: '2026-01-01' }, mode: 'approval', warnAtPercent: 80, active: true },
});
const period = 'createdAt >= "2026-10-01T00:00:00.000Z" and createdAt <= "2026-12-31T23:59:59.999Z"';

test('cost-object scope', () =>
  expect(ordersWhere(scope('cost-object', 'unit-a~PRJ-1001'), ctx)).toBe(`custom(fields(bccCostObject="unit-a~PRJ-1001")) and ${period}`));
test('business-unit scope', () => expect(ordersWhere(scope('business-unit', 'unit-a'), ctx)).toBe(`businessUnit(key="unit-a") and ${period}`));
test.each(['role', 'associate'] as const)('%s scope covers the buyer in the owner unit', (kind) =>
  expect(ordersWhere(scope(kind, 'buyer'), ctx)).toBe(`businessUnit(key="unit-a") and customerId="cust-1" and ${period}`));
test('values are escaped', () =>
  expect(ordersWhere(scope('business-unit', 'a"b'), ctx)).toBe(`businessUnit(key="a\\"b") and ${period}`));
