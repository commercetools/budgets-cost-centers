// Long `in (...)` predicates are split into groups, like data/people.ts reads customers, so each stays short.
export const IN_CHUNK = 50;

export function chunks<T>(values: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size)
    out.push(values.slice(i, i + size));
  return out;
}
