// Budgets and spend limits in the container `bcc-budgets`. [BCC-BUDGET-1] [BCC-BUDGET-2] [BCC-BUDGET-7] [BCC-BUDGET-9]
import { compact, isDate, isNonEmptyString, isRecord } from './check';
import { parseRecordKey } from './keys';
import { isMoney, type Money } from './money';
import { type CalendarKind, isPeriodEnd, isPeriodStart, type Period } from './period';
import { type FieldError, type Result, fail, ok } from './result';
import { type Mode, MODES } from './settings';

export type ScopeKind = 'cost-object' | 'business-unit' | 'role' | 'associate';

export type Budget = {
  scope: { kind: ScopeKind; ref: string };
  ownerBusinessUnitKey: string;
  amount: Money;
  period: Period;
  mode: Mode;
  modeByRole?: Record<string, Mode>;
  warnAtPercent: number;
  active: boolean;
};

const SCOPE_KINDS: readonly string[] = ['cost-object', 'business-unit', 'role', 'associate'];
const PERIOD_KINDS: readonly string[] = ['month', 'quarter', 'year', 'range'];

function periodError(p: unknown): string | null {
  if (!isRecord(p) || !PERIOD_KINDS.includes(p.kind as string)) return 'Period kind must be month, quarter, year or range.';
  if (!isDate(p.from)) return 'Period from must be a date as YYYY-MM-DD.';
  if (p.kind === 'range' && p.to === undefined) return 'A range needs a to date.';
  if (p.to !== undefined && !isDate(p.to)) return 'Period to must be a date as YYYY-MM-DD.';
  if (p.to !== undefined && (p.to as string) < p.from) return 'Period to is before from.';
  if (p.kind !== 'range' && !isPeriodStart(p.kind as CalendarKind, p.from)) {
    return `A ${p.kind} budget must start on the first day of a ${p.kind}.`;
  }
  if (p.kind !== 'range' && p.to !== undefined && !isPeriodEnd(p.kind as CalendarKind, p.to as string)) {
    return `A ${p.kind} budget must end on the last day of a ${p.kind}.`;
  }
  return null;
}

// A unit budgets its own unit and its own cost objects; role and associate refs are not keys of a unit.
function scopeOwnerError(scope: Budget['scope'], owner: string): string | null {
  if (scope.kind === 'business-unit' && scope.ref !== owner) return 'A Business Unit budget must belong to that unit.';
  if (scope.kind === 'cost-object') {
    const parsed = parseRecordKey(scope.ref);
    if (!parsed) return 'A cost-object budget needs the full cost-object key <unitKey>~<code>.';
    if (parsed.ownerBusinessUnitKey !== owner) return 'A cost-object budget must belong to the unit that owns the cost object.';
  }
  return null;
}

export function validateBudget(value: unknown): Result<Budget> {
  if (!isRecord(value)) return fail([{ field: 'value', message: 'A budget must be an object.' }]);
  const v = value;
  const errors: FieldError[] = [];
  const err = (field: string, message: string) => errors.push({ field, message });

  if (!isRecord(v.scope) || !SCOPE_KINDS.includes(v.scope.kind as string) || !isNonEmptyString(v.scope.ref)) {
    err('scope', 'Scope needs a kind (cost-object, business-unit, role, associate) and a reference.');
  }
  if (!isNonEmptyString(v.ownerBusinessUnitKey)) err('ownerBusinessUnitKey', 'Owner Business Unit key is required.');
  else if (isRecord(v.scope) && !errors.length) {
    const se = scopeOwnerError(v.scope as Budget['scope'], v.ownerBusinessUnitKey);
    if (se) err('scope', se);
  }
  if (!isMoney(v.amount) || v.amount.centAmount < 0) {
    err('amount', 'Amount needs a three-letter currency code and a non-negative whole cent amount.');
  }
  const pe = periodError(v.period);
  if (pe) err('period', pe);
  if (!MODES.includes(v.mode as Mode)) err('mode', 'Mode must be approval, warn or block.');
  if (v.modeByRole !== undefined && (!isRecord(v.modeByRole) || !Object.values(v.modeByRole).every((m) => MODES.includes(m as Mode)))) {
    err('modeByRole', 'Each role mode must be approval, warn or block.');
  }
  const warnAt = v.warnAtPercent ?? 80;
  if (typeof warnAt !== 'number' || warnAt < 0 || warnAt > 100) err('warnAtPercent', 'Warning threshold must be 0 to 100.');
  if (typeof v.active !== 'boolean') err('active', 'Active must be true or false.');

  if (errors.length) return fail(errors);
  const scope = v.scope as Budget['scope'];
  const amount = v.amount as Money;
  const period = v.period as Period;
  return ok(
    compact({
      scope: { kind: scope.kind, ref: scope.ref },
      ownerBusinessUnitKey: v.ownerBusinessUnitKey as string,
      amount: { currencyCode: amount.currencyCode, centAmount: amount.centAmount },
      period: compact({ kind: period.kind, from: period.from, to: period.to }) as Period,
      mode: v.mode as Mode,
      modeByRole: v.modeByRole as Record<string, Mode> | undefined,
      warnAtPercent: warnAt as number,
      active: v.active as boolean,
    }),
  );
}

export const deactivateBudget = (value: Budget): Budget => ({ ...value, active: false });
