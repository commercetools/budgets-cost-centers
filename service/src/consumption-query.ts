// Order Query predicate per budget scope; core filters the results again. [BCC-SPEND-1] [BCC-BUDGET-3] [BCC-BUDGET-8]
// https://docs.commercetools.com/api/predicates/query
import type { ApplicableScope, CheckContext } from 'budgets-cost-centers-core';

const q = (v: string) => JSON.stringify(v);

export function ordersWhere(scope: ApplicableScope, ctx: CheckContext): string {
  const { budget, interval } = scope;
  const period = `createdAt >= ${q(interval.from)} and createdAt <= ${q(interval.to)}`;
  switch (budget.scope.kind) {
    case 'cost-object':
      return `custom(fields(bccCostObject=${q(budget.scope.ref)})) and ${period}`;
    case 'business-unit':
      return `businessUnit(key=${q(budget.scope.ref)}) and ${period}`;
    case 'role':
    case 'associate':
      return `businessUnit(key=${q(budget.ownerBusinessUnitKey)}) and customerId=${q(ctx.customerId)} and ${period}`;
  }
}
