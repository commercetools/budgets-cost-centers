// Budget periods, computed in UTC. [BCC-BUDGET-4]
import { endOfDay, startOfDay } from './check';

export type Period =
  | { kind: 'month' | 'quarter' | 'year'; from: string; to?: string }
  | { kind: 'range'; from: string; to: string };

// Both bounds inclusive, as ISO instants.
export type Interval = { from: string; to: string };

const iso = (ms: number) => new Date(ms).toISOString();

export type CalendarKind = 'month' | 'quarter' | 'year';

const STEP: Record<CalendarKind, number> = { month: 1, quarter: 3, year: 12 };

// True when the date is the first day of a calendar month, quarter or year.
export function isPeriodStart(kind: CalendarKind, date: string): boolean {
  const d = new Date(`${date}T00:00:00.000Z`);
  return d.getUTCDate() === 1 && d.getUTCMonth() % STEP[kind] === 0;
}

// True when the date is the last day of a calendar month, quarter or year.
export function isPeriodEnd(kind: CalendarKind, date: string): boolean {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return isPeriodStart(kind, next.toISOString().slice(0, 10));
}

// Calendar periods repeat between `from` and `to`. Budget validation requires `from` and `to` on period
// boundaries; for unaligned input a calendar period that starts before `from` or ends after `to` does not apply.
export function periodInEffect(period: Period, at: string): Interval | null {
  const t = Date.parse(at);
  const lower = startOfDay(period.from);
  const upper = period.to === undefined ? Infinity : endOfDay(period.to);

  if (period.kind === 'range') return t >= lower && t <= upper ? { from: iso(lower), to: iso(upper) } : null;

  const d = new Date(t);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const [startMonth, months] =
    period.kind === 'month' ? [month, 1] : period.kind === 'quarter' ? [month - (month % 3), 3] : [0, 12];
  const start = Date.UTC(year, startMonth, 1);
  const end = Date.UTC(year, startMonth + months, 1) - 1;
  return start >= lower && end <= upper ? { from: iso(start), to: iso(end) } : null;
}
