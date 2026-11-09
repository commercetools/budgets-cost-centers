// [BCC-COST-5] [BCC-SET-2] [BCC-APPR-2]
import type { CostObject } from '../src/cost-object';
import { coveredRoles, effectiveSettings, type UnitNode, unitChain, visibleCostObjects } from '../src/hierarchy';
import { DEFAULT_SETTINGS, type Settings } from '../src/settings';

const units: UnitNode[] = [
  { key: 'unit-a', approvalRuleMode: 'Explicit' },
  { key: 'division-a1', parentKey: 'unit-a', approvalRuleMode: 'ExplicitAndFromParent' },
  { key: 'division-a2', parentKey: 'unit-a', approvalRuleMode: 'Explicit' },
  { key: 'unit-b' },
];
const co = (owner: string, code: string, extra: Partial<CostObject> = {}): CostObject => ({
  code,
  name: code,
  type: 'cost-center',
  ownerBusinessUnitKey: owner,
  active: true,
  ...extra,
});
const settings = (patch: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...patch });
const roles = (requesterRoles: string[]) => settings({ approval: { requesterRoles } });

describe('unitChain', () => {
  test('unit first, then ancestors', () => expect(unitChain('division-a1', units).map((u) => u.key)).toEqual(['division-a1', 'unit-a']));
  test('stops on a cycle', () =>
    expect(unitChain('x', [{ key: 'x', parentKey: 'y' }, { key: 'y', parentKey: 'x' }]).map((u) => u.key)).toEqual(['x', 'y']));
  test('unknown unit gives an empty chain', () => expect(unitChain('nope', units)).toEqual([]));
});

describe('visibleCostObjects', () => {
  const all = [co('unit-a', 'CC-100'), co('unit-b', 'CC-1'), co('unit-a', 'PRJ-1001', { linkedBusinessUnitKey: 'division-a1' })];
  const codes = (unit: string) => visibleCostObjects(unit, units, all).map((c) => c.code);
  test('division sees the parent cost objects, not other companies', () => {
    expect(codes('division-a1')).toContain('CC-100');
    expect(codes('division-a1')).not.toContain('CC-1');
  });
  test('linked cost object stays in its unit', () => {
    expect(codes('division-a1')).toContain('PRJ-1001');
    expect(codes('unit-a')).not.toContain('PRJ-1001');
    expect(codes('division-a2')).not.toContain('PRJ-1001');
  });
});

describe('effectiveSettings', () => {
  test('division without settings inherits from the nearest ancestor', () =>
    expect(effectiveSettings('division-a1', units, { 'unit-a': settings({ costObjectRequired: true }) }).costObjectRequired).toBe(true));
  test('own settings win', () =>
    expect(
      effectiveSettings('division-a1', units, {
        'unit-a': settings({ costObjectRequired: true }),
        'division-a1': settings({ costObjectRequired: false }),
      }).costObjectRequired,
    ).toBe(false));
  test('defaults when nothing is set', () => expect(effectiveSettings('division-a1', units, {})).toEqual(DEFAULT_SETTINGS));
});

describe('coveredRoles', () => {
  const records = { 'unit-a': roles(['buyer']), 'division-a1': roles(['site-buyer']), 'division-a2': roles(['site-buyer']) };
  test('top-level unit', () => expect(coveredRoles('unit-a', units, records)).toEqual(['buyer']));
  test('division inheriting rules adds the parent coverage', () =>
    expect(coveredRoles('division-a1', units, records)).toEqual(['site-buyer', 'buyer']));
  test('explicit division keeps its own coverage', () => expect(coveredRoles('division-a2', units, records)).toEqual(['site-buyer']));
  test('explicit division without own record is not covered by the parent rule', () =>
    expect(coveredRoles('division-a2', units, { 'unit-a': roles(['buyer']) })).toEqual([]));
  test('inheriting division without own record gets the parent coverage', () =>
    expect(coveredRoles('division-a1', units, { 'unit-a': roles(['buyer']) })).toEqual(['buyer']));
});
