// Cost-object records in the container `bcc-cost-objects`.
// [BCC-COST-1] [BCC-COST-3] [BCC-COST-4] [BCC-COST-6] [BCC-COST-7] [BCC-COST-8]
import { compact, endOfDay, isDate, isNonEmptyString, isRecord, isStringArray, startOfDay } from './check';
import { CODE_PATTERN } from './keys';
import { type FieldError, type Result, fail, ok } from './result';

export type CostObjectType = 'cost-center' | 'project' | 'site';
export type ProjectStatus = 'planned' | 'active' | 'closed';

export type CostObject = {
  code: string;
  name: string;
  type: CostObjectType;
  ownerBusinessUnitKey: string;
  active: boolean;
  validFrom?: string;
  validTo?: string;
  externalId?: string;
  buyers?: string[];
  linkedBusinessUnitKey?: string;
  project?: { status: ProjectStatus; siteAddress?: string; erpProjectNumber?: string };
};

const TYPES: readonly string[] = ['cost-center', 'project', 'site'];
const PROJECT_STATUSES: readonly string[] = ['planned', 'active', 'closed'];

const optionalString = (v: unknown) => v === undefined || typeof v === 'string';

function validateProject(type: unknown, project: unknown): string | null {
  if (type !== 'project') return project === undefined ? null : 'Only cost objects of type project have project fields.';
  if (!isRecord(project)) return 'A project needs project fields with a status.';
  if (!PROJECT_STATUSES.includes(project.status as string)) return 'Status must be planned, active or closed.';
  if (!optionalString(project.siteAddress) || !optionalString(project.erpProjectNumber)) {
    return 'Site address and ERP project number must be text.';
  }
  return null;
}

// Only the known project fields are kept.
const pickProject = (p: NonNullable<CostObject['project']>) =>
  compact({ status: p.status, siteAddress: p.siteAddress, erpProjectNumber: p.erpProjectNumber });

export function validateCostObject(value: unknown): Result<CostObject> {
  if (!isRecord(value)) return fail([{ field: 'value', message: 'A cost object must be an object.' }]);
  const v = value;
  const errors: FieldError[] = [];
  const err = (field: string, message: string) => errors.push({ field, message });

  if (typeof v.code !== 'string' || !CODE_PATTERN.test(v.code)) err('code', 'Use 1 to 64 letters, digits, "-", "_" or ".".');
  if (!isNonEmptyString(v.name)) err('name', 'Name is required.');
  if (!TYPES.includes(v.type as string)) err('type', 'Type must be cost-center, project or site.');
  if (!isNonEmptyString(v.ownerBusinessUnitKey)) err('ownerBusinessUnitKey', 'Owner Business Unit key is required.');
  if (typeof v.active !== 'boolean') err('active', 'Active must be true or false.');
  if (v.validFrom !== undefined && !isDate(v.validFrom)) err('validFrom', 'Use a date as YYYY-MM-DD.');
  if (v.validTo !== undefined && !isDate(v.validTo)) err('validTo', 'Use a date as YYYY-MM-DD.');
  if (isDate(v.validFrom) && isDate(v.validTo) && v.validFrom > v.validTo) err('validTo', 'Valid to is before valid from.');
  if (!optionalString(v.externalId)) err('externalId', 'External ID must be text.');
  if (v.buyers !== undefined && !isStringArray(v.buyers)) err('buyers', 'Buyers must be a list of customer IDs.');
  if (!optionalString(v.linkedBusinessUnitKey)) err('linkedBusinessUnitKey', 'Linked Business Unit key must be text.');
  const projectError = validateProject(v.type, v.project);
  if (projectError) err('project', projectError);

  if (errors.length) return fail(errors);
  return ok(
    compact({
      code: v.code,
      name: v.name,
      type: v.type,
      ownerBusinessUnitKey: v.ownerBusinessUnitKey,
      active: v.active,
      validFrom: v.validFrom,
      validTo: v.validTo,
      externalId: v.externalId,
      buyers: v.buyers,
      linkedBusinessUnitKey: v.linkedBusinessUnitKey,
      project: v.project === undefined ? undefined : pickProject(v.project as NonNullable<CostObject['project']>),
    }) as CostObject,
  );
}

export function validateCostObjectChange(previous: CostObject, next: CostObject): Result<CostObject> {
  const errors: FieldError[] = [];
  if (next.code !== previous.code) errors.push({ field: 'code', message: 'The code cannot change after creation.' });
  if (next.ownerBusinessUnitKey !== previous.ownerBusinessUnitKey) {
    errors.push({ field: 'ownerBusinessUnitKey', message: 'The owner unit cannot change after creation.' });
  }
  return errors.length ? fail(errors) : validateCostObject(next);
}

export const deactivateCostObject = (value: CostObject): CostObject => ({ ...value, active: false });

export const isAllowedFor = (co: CostObject, customerId: string): boolean =>
  !co.buyers || co.buyers.length === 0 || co.buyers.includes(customerId);

export function isUsableAt(co: CostObject, at: string): boolean {
  const t = Date.parse(at);
  if (Number.isNaN(t) || !co.active) return false;
  if (co.validFrom && t < startOfDay(co.validFrom)) return false;
  if (co.validTo && t > endOfDay(co.validTo)) return false;
  if (co.type === 'project' && co.project?.status !== 'active') return false;
  return true;
}
