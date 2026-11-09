// Custom Object containers and the record key scheme `<ownerBusinessUnitKey>~<code>`. [BCC-COST-2] [BCC-BUDGET-1]
import { type FieldError, type Result, fail, ok } from './result';

export const CONTAINERS = {
  costObjects: 'bcc-cost-objects',
  budgets: 'bcc-budgets',
  settings: 'bcc-settings',
} as const;

// Codes never contain `~`, so a key splits unambiguously at its last `~`.
export const CODE_PATTERN = /^[-_.a-zA-Z0-9]{1,64}$/;
// Custom Object keys: https://docs.commercetools.com/api/projects/custom-objects
export const KEY_PATTERN = /^[-_~.a-zA-Z0-9]{1,256}$/;

export function recordKey(ownerBusinessUnitKey: string, code: string): Result<string> {
  const errors: FieldError[] = [];
  if (!CODE_PATTERN.test(code)) {
    errors.push({ field: 'code', message: 'Use 1 to 64 letters, digits, "-", "_" or ".".' });
  }
  if (!/^[-_~.a-zA-Z0-9]+$/.test(ownerBusinessUnitKey)) {
    errors.push({
      field: 'ownerBusinessUnitKey',
      message: `Business Unit key "${ownerBusinessUnitKey}" contains characters a Custom Object key does not allow.`,
    });
  }
  if (errors.length) return fail(errors);
  const key = `${ownerBusinessUnitKey}~${code}`;
  if (!KEY_PATTERN.test(key)) {
    return fail([{ field: 'code', message: `Key "${key.slice(0, 40)}..." is longer than 256 characters.` }]);
  }
  return ok(key);
}

export function parseRecordKey(key: string): { ownerBusinessUnitKey: string; code: string } | null {
  const at = key.lastIndexOf('~');
  if (at <= 0 || at === key.length - 1) return null;
  return { ownerBusinessUnitKey: key.slice(0, at), code: key.slice(at + 1) };
}
