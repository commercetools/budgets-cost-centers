// Budget evaluation: scope level, effective mode with the fail-safe, and the cart outcome.
// [BCC-BUDGET-5] [BCC-BUDGET-6] [BCC-CART-5] [BCC-CART-6] [BCC-CART-8] [BCC-APPR-2]
import type { Budget, ScopeKind } from './budget';
import type { SkippedScope } from './scopes';
import type { Mode } from './settings';

export type ScopeLevel = 'ok' | 'warn' | 'exceeded';
export type BudgetStatus = 'ok' | 'warn' | 'exceeded' | 'blocked' | 'none';

// Amounts in cent.
export type ScopeResult = { key: string; kind: ScopeKind; amount: number; used: number; projected: number; level: ScopeLevel; mode: Mode };

export type Outcome = { status: BudgetStatus; exceeded: boolean; scopes: Array<ScopeResult | SkippedScope> | { error: 'unchecked' } };

const STRICTNESS: Record<Mode, number> = { warn: 0, approval: 1, block: 2 };

export function scopeLevel(amount: number, projected: number, warnAtPercent: number): ScopeLevel {
  if (projected > amount) return 'exceeded';
  if (amount === 0) return 'ok';
  return projected * 100 >= amount * warnAtPercent ? 'warn' : 'ok';
}

// Strictest of the buyer's role overrides, else the budget mode. An `approval` outcome needs a role covered by an
// active budget Approval Rule; otherwise the order would pass without approval, so it becomes `block`.
export function effectiveMode(budget: Budget, buyerRoles: string[], coveredRoles: string[]): Mode {
  const overrides = buyerRoles.map((r) => budget.modeByRole?.[r]).filter((m): m is Mode => m !== undefined);
  const mode = overrides.length ? overrides.reduce((a, b) => (STRICTNESS[b] > STRICTNESS[a] ? b : a)) : budget.mode;
  if (mode === 'approval' && !buyerRoles.some((r) => coveredRoles.includes(r))) return 'block';
  return mode;
}

export function cartOutcome(input: {
  costObjectRequired: boolean;
  costObjectKey?: string;
  results: ScopeResult[];
  skipped: SkippedScope[];
}): Outcome {
  // Sorted by key, so the snapshot only changes when a value changes. [BCC-CART-7]
  const scopes = [...input.results, ...input.skipped].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const exceededWith = (mode: Mode) => input.results.some((r) => r.level === 'exceeded' && r.mode === mode);
  let status: BudgetStatus;
  if (input.costObjectRequired && !input.costObjectKey) status = 'none';
  else if (exceededWith('block')) status = 'blocked';
  else if (exceededWith('approval')) status = 'exceeded';
  else if (input.results.some((r) => r.level !== 'ok')) status = 'warn';
  else status = 'ok';
  return { status, exceeded: status === 'exceeded', scopes };
}

// Consumption could not be computed: route to approval, or block when no Approval Rule covers the buyer, since an
// uncovered buyer's order would otherwise pass unchecked.
export const uncheckedOutcome = (buyerCovered: boolean): Outcome =>
  buyerCovered
    ? { status: 'exceeded', exceeded: true, scopes: { error: 'unchecked' } }
    : { status: 'blocked', exceeded: false, scopes: { error: 'unchecked' } };
