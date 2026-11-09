// [BCC-COST-1] [BCC-COST-3] [BCC-COST-4] [BCC-COST-6] [BCC-COST-7] [BCC-COST-8]
import {
  type CostObject,
  deactivateCostObject,
  isAllowedFor,
  isUsableAt,
  validateCostObject,
  validateCostObjectChange,
} from '../src/cost-object';

const cc: CostObject = { code: 'CC-100', name: 'Workshop', type: 'cost-center', ownerBusinessUnitKey: 'unit-a', active: true };
const prj: CostObject = {
  code: 'PRJ-1001',
  name: 'Riverside Depot',
  type: 'project',
  ownerBusinessUnitKey: 'unit-a',
  active: true,
  project: { status: 'active' },
};
const fields = (r: ReturnType<typeof validateCostObject>) => (r.ok ? [] : r.errors.map((e) => e.field));

describe('validateCostObject', () => {
  test('accepts a valid cost center', () => expect(validateCostObject(cc)).toEqual({ ok: true, value: cc }));
  test('accepts a valid project', () => expect(validateCostObject(prj).ok).toBe(true));
  test('missing name', () => expect(fields(validateCostObject({ ...cc, name: undefined }))).toEqual(['name']));
  test('unknown type', () => expect(fields(validateCostObject({ ...cc, type: 'department' }))).toContain('type'));
  test('non-objects are rejected without throwing', () => {
    expect(validateCostObject(null).ok).toBe(false);
    expect(validateCostObject('x').ok).toBe(false);
  });
  test('buyers must be a list of strings', () =>
    expect(fields(validateCostObject({ ...cc, buyers: 'cust-1' }))).toEqual(['buyers']));
  test('project field on a cost center', () =>
    expect(fields(validateCostObject({ ...cc, project: { status: 'active' } }))).toEqual(['project']));
  test('project type without project field', () =>
    expect(fields(validateCostObject({ ...prj, project: undefined }))).toEqual(['project']));
  test('project with an unknown status', () =>
    expect(fields(validateCostObject({ ...prj, project: { status: 'done' } }))).toEqual(['project']));
  test('invalid code and dates', () =>
    expect(fields(validateCostObject({ ...cc, code: 'CC 1', validTo: '29.10.2026' }))).toEqual(['code', 'validTo']));
  test('collects all errors', () => expect(fields(validateCostObject({ code: 'x' })).length).toBeGreaterThan(2));
});

describe('validateCostObjectChange', () => {
  test('code is immutable', () =>
    expect(validateCostObjectChange(cc, { ...cc, code: 'CC-101' })).toMatchObject({ ok: false, errors: [{ field: 'code' }] }));
  test('owner is immutable', () =>
    expect(validateCostObjectChange(cc, { ...cc, ownerBusinessUnitKey: 'unit-b' })).toMatchObject({
      ok: false,
      errors: [{ field: 'ownerBusinessUnitKey' }],
    }));
  test('name may change', () => expect(validateCostObjectChange(cc, { ...cc, name: 'Workshop East' }).ok).toBe(true));
});

test('deactivate keeps the record', () => expect(deactivateCostObject(cc)).toEqual({ ...cc, active: false }));

describe('isAllowedFor', () => {
  test('no list allows everyone', () => expect(isAllowedFor(cc, 'cust-2')).toBe(true));
  test('empty list allows everyone', () => expect(isAllowedFor({ ...cc, buyers: [] }, 'cust-2')).toBe(true));
  test('listed buyers only', () => {
    expect(isAllowedFor({ ...cc, buyers: ['cust-1'] }, 'cust-2')).toBe(false);
    expect(isAllowedFor({ ...cc, buyers: ['cust-1'] }, 'cust-1')).toBe(true);
  });
});

describe('isUsableAt', () => {
  test('inactive', () => expect(isUsableAt({ ...cc, active: false }, '2026-10-29T08:00:00Z')).toBe(false));
  test('expired yesterday', () => expect(isUsableAt({ ...cc, validTo: '2026-10-28' }, '2026-10-29T08:00:00Z')).toBe(false));
  test('validTo covers the whole day', () =>
    expect(isUsableAt({ ...cc, validTo: '2026-10-29' }, '2026-10-29T23:59:59Z')).toBe(true));
  test('not yet valid', () => expect(isUsableAt({ ...cc, validFrom: '2026-10-30' }, '2026-10-29T23:59:59Z')).toBe(false));
  test('validFrom starts the day', () => expect(isUsableAt({ ...cc, validFrom: '2026-10-29' }, '2026-10-29T00:00:00Z')).toBe(true));
  test('planned and closed projects are not usable', () => {
    expect(isUsableAt({ ...prj, project: { status: 'planned' } }, '2026-10-29T08:00:00Z')).toBe(false);
    expect(isUsableAt({ ...prj, project: { status: 'closed' } }, '2026-10-29T08:00:00Z')).toBe(false);
    expect(isUsableAt(prj, '2026-10-29T08:00:00Z')).toBe(true);
  });
});

describe('review minors', () => {
  test('unknown keys inside project are dropped', () => {
    const r = validateCostObject({ ...prj, project: { status: 'active', note: 'x' } });
    expect(r.ok && r.value.project).toEqual({ status: 'active' });
  });
  test('an unparseable instant is not usable', () => expect(isUsableAt(cc, 'not-a-date')).toBe(false));
});
