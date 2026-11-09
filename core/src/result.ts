// Shared validation result for Custom Object values. [BCC-COST-3]
export type FieldError = { field: string; message: string };

export type Result<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = <T>(errors: FieldError[]): Result<T> => ({ ok: false, errors });
