// Small type guards for validating untyped Custom Object values. [BCC-COST-3]
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

// A calendar date `YYYY-MM-DD` that exists.
export const isDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
};

export const startOfDay = (date: string): number => Date.parse(`${date}T00:00:00.000Z`);
export const endOfDay = (date: string): number => Date.parse(`${date}T23:59:59.999Z`);

// Copies only the defined properties, so validated values carry no `undefined` keys.
export const compact = <T extends object>(v: T): T =>
  Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) as T;
