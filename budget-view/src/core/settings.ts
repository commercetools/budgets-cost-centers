// Unit settings in the container `bcc-settings`, one record per Business Unit. [BCC-SET-1] [BCC-SET-3] [BCC-SET-4]
import { compact, isRecord, isStringArray } from './check';
import { type FieldError, type Result, fail, ok } from './result';

export type Mode = 'approval' | 'warn' | 'block';

export const MODES: readonly Mode[] = ['approval', 'warn', 'block'];

export type Settings = {
  defaultMode: Mode;
  costObjectRequired: boolean;
  defaultCostObject?: string;
  costObjectLevel: 'order';
  features: { projects: boolean };
  approval: { ruleKey?: string; ruleId?: string; requesterRoles: string[]; checkedAt?: string };
};

export const DEFAULT_SETTINGS: Settings = {
  defaultMode: 'approval',
  costObjectRequired: false,
  costObjectLevel: 'order',
  features: { projects: true },
  approval: { requesterRoles: [] },
};

// Shape check, used on read: a default cost object that is no longer visible must not discard the whole record,
// because the unit would then fall back to its ancestor's settings and lose its own requirement and coverage.
export function validateSettings(value: unknown): Result<Settings> {
  if (!isRecord(value)) return fail([{ field: 'value', message: 'Settings must be an object.' }]);
  const v = value;
  const errors: FieldError[] = [];
  const err = (field: string, message: string) => errors.push({ field, message });

  if (!MODES.includes(v.defaultMode as Mode)) err('defaultMode', 'Default mode must be approval, warn or block.');
  if (typeof v.costObjectRequired !== 'boolean') err('costObjectRequired', 'Must be true or false.');
  if (v.defaultCostObject !== undefined && typeof v.defaultCostObject !== 'string') err('defaultCostObject', 'Must be a cost-object key.');
  if (v.costObjectLevel !== 'order') {
    err('costObjectLevel', 'Only order level is supported; line level is reserved for a later version.');
  }
  if (!isRecord(v.features) || typeof v.features.projects !== 'boolean') err('features', 'features.projects must be true or false.');
  const a = v.approval;
  if (
    !isRecord(a) ||
    !isStringArray(a.requesterRoles) ||
    (a.ruleKey !== undefined && typeof a.ruleKey !== 'string') ||
    (a.ruleId !== undefined && typeof a.ruleId !== 'string') ||
    (a.checkedAt !== undefined && typeof a.checkedAt !== 'string')
  ) {
    err('approval', 'approval needs requesterRoles as a list of role keys.');
  }

  if (errors.length) return fail(errors);
  const approval = a as Settings['approval'];
  return ok(
    compact({
      defaultMode: v.defaultMode as Mode,
      costObjectRequired: v.costObjectRequired as boolean,
      defaultCostObject: v.defaultCostObject as string | undefined,
      costObjectLevel: 'order' as const,
      features: { projects: (v.features as { projects: boolean }).projects },
      approval: compact({ ruleKey: approval.ruleKey, ruleId: approval.ruleId, requesterRoles: approval.requesterRoles, checkedAt: approval.checkedAt }),
    }),
  );
}

// Shape check plus the cross-record check, used on write.
export function validateSettingsForWrite(value: unknown, visibleCostObjectKeys: string[]): Result<Settings> {
  const r = validateSettings(value);
  if (!r.ok) {
    const isRecordValue = isRecord(value);
    const extra =
      isRecordValue && value.defaultCostObject !== undefined && !visibleCostObjectKeys.includes(value.defaultCostObject as string)
        ? [{ field: 'defaultCostObject', message: 'The default cost object must be one this unit can use.' }]
        : [];
    return fail([...r.errors, ...extra.filter((e) => !r.errors.some((x) => x.field === e.field))]);
  }
  if (r.value.defaultCostObject !== undefined && !visibleCostObjectKeys.includes(r.value.defaultCostObject)) {
    return fail([{ field: 'defaultCostObject', message: 'The default cost object must be one this unit can use.' }]);
  }
  return r;
}
