// Spend report per cost object and its CSV export. [BCC-SPEND-4]
import type { Budget } from './budget';
import { amountOf, consumed, isCountableOrder, type OrderLike } from './consumption';
import type { CostObject } from './cost-object';
import { formatMoney, type Money } from './money';
import { type Interval, periodInEffect } from './period';
import type { ApplicableScope, CheckContext } from './scopes';

export type ReportRow = {
  unit: string;
  costObject: string;
  type: string;
  externalId: string;
  period: string;
  budget: string;
  consumed: string;
  remaining: string;
  orderCount: number;
};

// Two fraction digits, which covers EUR, USD, GBP and most currencies; others are out of scope in v1.
// Currency first: a cell starting with "-" would be read as a formula by spreadsheets.
const fmt = (m: Money) => { const [amount, code] = formatMoney(m).split(" "); return `${code} ${amount}`; };

function dominantCurrency(orders: OrderLike[], key: string, interval: Interval): string | undefined {
  const counts = new Map<string, number>();
  for (const o of orders) {
    if (o.custom?.fields.bccCostObject !== key || !isCountableOrder(o, interval)) continue;
    const c = amountOf(o).currencyCode;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

export function spendReport(input: {
  unitKey: string;
  interval: Interval;
  costObjects: Array<{ key: string; value: CostObject }>;
  budgets: Array<{ key: string; value: Budget }>;
  orders: OrderLike[];
}): { rows: ReportRow[]; otherCurrencyOrders: number } {
  const { unitKey, interval } = input;
  const fallbackCurrency = input.budgets[0]?.value.amount.currencyCode ?? (input.orders[0] && amountOf(input.orders[0]).currencyCode) ?? 'EUR';
  const period = `${interval.from.slice(0, 10)}..${interval.to.slice(0, 10)}`;
  let otherCurrencyOrders = 0;

  // A budget belongs in the report when its period in effect at the start of the interval is exactly the interval.
  const inInterval = (b: Budget) =>
    b.active && JSON.stringify(periodInEffect(b.period, interval.from)) === JSON.stringify(interval);

  const rows = [...input.costObjects]
    .sort((a, b) => a.value.code.localeCompare(b.value.code, 'en'))
    .flatMap(({ key, value: co }): ReportRow[] => {
      const own = input.budgets.filter((b) => b.value.scope.kind === 'cost-object' && b.value.scope.ref === key && inInterval(b.value));
      // Without a budget the row uses the currency most of the cost object's own orders are in.
      const currencyCode = own[0]?.value.amount.currencyCode ?? dominantCurrency(input.orders, key, interval) ?? fallbackCurrency;
      // A cost-object scope counts every order carrying the key; the context's buyer fields are not used for it.
      const ctx: CheckContext = { unitKey, costObjectKey: key, customerId: '', buyerRoles: [], currencyCode, at: interval.to };
      const unbudgeted: Budget = {
        scope: { kind: 'cost-object', ref: key },
        ownerBusinessUnitKey: unitKey,
        amount: { currencyCode, centAmount: 0 },
        period: { kind: 'range', from: interval.from.slice(0, 10), to: interval.to.slice(0, 10) },
        mode: 'warn',
        warnAtPercent: 80,
        active: true,
      };
      otherCurrencyOrders += input.orders.filter(
        (o) => o.custom?.fields.bccCostObject === key && isCountableOrder(o, interval) && amountOf(o).currencyCode !== currencyCode,
      ).length;

      const row = (budget: Budget, hasBudget: boolean, scopeKey: string): ReportRow => {
        const scope: ApplicableScope = { key: scopeKey, budget, interval };
        const used = consumed(input.orders, scope, { ...ctx, currencyCode: budget.amount.currencyCode });
        return {
          unit: unitKey,
          costObject: co.code,
          type: co.type,
          externalId: co.externalId ?? '',
          period,
          budget: hasBudget ? fmt(budget.amount) : '',
          consumed: fmt(used.amount),
          remaining: hasBudget ? fmt({ currencyCode: budget.amount.currencyCode, centAmount: budget.amount.centAmount - used.amount.centAmount }) : '',
          orderCount: used.orderCount,
        };
      };
      return own.length ? own.map((b) => row(b.value, true, b.key)) : [row(unbudgeted, false, key)];
    });
  return { rows, otherCurrencyOrders };
}

const HEADER = ['unit', 'cost object', 'type', 'externalId', 'period', 'budget', 'consumed', 'remaining', 'order count'];

// Free-text cells that start like a spreadsheet formula get a leading apostrophe, so Excel shows text.
const neutralise = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: ReportRow[]): string {
  const lines = [
    HEADER,
    ...rows.map((r) => [neutralise(r.unit), neutralise(r.costObject), r.type, neutralise(r.externalId), r.period, r.budget, r.consumed, r.remaining, r.orderCount]),
  ];
  return lines.map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n';
}
