// Cost-object rows of a unit and the cost-object form, on top of core. [BCC-VIEW-2] [BCC-COST-2] [BCC-COST-5]
// [BCC-PROJ-4]
import {
  type CostObject,
  type CostObjectType,
  type FieldError,
  type ProjectStatus,
  recordKey,
  type Result,
  type UnitNode,
  unitChain,
  validateCostObject,
  validateCostObjectChange,
  visibleCostObjects,
} from '../core';

export type StoredCostObject = {
  key: string;
  version: number;
  value: CostObject;
};

export type CostObjectRow = StoredCostObject & {
  owner: string;
  editable: boolean;
};

// Own cost objects (all, editable) first, then the active ones of the ancestors (read-only), nearest owner first.
export function costObjectRows(
  unitKey: string,
  units: UnitNode[],
  records: StoredCostObject[]
): CostObjectRow[] {
  const visible = new Set(
    visibleCostObjects(
      unitKey,
      units,
      records.map((r) => r.value)
    )
  );
  const depth = new Map(unitChain(unitKey, units).map((u, i) => [u.key, i]));
  return records
    .filter(
      (r) =>
        visible.has(r.value) &&
        (r.value.ownerBusinessUnitKey === unitKey || r.value.active)
    )
    .map((r) => ({
      ...r,
      owner: r.value.ownerBusinessUnitKey,
      editable: r.value.ownerBusinessUnitKey === unitKey,
    }))
    .sort(
      (a, b) =>
        (depth.get(a.owner) ?? 0) - (depth.get(b.owner) ?? 0) ||
        a.value.code.localeCompare(b.value.code, 'en')
    );
}

export type CostObjectForm = {
  code: string;
  name: string;
  type: CostObjectType;
  externalId: string;
  validFrom: string;
  validTo: string;
  buyers: string[];
  projectStatus: ProjectStatus;
  siteAddress: string;
  erpProjectNumber: string;
};

export const emptyCostObjectForm = (): CostObjectForm => ({
  code: '',
  name: '',
  type: 'cost-center',
  externalId: '',
  validFrom: '',
  validTo: '',
  buyers: [],
  projectStatus: 'planned',
  siteAddress: '',
  erpProjectNumber: '',
});

export const formFromCostObject = (co: CostObject): CostObjectForm => ({
  code: co.code,
  name: co.name,
  type: co.type,
  externalId: co.externalId ?? '',
  validFrom: co.validFrom ?? '',
  validTo: co.validTo ?? '',
  buyers: co.buyers ?? [],
  projectStatus: co.project?.status ?? 'planned',
  siteAddress: co.project?.siteAddress ?? '',
  erpProjectNumber: co.project?.erpProjectNumber ?? '',
});

const text = (s: string) => {
  const t = s.trim();
  return t ? t : undefined;
};

// Builds the record from the form. Editing keeps what the form does not show (active, linked unit) and lets core
// refuse a change of code or owner.
export function costObjectFromForm(
  unitKey: string,
  form: CostObjectForm,
  previous?: CostObject
): Result<{ key: string; value: CostObject }> {
  const code = form.code.trim();
  const value = {
    code,
    name: form.name.trim(),
    type: form.type,
    ownerBusinessUnitKey: previous?.ownerBusinessUnitKey ?? unitKey,
    active: previous?.active ?? true,
    validFrom: text(form.validFrom),
    validTo: text(form.validTo),
    externalId: text(form.externalId),
    buyers: form.buyers.length ? [...form.buyers] : undefined,
    linkedBusinessUnitKey: previous?.linkedBusinessUnitKey,
    project:
      form.type === 'project'
        ? {
            status: form.projectStatus,
            siteAddress: text(form.siteAddress),
            erpProjectNumber: text(form.erpProjectNumber),
          }
        : undefined,
  };
  const checked = previous
    ? validateCostObjectChange(previous, value as CostObject)
    : validateCostObject(value);
  const key = recordKey(value.ownerBusinessUnitKey, code);
  const errors: FieldError[] = [
    ...(checked.ok ? [] : checked.errors),
    ...(key.ok
      ? []
      : key.errors.filter(
          (e) => checked.ok || !checked.errors.some((c) => c.field === e.field)
        )),
  ];
  if (!checked.ok || !key.ok) return { ok: false, errors };
  return { ok: true, value: { key: key.value, value: checked.value } };
}
