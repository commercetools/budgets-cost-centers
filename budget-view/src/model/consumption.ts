// Consumption per budget for the view: period in effect, consumed, remaining, bar percent and level, and orders in
// another currency. Uses core's consumption, so the view counts exactly what the cart check counts.
// [BCC-VIEW-4] [BCC-SPEND-1] [BCC-SPEND-2] [BCC-BUDGET-6] [BCC-BUDGET-7] [BCC-BUDGET-8]
import {
  amountOf,
  applicableScopes,
  type ApplicableScope,
  type Budget,
  type CheckContext,
  consumed,
  countsToward,
  type Interval,
  type Money,
  type OrderLike,
  periodInEffect,
  type ScopeLevel,
  scopeLevel,
} from '../core';
import { chunks } from './chunks';
import type { Person } from './people';

const q = (v: string) => JSON.stringify(v);

// The same predicates as service/src/consumption-query.ts; core filters the results again. A role limit is per
// person, so it reads the orders of the role's holders in the owner unit, in groups of at most 50 customer IDs whose
// results the reader merges.
export function scopeOrdersWhere(
  budget: Budget,
  interval: Interval,
  holders: string[] = []
): string[] | undefined {
  const period = `createdAt >= ${q(interval.from)} and createdAt <= ${q(
    interval.to
  )}`;
  const unit = `businessUnit(key=${q(budget.ownerBusinessUnitKey)})`;
  switch (budget.scope.kind) {
    case 'cost-object':
      return [
        `custom(fields(bccCostObject=${q(budget.scope.ref)})) and ${period}`,
      ];
    case 'business-unit':
      return [`businessUnit(key=${q(budget.scope.ref)}) and ${period}`];
    case 'associate':
      return [`${unit} and customerId=${q(budget.scope.ref)} and ${period}`];
    case 'role':
      return holders.length
        ? chunks(holders).map(
            (ids) =>
              `${unit} and customerId in (${ids
                .map(q)
                .join(', ')}) and ${period}`
          )
        : undefined;
  }
}

// The holders of a role limit whose cart check would apply it: an associate limit of the same person in the budget's
// currency replaces the role limits, as core's applicableScopes() decides [BCC-BUDGET-8]. `budgets` are all budgets of
// the owner unit; `people` hold their roles in that unit, inherited ones included.
export function applicableHolders(
  budgetKey: string,
  budget: Budget,
  people: Person[],
  budgets: Array<{ key: string; value: Budget }>,
  at: string
): string[] {
  if (budget.scope.kind !== 'role') return [];
  const roleKey = budget.scope.ref;
  return people
    .filter((p) => p.roles.includes(roleKey))
    .filter((p) => {
      const ctx: CheckContext = {
        unitKey: budget.ownerBusinessUnitKey,
        customerId: p.customerId,
        buyerRoles: p.roles,
        currencyCode: budget.amount.currencyCode,
        at,
      };
      return applicableScopes(ctx, budgets).scopes.some(
        (s) => s.key === budgetKey
      );
    })
    .map((p) => p.customerId);
}

export type ConsumptionLine = {
  // Set for role and associate scopes: whose spend the line shows.
  customerId?: string;
  amount: Money;
  consumed: Money;
  remaining: Money;
  percent: number;
  level: ScopeLevel;
  orderCount: number;
  otherCurrencyOrders: number;
};

export type BudgetConsumption = {
  interval: Interval | null;
  lines: ConsumptionLine[];
};

export function budgetConsumption(
  budget: Budget,
  orders: OrderLike[],
  at: string,
  holders: string[] = []
): BudgetConsumption {
  const interval = periodInEffect(budget.period, at);
  if (!interval) return { interval: null, lines: [] };
  const scope: ApplicableScope = { key: '', budget, interval };
  const people =
    budget.scope.kind === 'role'
      ? holders
      : budget.scope.kind === 'associate'
      ? [budget.scope.ref]
      : [undefined];
  const { amount } = budget;

  const lines = people.map((customerId): ConsumptionLine => {
    const ctx: CheckContext = {
      unitKey: budget.ownerBusinessUnitKey,
      ...(budget.scope.kind === 'cost-object'
        ? { costObjectKey: budget.scope.ref }
        : {}),
      customerId: customerId ?? '',
      buyerRoles: [],
      currencyCode: amount.currencyCode,
      at,
    };
    const used = consumed(orders, scope, ctx);
    // An order counts for the hint when it would count in the budget's own currency.
    const otherCurrencyOrders = orders.filter((o) => {
      const currencyCode = amountOf(o).currencyCode;
      if (currencyCode === amount.currencyCode) return false;
      const asIfSame = {
        ...scope,
        budget: { ...budget, amount: { ...amount, currencyCode } },
      };
      return countsToward(o, asIfSame, { ...ctx, currencyCode });
    }).length;
    const c = used.amount.centAmount;
    return {
      ...(customerId === undefined ? {} : { customerId }),
      amount,
      consumed: used.amount,
      remaining: {
        currencyCode: amount.currencyCode,
        centAmount: amount.centAmount - c,
      },
      percent:
        amount.centAmount === 0
          ? c > 0
            ? 100
            : 0
          : Math.round((c * 100) / amount.centAmount),
      level: scopeLevel(amount.centAmount, c, budget.warnAtPercent),
      orderCount: used.orderCount,
      otherCurrencyOrders,
    };
  });
  return { interval, lines };
}

// The order predicate for a budget's period in effect at `at`; nothing to read when the budget does not apply.
export function consumptionWhere(
  budget: Budget,
  at: string,
  holders: string[] = []
): string[] | undefined {
  const interval = periodInEffect(budget.period, at);
  return interval ? scopeOrdersWhere(budget, interval, holders) : undefined;
}
