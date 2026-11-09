// Cost-object rows and the cost-object form. [BCC-VIEW-2] [BCC-COST-2] [BCC-COST-5] [BCC-PROJ-4]
import type { CostObject, UnitNode } from '../core';
import {
  costObjectFromForm,
  costObjectRows,
  emptyCostObjectForm,
  formFromCostObject,
} from './cost-objects';

const units: UnitNode[] = [
  { key: 'division-a1', parentKey: 'unit-a' },
  { key: 'unit-a' },
];

const co = (over: Partial<CostObject>): CostObject => ({
  code: 'CC-1',
  name: 'Cost center (fictional)',
  type: 'cost-center',
  ownerBusinessUnitKey: 'unit-a',
  active: true,
  ...over,
});

const rec = (value: CostObject, version = 1) => ({
  key: `${value.ownerBusinessUnitKey}~${value.code}`,
  version,
  value,
});

describe('costObjectRows', () => {
  it('lists own rows as editable and the active ones of ancestors read-only with the owner', () => {
    const rows = costObjectRows('division-a1', units, [
      rec(co({ code: 'CC-100' })),
      rec(co({ code: 'CC-OLD', active: false })),
      rec(
        co({
          code: 'SITE-7',
          ownerBusinessUnitKey: 'division-a1',
          type: 'site',
        })
      ),
      rec(
        co({
          code: 'SITE-8',
          ownerBusinessUnitKey: 'division-a1',
          active: false,
        })
      ),
      rec(co({ code: 'X-1', ownerBusinessUnitKey: 'unit-b' })),
      rec(co({ code: 'L-1', linkedBusinessUnitKey: 'division-a2' })),
    ]);
    expect(rows.map((r) => [r.key, r.editable, r.owner])).toEqual([
      ['division-a1~SITE-7', true, 'division-a1'],
      ['division-a1~SITE-8', true, 'division-a1'],
      ['unit-a~CC-100', false, 'unit-a'],
    ]);
  });
});

describe('costObjectFromForm', () => {
  it('keys a new cost object recordKey(unit, code) and trims empty fields away', () => {
    const r = costObjectFromForm('unit-a', {
      ...emptyCostObjectForm(),
      code: ' SITE-7 ',
      name: 'Riverside Depot (fictional)',
      type: 'site',
      externalId: '',
      validFrom: '2026-11-01',
      buyers: ['customer-1'],
    });
    expect(r).toEqual({
      ok: true,
      value: {
        key: 'unit-a~SITE-7',
        value: {
          code: 'SITE-7',
          name: 'Riverside Depot (fictional)',
          type: 'site',
          ownerBusinessUnitKey: 'unit-a',
          active: true,
          validFrom: '2026-11-01',
          buyers: ['customer-1'],
        },
      },
    });
  });

  it('adds project fields only to projects', () => {
    const form = {
      ...emptyCostObjectForm(),
      code: 'PRJ-1001',
      name: 'Harbour Hall (fictional)',
      type: 'project' as const,
      projectStatus: 'active' as const,
      siteAddress: '1 Quay Street',
      erpProjectNumber: 'ERP-77',
    };
    const project = costObjectFromForm('unit-a', form);
    expect(project.ok && project.value.value.project).toEqual({
      status: 'active',
      siteAddress: '1 Quay Street',
      erpProjectNumber: 'ERP-77',
    });
    const site = costObjectFromForm('unit-a', { ...form, type: 'site' });
    expect(site.ok && site.value.value).not.toHaveProperty('project');
  });

  it('returns core field errors and key errors', () => {
    const r = costObjectFromForm('unit-a', {
      ...emptyCostObjectForm(),
      code: 'bad code',
      name: '',
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.map((e) => e.field).sort()).toEqual([
      'code',
      'name',
    ]);
  });

  it('keeps fields the form does not show when editing, and refuses a code change', () => {
    const previous = co({
      code: 'CC-1',
      linkedBusinessUnitKey: 'division-a1',
      buyers: ['c-1'],
    });
    const edited = costObjectFromForm(
      'unit-a',
      { ...formFromCostObject(previous), name: 'Renamed (fictional)' },
      previous
    );
    expect(edited.ok && edited.value.value).toEqual({
      ...previous,
      name: 'Renamed (fictional)',
    });
    const recoded = costObjectFromForm(
      'unit-a',
      { ...formFromCostObject(previous), code: 'CC-2' },
      previous
    );
    expect(!recoded.ok && recoded.errors[0]?.field).toBe('code');
  });

  it('round-trips a stored cost object through the form', () => {
    const stored = co({
      code: 'PRJ-1',
      type: 'project',
      validTo: '2026-12-31',
      externalId: 'E-1',
      project: { status: 'planned', erpProjectNumber: 'ERP-1' },
    });
    const r = costObjectFromForm('unit-a', formFromCostObject(stored), stored);
    expect(r.ok && r.value.value).toEqual(stored);
  });
});
