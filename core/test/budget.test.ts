// [BCC-BUDGET-1] [BCC-BUDGET-2] [BCC-BUDGET-7]
import { type Budget, deactivateBudget, validateBudget } from '../src/budget';

const b: Budget = {
  scope: { kind: 'cost-object', ref: 'unit-a~PRJ-1001' },
  ownerBusinessUnitKey: 'unit-a',
  amount: { currencyCode: 'EUR', centAmount: 1000000 },
  period: { kind: 'quarter', from: '2026-01-01' },
  mode: 'approval',
  warnAtPercent: 80,
  active: true,
};
const { warnAtPercent: _omit, ...withoutWarn } = b;
const fields = (r: ReturnType<typeof validateBudget>) => (r.ok ? [] : r.errors.map((e) => e.field));

test('valid project budget gets warnAtPercent 80 by default', () =>
  expect(validateBudget(withoutWarn)).toEqual({ ok: true, value: b }));
test('negative amount', () => expect(fields(validateBudget({ ...b, amount: { currencyCode: 'EUR', centAmount: -1 } }))).toEqual(['amount']));
test('fractional cent amount', () => expect(fields(validateBudget({ ...b, amount: { currencyCode: 'EUR', centAmount: 10.5 } }))).toEqual(['amount']));
test('currency code must be three upper-case letters', () =>
  expect(fields(validateBudget({ ...b, amount: { currencyCode: 'euro', centAmount: 1 } }))).toEqual(['amount']));
test('zero amount is allowed', () => expect(validateBudget({ ...b, amount: { currencyCode: 'EUR', centAmount: 0 } }).ok).toBe(true));
test('range needs to', () => expect(fields(validateBudget({ ...b, period: { kind: 'range', from: '2026-01-01' } }))).toEqual(['period']));
test('to before from', () =>
  expect(fields(validateBudget({ ...b, period: { kind: 'month', from: '2026-06-01', to: '2026-01-31' } }))).toEqual(['period']));
test('unknown role mode', () => expect(fields(validateBudget({ ...b, modeByRole: { buyer: 'stop' } }))).toEqual(['modeByRole']));
test('unknown scope kind', () => expect(fields(validateBudget({ ...b, scope: { kind: 'team', ref: 'x' } }))).toEqual(['scope']));
test('warnAtPercent out of range', () => expect(fields(validateBudget({ ...b, warnAtPercent: 120 }))).toEqual(['warnAtPercent']));
test('non-objects are rejected without throwing', () => {
  expect(validateBudget(null).ok).toBe(false);
  expect(validateBudget('x').ok).toBe(false);
  expect(validateBudget({ ...b, amount: 'x', period: null }).ok).toBe(false);
});
test('deactivate keeps the record', () => expect(deactivateBudget(b)).toEqual({ ...b, active: false }));

// [BCC-BUDGET-9]
describe('calendar periods must align (review fix)', () => {
  test.each([
    [{ kind: 'year', from: '2026-03-01' }],
    [{ kind: 'quarter', from: '2026-02-01' }],
    [{ kind: 'month', from: '2026-01-05' }],
    [{ kind: 'month', from: '2026-01-01', to: '2026-01-20' }],
    [{ kind: 'quarter', from: '2026-01-01', to: '2026-05-31' }],
  ])('%o is rejected on period', (period) => expect(fields(validateBudget({ ...b, period }))).toEqual(['period']));
  test.each([
    [{ kind: 'year', from: '2026-01-01', to: '2027-12-31' }],
    [{ kind: 'quarter', from: '2026-04-01', to: '2026-09-30' }],
    [{ kind: 'month', from: '2028-02-01', to: '2028-02-29' }],
  ])('%o is accepted', (period) => expect(validateBudget({ ...b, period }).ok).toBe(true));
});

describe('review minors', () => {
  test('cent amount beyond the safe integer range', () =>
    expect(fields(validateBudget({ ...b, amount: { currencyCode: 'EUR', centAmount: 2 ** 53 } }))).toEqual(['amount']));
  test('a business-unit budget covers its own unit only', () =>
    expect(fields(validateBudget({ ...b, scope: { kind: 'business-unit', ref: 'unit-b' } }))).toEqual(['scope']));
  test('a cost-object budget belongs to the cost object owner', () =>
    expect(fields(validateBudget({ ...b, scope: { kind: 'cost-object', ref: 'unit-b~CC-1' } }))).toEqual(['scope']));
  test('a cost-object reference must be a record key', () =>
    expect(fields(validateBudget({ ...b, scope: { kind: 'cost-object', ref: 'PRJ-1001' } }))).toEqual(['scope']));
  test('role and associate refs are not tied to the owner key', () =>
    expect(validateBudget({ ...b, scope: { kind: 'role', ref: 'buyer' } }).ok).toBe(true));
});
