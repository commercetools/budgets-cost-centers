// [BCC-SET-2] [BCC-APPR-2] [BCC-CART-4]
import { DEFAULT_SETTINGS, type Settings } from 'budgets-cost-centers-core';
import { loadUnitContext } from '../src/unit-context';
import { FakePlatform } from './fake-platform';

const settings = (patch: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...patch });
const setup = () => {
  const p = new FakePlatform();
  p.units = [
    {
      key: 'division-a1',
      parentUnit: { key: 'unit-a' },
      approvalRuleMode: 'ExplicitAndFromParent',
      associates: [{ customer: { id: 'cust-1' }, associateRoleAssignments: [{ associateRole: { key: 'site-buyer' } }] }],
      inheritedAssociates: [
        { customer: { id: 'cust-1' }, associateRoleAssignments: [{ associateRole: { key: 'buyer' } }, { associateRole: { key: 'site-buyer' } }] },
      ],
    },
    { key: 'unit-a', approvalRuleMode: 'Explicit', associates: [] },
  ];
  p.objects = [
    { container: 'bcc-settings', key: 'unit-a', value: settings({ costObjectRequired: true, approval: { requesterRoles: ['buyer'] } }) },
  ];
  return p;
};

test('loads the chain and resolves settings from the nearest record', async () => {
  const ctx = await loadUnitContext(setup(), 'division-a1');
  expect(ctx.units.map((u) => u.key)).toEqual(['division-a1', 'unit-a']);
  expect(ctx.units[0]).toEqual({ key: 'division-a1', parentKey: 'unit-a', approvalRuleMode: 'ExplicitAndFromParent' });
  expect(ctx.effective.costObjectRequired).toBe(true);
});
test('coverage follows the approval rule mode', async () => {
  expect((await loadUnitContext(setup(), 'division-a1')).covered).toEqual(['buyer']);
  const p = setup();
  p.units[0]!.approvalRuleMode = 'Explicit';
  expect((await loadUnitContext(p, 'division-a1')).covered).toEqual([]);
});
test('roles merge direct and inherited assignments without duplicates', async () => {
  const ctx = await loadUnitContext(setup(), 'division-a1');
  expect(ctx.rolesOf('cust-1')).toEqual(['site-buyer', 'buyer']);
  expect(ctx.rolesOf('cust-9')).toEqual([]);
  expect(ctx.rolesOf(undefined)).toEqual([]);
});
test('a corrupt settings record fails loudly', async () => {
  const p = setup();
  p.objects[0]!.value = { defaultMode: 'stop' };
  await expect(loadUnitContext(p, 'division-a1')).rejects.toThrow('Invalid settings record unit-a');
});
test('an unknown unit fails', async () => {
  await expect(loadUnitContext(setup(), 'nope')).rejects.toThrow('Business Unit nope not found');
});
test('a parent cycle stops after six levels', async () => {
  const p = new FakePlatform();
  p.units = [
    { key: 'a', parentUnit: { key: 'b' }, associates: [] },
    { key: 'b', parentUnit: { key: 'a' }, associates: [] },
  ];
  const ctx = await loadUnitContext(p, 'a');
  expect(ctx.units.map((u) => u.key)).toEqual(['a', 'b']);
  expect(p.calls.filter((c) => c.method === 'getBusinessUnit').length).toBeLessThanOrEqual(6);
});
