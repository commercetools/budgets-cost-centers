// Budget and limit form for the four scope kinds, on top of core's validation. [BCC-VIEW-3] [BCC-BUDGET-1]
// [BCC-BUDGET-3] [BCC-BUDGET-4] [BCC-BUDGET-5] [BCC-BUDGET-6] [BCC-BUDGET-8] [BCC-BUDGET-9]
import {
  type Budget,
  fractionDigits,
  type Mode,
  parseRecordKey,
  recordKey,
  type ScopeKind,
  type Settings,
  validateBudget,
} from '../core';
import type { ViewFieldError } from './errors';
import messages from './messages';

export type PeriodKind = Budget['period']['kind'];

export type BudgetForm = {
  // Empty: generated from scope and period.
  id: string;
  scopeKind: ScopeKind;
  scopeRef: string;
  amount: string;
  currencyCode: string;
  periodKind: PeriodKind;
  from: string;
  to: string;
  mode: Mode;
  // '' means no override for that role.
  modeByRole: Record<string, Mode | ''>;
  warnAtPercent: string;
  active: boolean;
};

export const SCOPE_KINDS: readonly ScopeKind[] = [
  'cost-object',
  'business-unit',
  'role',
  'associate',
];
export const PERIOD_KINDS: readonly PeriodKind[] = [
  'month',
  'quarter',
  'year',
  'range',
];

// A new budget starts this month, in the unit's default mode, warning at 80 %.
export function budgetFormDefaults(
  settings: Settings,
  now: string
): BudgetForm {
  return {
    id: '',
    scopeKind: 'cost-object',
    scopeRef: '',
    amount: '',
    currencyCode: 'EUR',
    periodKind: 'month',
    from: `${now.slice(0, 7)}-01`,
    to: '',
    mode: settings.defaultMode,
    modeByRole: {},
    warnAtPercent: '80',
    active: true,
  };
}

// A business-unit scope always references the unit itself; other kinds start without a reference.
export const withScopeKind = (
  form: BudgetForm,
  kind: ScopeKind,
  unitKey: string
): BudgetForm => ({
  ...form,
  scopeKind: kind,
  scopeRef: kind === 'business-unit' ? unitKey : '',
});

// Amounts are in the currency's minor unit, as the platform's centAmount [BCC-BUDGET-1]: 2 digits for EUR, none for
// JPY, 3 for KWD (core's fractionDigits).
export const formatAmount = (
  centAmount: number,
  currencyCode: string
): string => {
  const digits = fractionDigits(currencyCode);
  return (centAmount / 10 ** digits).toFixed(digits);
};

export function formFromBudget(key: string, b: Budget): BudgetForm {
  return {
    id: parseRecordKey(key)?.code ?? '',
    scopeKind: b.scope.kind,
    scopeRef: b.scope.ref,
    amount: formatAmount(b.amount.centAmount, b.amount.currencyCode),
    currencyCode: b.amount.currencyCode,
    periodKind: b.period.kind,
    from: b.period.from,
    to: b.period.to ?? '',
    mode: b.mode,
    modeByRole: { ...(b.modeByRole ?? {}) },
    warnAtPercent: String(b.warnAtPercent),
    active: b.active,
  };
}

// Whole units with at most the currency's fraction digits; thousands separators are allowed. Returns the amount in
// the minor unit, or undefined when the input does not fit.
export function parseAmount(
  input: string,
  currencyCode: string
): number | undefined {
  const digits = fractionDigits(currencyCode.trim().toUpperCase());
  const s = input.trim().replace(/,/g, '');
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m || (m[2] ?? '').length > digits) return undefined;
  const cents =
    Number(m[1]) * 10 ** digits + Number((m[2] ?? '').padEnd(digits, '0') || 0);
  return Number.isSafeInteger(cents) ? cents : undefined;
}

function amountError(currencyCode: string): ViewFieldError {
  const currency = currencyCode.trim().toUpperCase();
  const digits = fractionDigits(currency);
  return digits === 0
    ? {
        field: 'amount',
        message: messages.amountFormatWhole,
        values: { example: '1000', currency },
      }
    : {
        field: 'amount',
        message: messages.amountFormat,
        values: { example: `1000.${'5'.padEnd(digits, '0')}`, digits },
      };
}

const safe = (s: string) => s.replace(/[^-_.a-zA-Z0-9]/g, '-');

// Readable and stable, so a second budget for the same scope and period is caught by the free-key check.
export function generatedBudgetId(form: BudgetForm): string {
  const ref =
    form.scopeKind === 'cost-object'
      ? parseRecordKey(form.scopeRef)?.code ?? form.scopeRef
      : form.scopeRef;
  return safe(`${form.scopeKind}-${ref}-${form.periodKind}-${form.from}`).slice(
    0,
    64
  );
}

export function budgetFromForm(
  unitKey: string,
  form: BudgetForm
):
  | { ok: true; value: { key: string; value: Budget } }
  | { ok: false; errors: ViewFieldError[] } {
  const errors: ViewFieldError[] = [];
  const centAmount = parseAmount(form.amount, form.currencyCode);
  if (centAmount === undefined) errors.push(amountError(form.currencyCode));
  const warnAt = Number(form.warnAtPercent);
  const id = form.id.trim() || generatedBudgetId(form);
  const key = recordKey(unitKey, id);
  if (!key.ok)
    errors.push(
      ...key.errors.map((e) => ({
        field: e.field === 'code' ? 'id' : e.field,
        message: e.message,
      }))
    );
  const overrides = Object.entries(form.modeByRole).filter(
    (e): e is [string, Mode] => e[1] !== ''
  );
  const value = {
    scope: {
      kind: form.scopeKind,
      ref: form.scopeKind === 'business-unit' ? unitKey : form.scopeRef.trim(),
    },
    ownerBusinessUnitKey: unitKey,
    amount: {
      currencyCode: form.currencyCode.trim().toUpperCase(),
      centAmount: centAmount ?? 0,
    },
    period: {
      kind: form.periodKind,
      from: form.from.trim(),
      ...(form.to.trim() ? { to: form.to.trim() } : {}),
    },
    mode: form.mode,
    ...(overrides.length ? { modeByRole: Object.fromEntries(overrides) } : {}),
    warnAtPercent: form.warnAtPercent.trim() === '' ? NaN : warnAt,
    active: form.active,
  };
  const checked = validateBudget(value);
  if (!checked.ok)
    errors.push(
      ...checked.errors.filter((e) => !errors.some((x) => x.field === e.field))
    );
  if (errors.length || !checked.ok || !key.ok)
    return { ok: false as const, errors };
  return { ok: true, value: { key: key.value, value: checked.value } };
}

// The scope reference as people know it: the cost-object code, the role name, the associate's name.
export function scopeRefLabel(
  b: Budget,
  ctx: {
    roles: Array<{ key: string; name?: string }>;
    people: Array<{ customerId: string; label: string }>;
  }
): string {
  const { kind, ref } = b.scope;
  if (kind === 'cost-object') return parseRecordKey(ref)?.code ?? ref;
  if (kind === 'role') return ctx.roles.find((r) => r.key === ref)?.name ?? ref;
  if (kind === 'associate')
    return ctx.people.find((p) => p.customerId === ref)?.label ?? ref;
  return ref;
}

export const sortedBudgets = <R extends { key: string; value: Budget }>(
  records: R[]
): R[] =>
  [...records].sort(
    (a, b) =>
      Number(b.value.active) - Number(a.value.active) ||
      a.key.localeCompare(b.key, 'en')
  );
