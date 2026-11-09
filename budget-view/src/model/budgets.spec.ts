// Budget form for the four scope kinds, with defaults from the settings. [BCC-VIEW-3] [BCC-BUDGET-1] [BCC-BUDGET-3]
// [BCC-BUDGET-5] [BCC-BUDGET-6] [BCC-BUDGET-8] [BCC-BUDGET-9]
import { type Budget, DEFAULT_SETTINGS, type ScopeKind } from '../core';
import {
  budgetFormDefaults,
  budgetFromForm,
  formatAmount,
  formFromBudget,
  generatedBudgetId,
  parseAmount,
  scopeRefLabel,
  sortedBudgets,
  withScopeKind,
} from './budgets';

const NOW = '2026-11-02T10:00:00.000Z';
const defaults = () =>
  budgetFormDefaults({ ...DEFAULT_SETTINGS, defaultMode: 'warn' }, NOW);

describe('budgetFormDefaults', () => {
  it('takes the mode from the settings, warns at 80 and starts this month', () => {
    expect(defaults()).toEqual(
      expect.objectContaining({
        mode: 'warn',
        warnAtPercent: '80',
        periodKind: 'month',
        from: '2026-11-01',
        to: '',
        currencyCode: 'EUR',
        active: true,
      })
    );
  });
});

describe('budgetFromForm', () => {
  it.each<[ScopeKind, string, Budget['scope']]>([
    [
      'cost-object',
      'unit-a~PRJ-1001',
      { kind: 'cost-object', ref: 'unit-a~PRJ-1001' },
    ],
    ['business-unit', 'ignored', { kind: 'business-unit', ref: 'unit-a' }],
    ['role', 'buyer', { kind: 'role', ref: 'buyer' }],
    ['associate', 'customer-1', { kind: 'associate', ref: 'customer-1' }],
  ])('builds a %s budget', (kind, ref, scope) => {
    const form = {
      ...withScopeKind(defaults(), kind, 'unit-a'),
      id: 'b-1',
      amount: '2,000',
    };
    const r = budgetFromForm('unit-a', {
      ...form,
      scopeRef: kind === 'business-unit' ? form.scopeRef : ref,
    });
    expect(r).toEqual({
      ok: true,
      value: {
        key: 'unit-a~b-1',
        value: {
          scope,
          ownerBusinessUnitKey: 'unit-a',
          amount: { currencyCode: 'EUR', centAmount: 200000 },
          period: { kind: 'month', from: '2026-11-01' },
          mode: 'warn',
          warnAtPercent: 80,
          active: true,
        },
      },
    });
  });

  it('keeps role overrides of the mode and drops empty ones', () => {
    const r = budgetFromForm('unit-a', {
      ...defaults(),
      id: 'b-2',
      scopeKind: 'business-unit',
      scopeRef: 'unit-a',
      amount: '10000.50',
      modeByRole: { 'purchasing-manager': 'block', buyer: '' },
    });
    expect(r.ok && r.value.value.modeByRole).toEqual({
      'purchasing-manager': 'block',
    });
    expect(r.ok && r.value.value.amount.centAmount).toBe(1000050);
  });

  it('shows core errors for a cost object of another unit and a period off the boundary', () => {
    const r = budgetFromForm('unit-a', {
      ...defaults(),
      id: 'b-3',
      scopeKind: 'cost-object',
      scopeRef: 'unit-b~CC-1',
      amount: '100',
      periodKind: 'year',
      from: '2026-03-01',
    });
    expect(!r.ok && r.errors.map((e) => e.field).sort()).toEqual([
      'period',
      'scope',
    ]);
  });

  it('rejects an amount that is not a number with two decimals at most', () => {
    const r = budgetFromForm('unit-a', {
      ...defaults(),
      scopeKind: 'role',
      scopeRef: 'buyer',
      amount: '12.345',
    });
    expect(!r.ok && r.errors).toEqual([
      expect.objectContaining({ field: 'amount' }),
    ]);
  });

  it('rejects an id that is not a valid code', () => {
    const r = budgetFromForm('unit-a', {
      ...defaults(),
      id: 'has space',
      scopeKind: 'role',
      scopeRef: 'buyer',
      amount: '1',
    });
    expect(!r.ok && r.errors.map((e) => e.field)).toEqual(['id']);
  });

  it('generates an id when none is entered', () => {
    const form = {
      ...defaults(),
      scopeKind: 'cost-object' as const,
      scopeRef: 'unit-a~PRJ-1001',
      amount: '1',
    };
    const r = budgetFromForm('unit-a', form);
    expect(r.ok && r.value.key).toBe(
      'unit-a~cost-object-PRJ-1001-month-2026-11-01'
    );
    expect(
      generatedBudgetId({
        ...form,
        scopeKind: 'associate',
        scopeRef: 'x'.repeat(80),
      })
    ).toHaveLength(64);
  });
});

describe('formFromBudget', () => {
  it('round-trips a stored budget', () => {
    const value: Budget = {
      scope: { kind: 'role', ref: 'buyer' },
      ownerBusinessUnitKey: 'unit-a',
      amount: { currencyCode: 'EUR', centAmount: 200050 },
      period: { kind: 'quarter', from: '2026-10-01', to: '2026-12-31' },
      mode: 'approval',
      modeByRole: { 'purchasing-manager': 'warn' },
      warnAtPercent: 90,
      active: true,
    };
    const form = formFromBudget('unit-a~limit-1', value);
    expect(form.id).toBe('limit-1');
    expect(form.amount).toBe('2000.50');
    expect(budgetFromForm('unit-a', form)).toEqual({
      ok: true,
      value: { key: 'unit-a~limit-1', value },
    });
  });
});

describe('parseAmount', () => {
  it.each([
    ['1000', 100000],
    ['1,000.5', 100050],
    [' 0.99 ', 99],
    ['', undefined],
    ['-1', undefined],
    ['1.234', undefined],
  ])('%s', (input, cents) => expect(parseAmount(input, 'EUR')).toBe(cents));
});

describe('review findings', () => {
  it('finding 6: parses and formats amounts in the currency minor unit [BCC-BUDGET-1]', () => {
    expect(parseAmount('100000', 'JPY')).toBe(100000);
    expect(parseAmount('100,000', 'JPY')).toBe(100000);
    expect(parseAmount('100.5', 'JPY')).toBeUndefined();
    expect(parseAmount('1.234', 'KWD')).toBe(1234);
    expect(parseAmount('1.5', 'EUR')).toBe(150);
    expect(formatAmount(100000, 'JPY')).toBe('100000');
    expect(formatAmount(1234, 'KWD')).toBe('1.234');
    expect(formatAmount(200050, 'EUR')).toBe('2000.50');
    const r = budgetFromForm('unit-a', {
      ...defaults(),
      scopeKind: 'role',
      scopeRef: 'buyer',
      amount: '100000',
      currencyCode: 'jpy',
    });
    expect(r.ok && r.value.value.amount).toEqual({
      currencyCode: 'JPY',
      centAmount: 100000,
    });
    const jpy = formFromBudget('unit-a~yen', {
      ...(r.ok ? r.value.value : ({} as Budget)),
    });
    expect(jpy.amount).toBe('100000');
  });

  it('finding 7: returns the amount error as a message descriptor, not English text', () => {
    const r = budgetFromForm('unit-a', {
      ...defaults(),
      scopeKind: 'role',
      scopeRef: 'buyer',
      amount: 'abc',
    });
    expect(!r.ok && r.errors[0]).toEqual({
      field: 'amount',
      message: expect.objectContaining({ id: expect.any(String) }),
      values: expect.any(Object),
    });
  });
});

describe('scopeRefLabel', () => {
  const b = (kind: ScopeKind, ref: string) =>
    ({ scope: { kind, ref } } as Budget);
  const ctx = {
    roles: [{ key: 'buyer', name: 'Buyer', permissions: [] }],
    people: [
      { customerId: 'c-1', label: 'Ada Lane (ada@example.com)', roles: [] },
    ],
  };
  it('names the scope reference for people', () => {
    expect(scopeRefLabel(b('cost-object', 'unit-a~PRJ-1'), ctx)).toBe('PRJ-1');
    expect(scopeRefLabel(b('business-unit', 'unit-a'), ctx)).toBe('unit-a');
    expect(scopeRefLabel(b('role', 'buyer'), ctx)).toBe('Buyer');
    expect(scopeRefLabel(b('role', 'gone'), ctx)).toBe('gone');
    expect(scopeRefLabel(b('associate', 'c-1'), ctx)).toBe(
      'Ada Lane (ada@example.com)'
    );
  });
});

describe('sortedBudgets', () => {
  it('lists active budgets first, then by key', () => {
    const r = (key: string, active: boolean) => ({
      key,
      version: 1,
      value: { active } as Budget,
    });
    expect(
      sortedBudgets([r('u~b', true), r('u~a', false), r('u~c', true)]).map(
        (x) => x.key
      )
    ).toEqual(['u~b', 'u~c', 'u~a']);
  });
});
