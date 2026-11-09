// Settings form of a unit: the own record, else the effective settings as a full record to write.
// [BCC-VIEW-5] [BCC-SET-1] [BCC-SET-2] [BCC-SET-4] [BCC-APPR-2]
import {
  type CostObject,
  DEFAULT_SETTINGS,
  isUsableAt,
  type Mode,
  type Settings,
  type UnitNode,
  unitChain,
  visibleCostObjects,
} from '../core';

export type SettingsDraft = {
  value: Settings;
  version?: number;
  source: 'own' | 'inherited' | 'defaults';
  from?: string;
};

export function settingsDraft(
  unitKey: string,
  units: UnitNode[],
  records: Array<{ key: string; version: number; value: Settings }>
): SettingsDraft {
  const byKey = new Map(records.map((r) => [r.key, r]));
  const own = byKey.get(unitKey);
  if (own) return { value: own.value, version: own.version, source: 'own' };
  for (const u of unitChain(unitKey, units)) {
    const r = byKey.get(u.key);
    if (r) return { value: r.value, source: 'inherited', from: u.key };
  }
  return { value: DEFAULT_SETTINGS, source: 'defaults' };
}

export type SettingsForm = {
  defaultMode: Mode;
  costObjectRequired: boolean;
  // '' means no default.
  defaultCostObject: string;
};

export const settingsFormOf = (d: SettingsDraft): SettingsForm => ({
  defaultMode: d.value.defaultMode,
  costObjectRequired: d.value.costObjectRequired,
  defaultCostObject: d.value.defaultCostObject ?? '',
});

// The record to write: always complete, so a unit's own record never drops a value it inherited. Approval coverage
// belongs to the unit that checked its own rule, so a new record starts without coverage.
export function settingsFromForm(
  d: SettingsDraft,
  form: SettingsForm
): Settings {
  const { defaultCostObject: _drop, ...rest } = d.value;
  return {
    ...rest,
    defaultMode: form.defaultMode,
    costObjectRequired: form.costObjectRequired,
    ...(form.defaultCostObject
      ? { defaultCostObject: form.defaultCostObject }
      : {}),
    approval: d.source === 'own' ? d.value.approval : { requesterRoles: [] },
  };
}

const keyOf = (co: CostObject) => `${co.ownerBusinessUnitKey}~${co.code}`;

// Every cost object the unit can see; core checks a default against these on write.
export const visibleCostObjectKeys = (
  unitKey: string,
  units: UnitNode[],
  costObjects: CostObject[]
): string[] => visibleCostObjects(unitKey, units, costObjects).map(keyOf);

// Options for the default: visible and usable now, own first.
export function defaultCostObjectOptions(
  unitKey: string,
  units: UnitNode[],
  costObjects: CostObject[],
  at: string
): Array<{ key: string; label: string }> {
  return visibleCostObjects(unitKey, units, costObjects)
    .filter((co) => isUsableAt(co, at))
    .sort(
      (a, b) =>
        Number(b.ownerBusinessUnitKey === unitKey) -
          Number(a.ownerBusinessUnitKey === unitKey) ||
        keyOf(a).localeCompare(keyOf(b), 'en')
    )
    .map((co) => ({ key: keyOf(co), label: `${co.code} ${co.name}` }));
}
