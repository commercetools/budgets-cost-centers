// [BCC-APPR-1] [BCC-APPR-3] [BCC-APPR-8]
import { coverageAfterRuleChange, isBudgetPredicate, toRuleChange } from '../src/approval-rule';

test.each(['custom.bccBudgetExceeded = true', 'custom.bccBudgetExceeded=true', '  (custom.bccBudgetExceeded = true) ', 'custom.bccBudgetExceeded  =  true'])(
  'exact budget predicate counts: %s',
  (p) => expect(isBudgetPredicate(p)).toBe(true),
);
test.each([
  'custom.bccBudgetExceeded = true and totalPrice.centAmount > 1000000',
  'not(custom.bccBudgetExceeded = true)',
  'custom.bccBudgetExceeded = false',
  'custom.bccBudgetExceeded = true or totalPrice.centAmount > 1',
  '',
])('a conditional or other predicate does not count: %s', (p) => expect(isBudgetPredicate(p)).toBe(false));

describe('[BCC-APPR-8] coverage after a rule change', () => {
  const cov = { ruleKey: 'r', ruleId: 'rule-1', requesterRoles: ['buyer', 'site-buyer'], checkedAt: '2026-10-01T00:00:00.000Z' };
  const at = '2026-10-30T10:00:00.000Z';
  test('a rule set to Inactive covers nobody', () =>
    expect(coverageAfterRuleChange(cov, { type: 'ApprovalRuleStatusSet', ruleId: 'rule-1', status: 'Inactive', at })).toEqual({ ...cov, requesterRoles: [], checkedAt: at }));
  test('a rule set to Active does not restore coverage', () =>
    expect(coverageAfterRuleChange({ ...cov, requesterRoles: [] }, { type: 'ApprovalRuleStatusSet', ruleId: 'rule-1', status: 'Active', at })).toBeUndefined());
  test('a conditional predicate covers nobody', () =>
    expect(coverageAfterRuleChange(cov, { type: 'ApprovalRulePredicateSet', ruleId: 'rule-1', predicate: 'custom.bccBudgetExceeded = true and x = 1', at })?.requesterRoles).toEqual([]));
  test('the exact predicate keeps coverage', () =>
    expect(coverageAfterRuleChange(cov, { type: 'ApprovalRulePredicateSet', ruleId: 'rule-1', predicate: 'custom.bccBudgetExceeded = true', at })).toBeUndefined());
  test('new requesters replace the covered roles while coverage exists', () =>
    expect(coverageAfterRuleChange(cov, { type: 'ApprovalRuleRequestersSet', ruleId: 'rule-1', requesterRoles: ['buyer'], at })?.requesterRoles).toEqual(['buyer']));
  test('new requesters do not create coverage that was cleared', () =>
    expect(coverageAfterRuleChange({ ...cov, requesterRoles: [] }, { type: 'ApprovalRuleRequestersSet', ruleId: 'rule-1', requesterRoles: ['buyer'], at })).toBeUndefined());
  test('another rule changes nothing', () =>
    expect(coverageAfterRuleChange(cov, { type: 'ApprovalRuleStatusSet', ruleId: 'rule-2', status: 'Inactive', at })).toBeUndefined());
  test('messages are parsed with role keys', () => {
    expect(toRuleChange({ type: 'ApprovalRuleRequestersSet', resource: { typeId: 'approval-rule', id: 'rule-1' }, createdAt: at, requesters: [{ associateRole: { typeId: 'associate-role', key: 'buyer' } }] })).toEqual({
      type: 'ApprovalRuleRequestersSet', ruleId: 'rule-1', requesterRoles: ['buyer'], at,
    });
    expect(toRuleChange({ type: 'ApprovalFlowCreated' })).toBeUndefined();
  });
});
