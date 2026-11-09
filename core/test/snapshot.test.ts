// [BCC-CART-2] [BCC-CART-7] [BCC-CART-11] [BCC-PROJ-3]
import type { Outcome } from '../src/evaluate';
import { snapshotActions } from '../src/snapshot';

const outcome: Outcome = {
  status: 'warn',
  exceeded: false,
  scopes: [{ key: 'unit-a~b1', kind: 'business-unit', amount: 100000, used: 70000, projected: 85000, level: 'warn', mode: 'approval' }],
};
const scopesJson = JSON.stringify(outcome.scopes);
const now = '2026-10-29T10:00:00.000Z';
const stored = { typeKey: 'bcc-order', fields: { bccBudgetStatus: 'warn', bccBudgetExceeded: false, bccBudgetScopes: scopesJson, bccCheckedAt: '2026-10-28T10:00:00.000Z' } };
const input = { custom: stored, configuredTypeKey: 'bcc-order', outcome, now, isProject: false, projectRetentionDays: 365 };

test('nothing changed: no actions, no checkedAt write', () => expect(snapshotActions(input)).toEqual({ ok: true, value: [] }));

test('scopes are compact JSON', () => expect(scopesJson).not.toMatch(/\s/));

test('changed status writes the snapshot fields and checkedAt', () =>
  expect(snapshotActions({ ...input, outcome: { ...outcome, status: 'exceeded', exceeded: true } })).toEqual({
    ok: true,
    value: [
      { action: 'setCustomField', name: 'bccBudgetStatus', value: 'exceeded' },
      { action: 'setCustomField', name: 'bccBudgetExceeded', value: true },
      { action: 'setCustomField', name: 'bccCheckedAt', value: now },
    ],
  }));

test('cart without a type gets the configured type with all fields', () =>
  expect(snapshotActions({ ...input, custom: undefined })).toEqual({
    ok: true,
    value: [
      {
        action: 'setCustomType',
        type: { typeId: 'type', key: 'bcc-order' },
        fields: { bccBudgetStatus: 'warn', bccBudgetExceeded: false, bccBudgetScopes: scopesJson, bccCheckedAt: now },
      },
    ],
  }));

test('foreign cart type is rejected, naming the type', () => {
  const r = snapshotActions({ ...input, custom: { ...stored, typeKey: 'shop-cart' } });
  expect(r.ok).toBe(false);
  expect(JSON.stringify(r)).toContain('shop-cart');
});

test('defaulted cost object is written', () =>
  expect(snapshotActions({ ...input, defaultedCostObject: 'unit-a~CC-100' })).toEqual({
    ok: true,
    value: [{ action: 'setCustomField', name: 'bccCostObject', value: 'unit-a~CC-100' }],
  }));

test('defaulted cost object goes into setCustomType fields', () => {
  const r = snapshotActions({ ...input, custom: undefined, defaultedCostObject: 'unit-a~CC-100' });
  expect(r.ok && r.value[0]).toMatchObject({ fields: { bccCostObject: 'unit-a~CC-100' } });
});

test('project cart retention is raised to the configured days', () => {
  expect(snapshotActions({ ...input, isProject: true, deleteDaysAfterLastModification: 90 })).toEqual({
    ok: true,
    value: [{ action: 'setDeleteDaysAfterLastModification', deleteDaysAfterLastModification: 365 }],
  });
  expect(snapshotActions({ ...input, isProject: true })).toMatchObject({ ok: true, value: [{ deleteDaysAfterLastModification: 365 }] });
  expect(snapshotActions({ ...input, isProject: true, deleteDaysAfterLastModification: 400 })).toEqual({ ok: true, value: [] });
});
