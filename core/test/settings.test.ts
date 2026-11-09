// [BCC-SET-1] [BCC-SET-3] [BCC-SET-4]
import { DEFAULT_SETTINGS, type Settings, validateSettings, validateSettingsForWrite } from '../src/settings';

const valid: Settings = {
  defaultMode: 'approval',
  costObjectRequired: true,
  defaultCostObject: 'unit-a~CC-100',
  costObjectLevel: 'order',
  features: { projects: true },
  approval: { ruleKey: 'bcc-budget', requesterRoles: ['buyer'], checkedAt: '2026-10-29T10:00:00.000Z' },
};
const visible = ['unit-a~CC-100'];
const fields = (r: ReturnType<typeof validateSettingsForWrite>) => (r.ok ? [] : r.errors.map((e) => e.field));

test('accepts a full value', () => expect(validateSettingsForWrite(valid, visible)).toEqual({ ok: true, value: valid }));
test('defaults are valid', () => expect(validateSettingsForWrite(DEFAULT_SETTINGS, []).ok).toBe(true));
test('defaults match the spec', () =>
  expect(DEFAULT_SETTINGS).toEqual({
    defaultMode: 'approval',
    costObjectRequired: false,
    costObjectLevel: 'order',
    features: { projects: true },
    approval: { requesterRoles: [] },
  }));
test('line level is reserved', () => {
  const r = validateSettingsForWrite({ ...valid, costObjectLevel: 'line' }, visible);
  expect(fields(r)).toEqual(['costObjectLevel']);
  expect(JSON.stringify(r)).toContain('reserved');
});
test('default cost object must be visible to the unit', () =>
  expect(fields(validateSettingsForWrite({ ...valid, defaultCostObject: 'unit-b~CC-1' }, visible))).toEqual(['defaultCostObject']));
test('null is rejected without throwing', () => expect(validateSettingsForWrite(null, visible).ok).toBe(false));
test('unknown default mode', () => expect(fields(validateSettingsForWrite({ ...valid, defaultMode: 'stop' }, visible))).toEqual(['defaultMode']));
test('requester roles must be a list', () =>
  expect(fields(validateSettingsForWrite({ ...valid, approval: { requesterRoles: 'buyer' } }, visible))).toEqual(['approval']));

test('on read a default cost object that is no longer visible keeps the record (review fix)', () => {
  const r = validateSettings({ ...valid, defaultCostObject: 'unit-a~CC-gone' });
  expect(r).toMatchObject({ ok: true, value: { costObjectRequired: true, defaultCostObject: 'unit-a~CC-gone' } });
});

test('the coverage record may name the rule by id (rule-change invalidation)', () => {
  const r = validateSettings({ ...DEFAULT_SETTINGS, approval: { ruleKey: 'k', ruleId: 'r-1', requesterRoles: ['buyer'], checkedAt: '2026-10-30T10:00:00.000Z' } });
  expect(r.ok && r.value.approval.ruleId).toBe('r-1');
  expect(validateSettings({ ...DEFAULT_SETTINGS, approval: { ruleId: 7, requesterRoles: [] } }).ok).toBe(false);
});
