// [BCC-CART-2] [BCC-CART-3] [BCC-COST-5] [BCC-COST-6] [BCC-COST-7]
import type { CostObject, Settings, UnitNode } from 'budgets-cost-centers-core';
import { DEFAULT_SETTINGS } from 'budgets-cost-centers-core';
import { costObjectProblem, resolveCostObjectKey } from '../src/cost-object-check';

const units: UnitNode[] = [{ key: 'division-a1', parentKey: 'unit-a' }, { key: 'unit-a' }, { key: 'unit-b' }];
const at = '2026-11-02T10:00:00Z';
const cc: CostObject = { code: 'CC-100', name: 'Workshop', type: 'cost-center', ownerBusinessUnitKey: 'unit-a', active: true };
const prj: CostObject = { code: 'PRJ-1001', name: 'Depot', type: 'project', ownerBusinessUnitKey: 'unit-a', active: true, project: { status: 'active' } };
const check = (key: string, record: unknown, patch: Partial<Parameters<typeof costObjectProblem>[0]> = {}) =>
  costObjectProblem({ key, record, unitKey: 'division-a1', units, customerId: 'cust-1', at, ...patch });
const message = (r: ReturnType<typeof costObjectProblem>) => (r.ok ? null : r.message);

describe('costObjectProblem', () => {
  test('a visible usable cost object passes', () => expect(check('unit-a~CC-100', cc)).toEqual({ ok: true, costObject: cc }));
  test('missing', () => expect(message(check('unit-a~CC-404', undefined))).toBe('Cost object CC-404 does not exist.'));
  test('corrupt record counts as missing', () => expect(message(check('unit-a~CC-100', { code: 7 }))).toBe('Cost object CC-100 does not exist.'));
  test('another company', () =>
    expect(message(check('unit-b~CC-1', { ...cc, code: 'CC-1', ownerBusinessUnitKey: 'unit-b' }))).toBe('Cost object CC-1 cannot be used in this business unit.'));
  test('linked to another division', () =>
    expect(message(check('unit-a~CC-100', { ...cc, linkedBusinessUnitKey: 'division-a2' }))).toBe('Cost object CC-100 cannot be used in this business unit.'));
  test('key and record disagree', () =>
    expect(message(check('unit-a~CC-200', cc))).toBe('Cost object CC-200 does not exist.'));
  test('buyer not allowed', () =>
    expect(message(check('unit-a~CC-100', { ...cc, buyers: ['cust-2'] }))).toBe('You are not allowed to order against cost object CC-100.'));
  test('inactive', () => expect(message(check('unit-a~CC-100', { ...cc, active: false }))).toBe('Cost object CC-100 is inactive.'));
  test('not yet valid', () =>
    expect(message(check('unit-a~CC-100', { ...cc, validFrom: '2027-01-01' }))).toBe('Cost object CC-100 is valid from 2027-01-01.'));
  test('expired', () =>
    expect(message(check('unit-a~CC-100', { ...cc, validTo: '2026-06-30' }))).toBe('Cost object CC-100 expired on 2026-06-30.'));
  test('closed project', () =>
    expect(message(check('unit-a~PRJ-1001', { ...prj, project: { status: 'closed' } }))).toBe('Project PRJ-1001 is closed and cannot be ordered against.'));
  test('planned project', () =>
    expect(message(check('unit-a~PRJ-1001', { ...prj, project: { status: 'planned' } }))).toBe('Project PRJ-1001 is planned and not open for orders yet.'));
  test('an unparseable key is shown as is', () => expect(message(check('nonsense', undefined))).toBe('Cost object nonsense does not exist.'));
});

describe('resolveCostObjectKey', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, defaultCostObject: 'unit-a~CC-100' };
  const resolve = (patch: Partial<Parameters<typeof resolveCostObjectKey>[0]>) =>
    resolveCostObjectKey({ settings, defaultRecord: cc, unitKey: 'division-a1', units, customerId: 'cust-1', at, ...patch });
  test('the cart value wins', () => expect(resolve({ cartValue: 'unit-a~PRJ-1001' })).toEqual({ key: 'unit-a~PRJ-1001', defaulted: false }));
  test('a usable default applies', () => expect(resolve({})).toEqual({ key: 'unit-a~CC-100', defaulted: true }));
  test('no default', () => expect(resolve({ settings: DEFAULT_SETTINGS })).toEqual({ defaulted: false }));
  test('an invisible default is ignored', () => expect(resolve({ defaultRecord: { ...cc, linkedBusinessUnitKey: 'x' } })).toEqual({ defaulted: false }));
  test('an unusable default is ignored', () => expect(resolve({ defaultRecord: { ...cc, active: false } })).toEqual({ defaulted: false }));
  test('a default the buyer may not use is ignored', () => expect(resolve({ defaultRecord: { ...cc, buyers: ['cust-9'] } })).toEqual({ defaulted: false }));
  test('a missing default record is ignored', () => expect(resolve({ defaultRecord: undefined })).toEqual({ defaulted: false }));
});
