// Which budgets and limits apply to a cart. [BCC-BUDGET-3] [BCC-BUDGET-8] [BCC-CART-4] [BCC-BUDGET-7]
import type { Budget } from './budget';
import { type Interval, periodInEffect } from './period';

// buyerRoles: the roles the customer holds in the cart's unit, inherited role assignments included.
export type CheckContext = {
  unitKey: string;
  costObjectKey?: string;
  customerId: string;
  buyerRoles: string[];
  currencyCode: string;
  at: string;
};

export type ApplicableScope = { key: string; budget: Budget; interval: Interval };
export type SkippedScope = { key: string; skipped: 'currency' };

function matches(b: Budget, ctx: CheckContext, hasAssociateLimit: boolean): boolean {
  const { kind, ref } = b.scope;
  if (kind === 'cost-object') return ref === ctx.costObjectKey;
  if (kind === 'business-unit') return ref === ctx.unitKey;
  if (b.ownerBusinessUnitKey !== ctx.unitKey) return false;
  if (kind === 'associate') return ref === ctx.customerId;
  return !hasAssociateLimit && ctx.buyerRoles.includes(ref);
}

export function applicableScopes(
  ctx: CheckContext,
  budgets: Array<{ key: string; value: Budget }>,
): { scopes: ApplicableScope[]; skipped: SkippedScope[] } {
  // Sorted by key, so the snapshot does not change with the order of the budget query.
  const live = [...budgets]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .filter(({ value }) => value.active)
    .map(({ key, value }) => ({ key, budget: value, interval: periodInEffect(value.period, ctx.at) }))
    .filter((x): x is ApplicableScope => x.interval !== null);
  // An associate limit replaces the role limits only when it can be checked, that is in the cart's currency.
  const hasAssociateLimit = live.some(
    (s) =>
      s.budget.scope.kind === 'associate' &&
      s.budget.ownerBusinessUnitKey === ctx.unitKey &&
      s.budget.scope.ref === ctx.customerId &&
      s.budget.amount.currencyCode === ctx.currencyCode,
  );

  const scopes: ApplicableScope[] = [];
  const skipped: SkippedScope[] = [];
  for (const s of live) {
    if (!matches(s.budget, ctx, hasAssociateLimit)) continue;
    if (s.budget.amount.currencyCode !== ctx.currencyCode) skipped.push({ key: s.key, skipped: 'currency' });
    else scopes.push(s);
  }
  return { scopes, skipped };
}
