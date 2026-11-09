// [BCC-BUDGET-4]
import { periodInEffect } from '../src/period';

const m = { kind: 'month', from: '2026-01-01' } as const;

test('monthly', () =>
  expect(periodInEffect(m, '2026-03-15T10:00:00Z')).toEqual({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' }));
test('quarter', () =>
  expect(periodInEffect({ kind: 'quarter', from: '2026-01-01' }, '2026-11-02T00:00:00Z')).toEqual({
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-12-31T23:59:59.999Z',
  }));
test('year', () =>
  expect(periodInEffect({ kind: 'year', from: '2026-01-01' }, '2026-12-31T23:59:59.999Z')).toEqual({
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-12-31T23:59:59.999Z',
  }));
test('leap February', () => expect(periodInEffect(m, '2028-02-29T12:00:00Z')?.to).toBe('2028-02-29T23:59:59.999Z'));
test('before start', () => expect(periodInEffect(m, '2025-12-31T23:59:59Z')).toBeNull());
test('after to', () => expect(periodInEffect({ kind: 'month', from: '2026-01-01', to: '2026-06-30' }, '2026-07-01T00:00:00Z')).toBeNull());
test('last month inside to', () =>
  expect(periodInEffect({ kind: 'month', from: '2026-01-01', to: '2026-06-30' }, '2026-06-30T23:59:59.999Z')?.from).toBe(
    '2026-06-01T00:00:00.000Z',
  ));
test('mid-month from: the first month does not apply', () =>
  expect(periodInEffect({ kind: 'month', from: '2026-01-15' }, '2026-01-20T00:00:00Z')).toBeNull());
test('range', () =>
  expect(periodInEffect({ kind: 'range', from: '2026-01-01', to: '2026-06-30' }, '2026-06-30T23:59:59.999Z')).toEqual({
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-06-30T23:59:59.999Z',
  }));
test('range over', () => expect(periodInEffect({ kind: 'range', from: '2026-01-01', to: '2026-06-30' }, '2026-07-01T00:00:00Z')).toBeNull());

test('an unparseable instant has no period in effect (review minor)', () => {
  expect(periodInEffect(m, 'garbage')).toBeNull();
  expect(periodInEffect({ kind: 'range', from: '2026-01-01', to: '2026-12-31' }, 'garbage')).toBeNull();
});
