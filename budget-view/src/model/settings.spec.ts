// Settings form: full record merged from the effective settings, default cost object options.
// [BCC-VIEW-5] [BCC-SET-1] [BCC-SET-2] [BCC-SET-4] [BCC-APPR-2]
import {
  type CostObject,
  DEFAULT_SETTINGS,
  type Settings,
  type UnitNode,
} from '../core';
import {
  defaultCostObjectOptions,
  settingsDraft,
  settingsFromForm,
  settingsFormOf,
  visibleCostObjectKeys,
} from './settings';

const units: UnitNode[] = [
  { key: 'division-a1', parentKey: 'unit-a' },
  { key: 'unit-a' },
];

const parent: Settings = {
  defaultMode: 'block',
  costObjectRequired: true,
  defaultCostObject: 'unit-a~CC-100',
  costObjectLevel: 'order',
  features: { projects: false },
  approval: {
    ruleKey: 'bcc-budget-unit-a',
    requesterRoles: ['buyer'],
    checkedAt: '2026-10-01T00:00:00.000Z',
  },
};

describe('settingsDraft', () => {
  it('uses the own record with its version', () => {
    const d = settingsDraft('unit-a', units, [
      { key: 'unit-a', version: 4, value: parent },
    ]);
    expect(d).toEqual({ value: parent, version: 4, source: 'own' });
  });

  it('pre-fills a division without a record from the nearest ancestor', () => {
    const d = settingsDraft('division-a1', units, [
      { key: 'unit-a', version: 4, value: parent },
    ]);
    expect(d).toEqual({ value: parent, source: 'inherited', from: 'unit-a' });
  });

  it('falls back to the defaults', () => {
    expect(settingsDraft('division-a1', units, [])).toEqual({
      value: DEFAULT_SETTINGS,
      source: 'defaults',
    });
  });
});

describe('settingsFromForm', () => {
  it('writes a full record, so a division keeps the inherited costObjectRequired and default (Review Focus 1)', () => {
    const d = settingsDraft('division-a1', units, [
      { key: 'unit-a', version: 4, value: parent },
    ]);
    const form = { ...settingsFormOf(d), defaultMode: 'warn' as const };
    expect(settingsFromForm(d, form)).toEqual({
      defaultMode: 'warn',
      costObjectRequired: true,
      defaultCostObject: 'unit-a~CC-100',
      costObjectLevel: 'order',
      features: { projects: false },
      // Coverage is per unit and never copied from an ancestor [BCC-APPR-2].
      approval: { requesterRoles: [] },
    });
  });

  it('keeps the own coverage record and clears the default when none is chosen', () => {
    const d = settingsDraft('unit-a', units, [
      { key: 'unit-a', version: 4, value: parent },
    ]);
    const s = settingsFromForm(d, {
      ...settingsFormOf(d),
      costObjectRequired: false,
      defaultCostObject: '',
    });
    expect(s).toEqual({
      ...parent,
      costObjectRequired: false,
      defaultCostObject: undefined,
    });
    expect(s).not.toHaveProperty('defaultCostObject');
  });
});

describe('defaultCostObjectOptions', () => {
  const co = (over: Partial<CostObject>): CostObject => ({
    code: 'CC-100',
    name: 'Main (fictional)',
    type: 'cost-center',
    ownerBusinessUnitKey: 'unit-a',
    active: true,
    ...over,
  });
  const all = [
    co({}),
    co({ code: 'OLD', active: false }),
    co({ code: 'LATE', validFrom: '2027-01-01' }),
    co({ code: 'PRJ-P', type: 'project', project: { status: 'planned' } }),
    co({ code: 'OWN', ownerBusinessUnitKey: 'division-a1' }),
    co({ code: 'X', ownerBusinessUnitKey: 'unit-b' }),
  ];

  it('offers only visible and usable cost objects [BCC-SET-4]', () => {
    expect(
      defaultCostObjectOptions(
        'division-a1',
        units,
        all,
        '2026-11-02T10:00:00.000Z'
      ).map((o) => o.key)
    ).toEqual(['division-a1~OWN', 'unit-a~CC-100']);
  });

  it('lists every visible key for the write check', () => {
    expect(visibleCostObjectKeys('division-a1', units, all).sort()).toEqual([
      'division-a1~OWN',
      'unit-a~CC-100',
      'unit-a~LATE',
      'unit-a~OLD',
      'unit-a~PRJ-P',
    ]);
  });
});
