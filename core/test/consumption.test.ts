// [BCC-SPEND-1] [BCC-SPEND-2] [BCC-SPEND-3]
import type { Budget } from '../src/budget';
import { amountOf, consumed, countsToward, type OrderLike, projected } from '../src/consumption';
import type { ApplicableScope, CheckContext } from '../src/scopes';

const eur = (centAmount: number) => ({ currencyCode: 'EUR', centAmount });
const interval = { from: '2026-10-01T00:00:00.000Z', to: '2026-12-31T23:59:59.999Z' };
const ctx: CheckContext = { unitKey: 'unit-a', costObjectKey: 'unit-a~PRJ-1001', customerId: 'cust-1', buyerRoles: ['buyer'], currencyCode: 'EUR', at: '2026-11-02T10:00:00Z' };
const scope = (kind: Budget['scope']['kind'], ref: string): ApplicableScope => ({
  key: `unit-a~${kind}`,
  interval,
  budget: { scope: { kind, ref }, ownerBusinessUnitKey: 'unit-a', amount: eur(100000), period: { kind: 'quarter', from: '2026-01-01' }, mode: 'approval', warnAtPercent: 80, active: true },
});
const order = (patch: Partial<OrderLike> = {}, fields: Record<string, unknown> = {}): OrderLike => ({
  id: 'o-1',
  createdAt: '2026-11-01T09:00:00.000Z',
  orderState: 'Open',
  customerId: 'cust-1',
  businessUnit: { key: 'unit-a' },
  totalPrice: eur(70000),
  custom: { fields: { bccCostObject: 'unit-a~PRJ-1001', ...fields } },
  ...patch,
});
const unitScope = scope('business-unit', 'unit-a');

describe('amountOf', () => {
  test('net from taxedPrice', () => expect(amountOf({ totalPrice: eur(132000), taxedPrice: { totalNet: eur(110000) } })).toEqual(eur(110000)));
  test('totalPrice without taxedPrice', () => expect(amountOf({ totalPrice: eur(132000) })).toEqual(eur(132000)));
});

describe('countsToward', () => {
  test('a normal order counts', () => expect(countsToward(order(), unitScope, ctx)).toBe(true));
  test('cancelled', () => expect(countsToward(order({ orderState: 'Cancelled' }), unitScope, ctx)).toBe(false));
  test('rejected approval', () => expect(countsToward(order({}, { bccApprovalStatus: 'rejected' }), unitScope, ctx)).toBe(false));
  test('pending approval counts', () => expect(countsToward(order({}, { bccApprovalStatus: 'pending' }), unitScope, ctx)).toBe(true));
  test('other currency', () => expect(countsToward(order({ totalPrice: { currencyCode: 'USD', centAmount: 1 } }), unitScope, ctx)).toBe(false));
  test('period edges', () => {
    expect(countsToward(order({ createdAt: '2026-10-01T00:00:00.000Z' }), unitScope, ctx)).toBe(true);
    expect(countsToward(order({ createdAt: '2026-09-30T23:59:59.999Z' }), unitScope, ctx)).toBe(false);
    expect(countsToward(order({ createdAt: '2027-01-01T00:00:00.000Z' }), unitScope, ctx)).toBe(false);
  });
  test('cost-object scope counts the key from any unit', () => {
    const s = scope('cost-object', 'unit-a~PRJ-1001');
    expect(countsToward(order({ businessUnit: { key: 'division-a1' } }), s, ctx)).toBe(true);
    expect(countsToward(order({}, { bccCostObject: 'unit-a~CC-100' }), s, ctx)).toBe(false);
  });
  test('business-unit scope counts exactly that unit', () =>
    expect(countsToward(order({ businessUnit: { key: 'division-a1' } }), unitScope, ctx)).toBe(false));
  test('role and associate scopes count only the buyer orders in the owner unit', () => {
    for (const s of [scope('role', 'buyer'), scope('associate', 'cust-1')]) {
      expect(countsToward(order(), s, ctx)).toBe(true);
      expect(countsToward(order({ customerId: 'cust-2' }), s, ctx)).toBe(false);
      expect(countsToward(order({ businessUnit: { key: 'division-a1' } }), s, ctx)).toBe(false);
    }
  });
});

test('consumed sums counting orders', () =>
  expect(consumed([order(), order({ id: 'o-2', totalPrice: eur(30000) }), order({ id: 'o-3', orderState: 'Cancelled' })], unitScope, ctx)).toEqual({
    amount: eur(100000),
    orderCount: 2,
  }));
test('projected adds the cart', () => expect(projected(eur(70000), { totalPrice: eur(15000) })).toEqual(eur(85000)));

test('an order with an unparseable createdAt does not count (review minor)', () =>
  expect(countsToward(order({ createdAt: 'garbage' }), unitScope, ctx)).toBe(false));
