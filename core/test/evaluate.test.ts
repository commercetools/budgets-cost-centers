// [BCC-BUDGET-5] [BCC-BUDGET-6] [BCC-CART-5] [BCC-CART-6] [BCC-CART-8] [BCC-APPR-2]
import type { Budget } from '../src/budget';
import { cartOutcome, effectiveMode, type ScopeResult, scopeLevel, uncheckedOutcome } from '../src/evaluate';

describe('scopeLevel', () => {
  test.each([
    [100000, 85000, 80, 'warn'],
    [100000, 79999, 80, 'ok'],
    [100000, 100000, 80, 'warn'],
    [100000, 100001, 80, 'exceeded'],
    [0, 0, 80, 'ok'],
    [0, 1, 80, 'exceeded'],
  ])('amount %i, projected %i, warn at %i%% is %s', (amount, projected, warnAt, level) =>
    expect(scopeLevel(amount, projected, warnAt)).toBe(level));
});

describe('effectiveMode', () => {
  const b = (mode: Budget['mode'], modeByRole?: Budget['modeByRole']) => ({ mode, modeByRole }) as Budget;
  test('role relaxes the mode', () =>
    expect(effectiveMode(b('block', { 'purchasing-manager': 'warn' }), ['purchasing-manager'], ['purchasing-manager'])).toBe('warn'));
  test('strictest of two overriding roles', () =>
    expect(effectiveMode(b('block', { r1: 'warn', r2: 'approval' }), ['r1', 'r2'], ['r1', 'r2'])).toBe('approval'));
  test('no overriding role keeps the budget mode', () => expect(effectiveMode(b('warn', { r1: 'block' }), ['buyer'], ['buyer'])).toBe('warn'));
  test('fail-safe: approval without a covered role becomes block', () =>
    expect(effectiveMode(b('approval'), ['site-buyer'], ['buyer'])).toBe('block'));
  test('approval with a covered role stays approval', () =>
    expect(effectiveMode(b('approval'), ['site-buyer'], ['site-buyer'])).toBe('approval'));
  test('fail-safe also applies to a role override to approval', () =>
    expect(effectiveMode(b('warn', { 'site-buyer': 'approval' }), ['site-buyer'], [])).toBe('block'));
});

describe('cartOutcome', () => {
  const r = (level: ScopeResult['level'], mode: ScopeResult['mode']): ScopeResult => ({
    key: `k-${level}-${mode}`,
    kind: 'business-unit',
    amount: 100000,
    used: 0,
    projected: 0,
    level,
    mode,
  });
  const base = { costObjectRequired: false, costObjectKey: 'unit-a~CC-100', skipped: [] };
  test('block wins over warn', () =>
    expect(cartOutcome({ ...base, results: [r('exceeded', 'warn'), r('exceeded', 'block')] })).toMatchObject({ status: 'blocked', exceeded: false }));
  test('approval exceeded', () =>
    expect(cartOutcome({ ...base, results: [r('exceeded', 'approval'), r('warn', 'block')] })).toMatchObject({ status: 'exceeded', exceeded: true }));
  test('warn-mode exceeded is warn', () => expect(cartOutcome({ ...base, results: [r('exceeded', 'warn')] })).toMatchObject({ status: 'warn', exceeded: false }));
  test('warn level', () => expect(cartOutcome({ ...base, results: [r('warn', 'block')] }).status).toBe('warn'));
  test('no scopes is ok', () => expect(cartOutcome({ ...base, results: [] })).toEqual({ status: 'ok', exceeded: false, scopes: [] }));
  test('required cost object missing is none', () =>
    expect(cartOutcome({ ...base, costObjectRequired: true, costObjectKey: undefined, results: [r('exceeded', 'block')] }).status).toBe('none'));
  test('scopes carry results and skipped', () => {
    const skipped = [{ key: 'unit-a~usd', skipped: 'currency' as const }];
    expect(cartOutcome({ ...base, results: [r('ok', 'approval')], skipped }).scopes).toEqual([r('ok', 'approval'), ...skipped]);
  });
});

test('unchecked outcome routes to approval', () =>
  expect(uncheckedOutcome(true)).toEqual({ status: 'exceeded', exceeded: true, scopes: { error: 'unchecked' } }));

test('unchecked outcome blocks an uncovered buyer (review fix)', () =>
  expect(uncheckedOutcome(false)).toEqual({ status: 'blocked', exceeded: false, scopes: { error: 'unchecked' } }));

test('snapshot scopes are sorted by key across checked and skipped scopes', () => {
  const r = (key: string): ScopeResult => ({ key, kind: 'business-unit', amount: 100, used: 0, projected: 10, level: 'ok', mode: 'approval' });
  const out = cartOutcome({ costObjectRequired: false, results: [r('unit-a~c'), r('unit-a~a')], skipped: [{ key: 'unit-a~b', skipped: 'currency' }] });
  expect((out.scopes as Array<{ key: string }>).map((s) => s.key)).toEqual(['unit-a~a', 'unit-a~b', 'unit-a~c']);
});
