// Spend report of a unit for a calendar period as CSV, from core's spendReport and toCsv. [BCC-VIEW-7]
// [BCC-SPEND-4]
import {
  type Budget,
  type CalendarKind,
  type CostObject,
  type Interval,
  type OrderLike,
  periodInEffect,
  spendReport,
  toCsv,
} from '../core';
import { chunks } from './chunks';

// The calendar period around `at` (a date or instant), in UTC.
export function reportInterval(kind: CalendarKind, at: string): Interval {
  const instant = at.length === 10 ? `${at}T12:00:00.000Z` : at;
  return periodInEffect({ kind, from: '1970-01-01' }, instant) as Interval;
}

export function periodLabel(kind: CalendarKind, interval: Interval): string {
  const year = interval.from.slice(0, 4);
  const month = Number(interval.from.slice(5, 7));
  if (kind === 'year') return year;
  if (kind === 'quarter') return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
  return interval.from.slice(0, 7);
}

export const csvFileName = (unitKey: string, label: string) =>
  `budgets-${unitKey}-${label}.csv`;

const q = (v: string) => JSON.stringify(v);

// In groups of at most 50 cost-object keys; the reader merges the results.
export function exportOrdersWhere(
  costObjectKeys: string[],
  interval: Interval
): string[] | undefined {
  if (!costObjectKeys.length) return undefined;
  const period = `createdAt >= ${q(interval.from)} and createdAt <= ${q(
    interval.to
  )}`;
  return chunks(costObjectKeys).map(
    (keys) =>
      `custom(fields(bccCostObject in (${keys
        .map(q)
        .join(', ')}))) and ${period}`
  );
}

export function spendCsv(input: {
  unitKey: string;
  interval: Interval;
  costObjects: Array<{ key: string; value: CostObject }>;
  budgets: Array<{ key: string; value: Budget }>;
  orders: OrderLike[];
}): { csv: string; rowCount: number; otherCurrencyOrders: number } {
  const { rows, otherCurrencyOrders } = spendReport(input);
  return { csv: toCsv(rows), rowCount: rows.length, otherCurrencyOrders };
}
