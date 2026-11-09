// [BCC-SPEND-4]
import type { Budget } from '../src/budget';
import type { OrderLike } from '../src/consumption';
import type { CostObject } from '../src/cost-object';
import { spendReport, toCsv } from '../src/report';

const eur = (centAmount: number) => ({ currencyCode: 'EUR', centAmount });
const interval = { from: '2026-10-01T00:00:00.000Z', to: '2026-12-31T23:59:59.999Z' };
const co = (code: string, extra: Partial<CostObject> = {}) => ({
  key: `unit-a~${code}`,
  value: { code, name: code, type: 'cost-center', ownerBusinessUnitKey: 'unit-a', active: true, ...extra } as CostObject,
});
const budget = (ref: string, centAmount: number) => ({
  key: `unit-a~b-${ref}`,
  value: {
    scope: { kind: 'cost-object', ref },
    ownerBusinessUnitKey: 'unit-a',
    amount: eur(centAmount),
    period: { kind: 'quarter', from: '2026-01-01' },
    mode: 'approval',
    warnAtPercent: 80,
    active: true,
  } as Budget,
});
const order = (id: string, costObject: string, total = eur(70000)): OrderLike => ({
  id,
  createdAt: '2026-11-01T09:00:00.000Z',
  orderState: 'Open',
  customerId: 'cust-1',
  businessUnit: { key: 'unit-a' },
  totalPrice: total,
  custom: { fields: { bccCostObject: costObject } },
});

const input = {
  unitKey: 'unit-a',
  interval,
  costObjects: [co('PRJ-1001', { type: 'project', externalId: 'ERP-7', project: { status: 'active' } }), co('CC-100'), co('CC-200')],
  budgets: [budget('unit-a~PRJ-1001', 1000000), budget('unit-a~CC-100', 200000)],
  orders: [
    order('o-1', 'unit-a~PRJ-1001'),
    order('o-2', 'unit-a~PRJ-1001', eur(30000)),
    order('o-3', 'unit-a~CC-100', { currencyCode: 'USD', centAmount: 5000 }),
  ],
};

test('one row per cost object in code order, with budget, consumed and remaining', () => {
  const { rows } = spendReport(input);
  expect(rows.map((r) => r.costObject)).toEqual(['CC-100', 'CC-200', 'PRJ-1001']);
  expect(rows[2]).toEqual({
    unit: 'unit-a',
    costObject: 'PRJ-1001',
    type: 'project',
    externalId: 'ERP-7',
    period: '2026-10-01..2026-12-31',
    budget: 'EUR 10000.00',
    consumed: 'EUR 1000.00',
    remaining: 'EUR 9000.00',
    orderCount: 2,
  });
});
test('a cost object without a budget has empty budget and remaining', () => {
  const row = spendReport(input).rows[1];
  expect(row).toMatchObject({ costObject: 'CC-200', budget: '', remaining: '', orderCount: 0 });
});
test('orders in another currency are counted separately', () => {
  const r = spendReport(input);
  expect(r.otherCurrencyOrders).toBe(1);
  expect(r.rows[0]).toMatchObject({ consumed: 'EUR 0.00', orderCount: 0 });
});
test('CSV header, RFC 4180 quoting and CRLF', () => {
  const csv = toCsv([{ ...spendReport(input).rows[0]!, externalId: 'A, "B"' }]);
  const lines = csv.split('\r\n');
  expect(lines[0]).toBe('unit,cost object,type,externalId,period,budget,consumed,remaining,order count');
  expect(lines[1]).toBe('unit-a,CC-100,cost-center,"A, ""B""",2026-10-01..2026-12-31,EUR 2000.00,EUR 0.00,EUR 2000.00,0');
  expect(csv.endsWith('\r\n')).toBe(true);
});

test('only budgets whose period matches the report interval are shown, one row per budget (review fix)', () => {
  const year = { key: 'unit-a~b-year', value: { ...budget('unit-a~PRJ-1001', 4000000).value, period: { kind: 'year', from: '2026-01-01' } } as Budget };
  const q1 = { key: 'unit-a~b-q1', value: { ...budget('unit-a~CC-100', 50000).value, period: { kind: 'range', from: '2026-01-01', to: '2026-03-31' } } as Budget };
  const rows = spendReport({ ...input, budgets: [...input.budgets, year], costObjects: input.costObjects }).rows;
  expect(rows.filter((r) => r.costObject === 'PRJ-1001').map((r) => r.budget)).toEqual(['EUR 10000.00']);
  const q1Only = spendReport({ ...input, budgets: [q1] }).rows.find((r) => r.costObject === 'CC-100');
  expect(q1Only).toMatchObject({ budget: '', remaining: '' });
  const two = { key: 'unit-a~b-two', value: { ...budget('unit-a~PRJ-1001', 500000).value, mode: 'block' } as Budget };
  expect(spendReport({ ...input, budgets: [...input.budgets, two] }).rows.filter((r) => r.costObject === 'PRJ-1001').map((r) => r.budget)).toEqual([
    'EUR 10000.00',
    'EUR 5000.00',
  ]);
});

test('CSV cells that start a formula are neutralised (review fix)', () => {
  const csv = toCsv([{ ...spendReport(input).rows[0]!, externalId: '=HYPERLINK("x")' }]);
  expect(csv.split('\r\n')[1]).toContain(`"'=HYPERLINK(""x"")"`);
});

test('a cost object without a budget reports in the currency of its own orders (view review)', () => {
  const usd = (centAmount: number) => ({ currencyCode: 'USD', centAmount });
  const r = spendReport({
    unitKey: 'unit-a',
    interval,
    costObjects: [co('CC-300')],
    budgets: [budget('unit-a~PRJ-1001', 1000000)],
    orders: [order('o-9', 'unit-a~CC-300', usd(4000)), order('o-10', 'unit-a~CC-300', usd(1000))],
  });
  expect(r.rows[0]?.consumed).toBe('USD 50.00');
  expect(r.otherCurrencyOrders).toBe(0);
});

test('money cells start with the currency, so a negative remainder is not read as a formula (view review)', () => {
  const r = spendReport({ ...input, orders: [order('o-1', 'unit-a~CC-100', eur(250000))] });
  const cc = r.rows.find((x) => x.costObject === 'CC-100');
  expect(cc?.remaining).toBe('EUR -500.00');
  expect(cc?.budget).toBe('EUR 2000.00');
});
