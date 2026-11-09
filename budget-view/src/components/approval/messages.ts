// UI text of the Approval Rule check and setup. [BCC-APPR-3] [BCC-APPR-4] [BCC-VIEW-10]
import { defineMessages } from 'react-intl';

export default defineMessages({
  title: {
    id: 'Approval.title',
    description: 'Section heading',
    defaultMessage: 'Budget approval',
  },
  intro: {
    id: 'Approval.intro',
    description: 'Explains the section',
    defaultMessage:
      'Over-budget orders in mode approval go through a native Approval Rule on custom.bccBudgetExceeded = true. Roles no active budget rule covers are blocked instead.',
  },
  checkedAt: {
    id: 'Approval.checkedAt',
    description: 'When the coverage was last checked',
    defaultMessage: 'Coverage last checked: {checkedAt}',
  },
  neverChecked: {
    id: 'Approval.neverChecked',
    description: 'Coverage never checked',
    defaultMessage: 'Coverage has never been checked for this unit.',
  },
  coveredRoles: {
    id: 'Approval.coveredRoles',
    description: 'Recorded requester roles',
    defaultMessage: 'Covered requester roles: {roles}',
  },
  none: {
    id: 'Approval.none',
    description: 'Empty list',
    defaultMessage: 'none',
  },
  recordInherited: {
    id: 'Approval.recordInherited',
    description: 'The unit has no own settings record',
    defaultMessage:
      'This unit has no own settings record, so no role is covered here. Saving a check creates it from the effective settings.',
  },
  actAs: {
    id: 'Approval.actAs',
    description: 'Label of the associate picker',
    defaultMessage: 'Act as associate',
  },
  choose: {
    id: 'Approval.choose',
    description: 'Placeholder of the associate picker',
    defaultMessage: 'Choose an associate',
  },
  actAsHint: {
    id: 'Approval.actAsHint',
    description: 'Why the view needs an associate',
    defaultMessage:
      'Approval Rules are only available through associate endpoints. Only associates holding CreateApprovalRules are offered.',
  },
  actingAs: {
    id: 'Approval.actingAs',
    description: 'Names the associate the view acts for',
    defaultMessage:
      'The view acts as {associate}, an associate of {unitKey}, to read and create Approval Rules.',
  },
  noCandidates: {
    id: 'Approval.noCandidates',
    description: 'No associate may create Approval Rules',
    defaultMessage:
      'No associate of {unitKey} holds CreateApprovalRules, so the rule cannot be checked or set up here.',
  },
  rulesTitle: {
    id: 'Approval.rulesTitle',
    description: 'Heading',
    defaultMessage: 'Active budget rules',
  },
  noRule: {
    id: 'Approval.noRule',
    description: 'No active budget rule',
    defaultMessage: 'No active budget rule exists in this unit.',
  },
  colRule: {
    id: 'Approval.colRule',
    description: 'Column header',
    defaultMessage: 'Rule',
  },
  colRequesters: {
    id: 'Approval.colRequesters',
    description: 'Column header',
    defaultMessage: 'Requester roles',
  },
  colApprovers: {
    id: 'Approval.colApprovers',
    description: 'Column header',
    defaultMessage: 'Approver tiers',
  },
  colCoverage: {
    id: 'Approval.colCoverage',
    description: 'Column header: whether the rule counts as budget coverage',
    defaultMessage: 'Coverage',
  },
  counts: {
    id: 'Approval.counts',
    description:
      'The rule predicate is exactly the budget flag, so it counts as coverage',
    defaultMessage: 'Counts for coverage.',
  },
  notCounts: {
    id: 'Approval.notCounts',
    description:
      'The rule predicate has more conditions, so it does not count as coverage',
    defaultMessage:
      'Does not count for coverage: the predicate has further conditions.',
  },
  reasonRuleNotExact: {
    id: 'Approval.reasonRuleNotExact',
    description: 'Stale reason',
    defaultMessage:
      'The recorded rule has further conditions, so it no longer covers every over-budget order.',
  },
  rulesLabel: {
    id: 'Approval.rulesLabel',
    description: 'Accessible label of the rule table',
    defaultMessage: 'Active budget rules of this unit',
  },
  missing: {
    id: 'Approval.missing',
    description: 'Warning about roles not covered',
    defaultMessage:
      '{roles} may place orders but no active budget rule lists them as requesters. Their over-budget orders in mode approval are blocked.',
  },
  current: {
    id: 'Approval.current',
    description: 'Coverage matches the rules',
    defaultMessage: 'The coverage record matches the rules.',
  },
  stale: {
    id: 'Approval.stale',
    description: 'Coverage is out of date',
    defaultMessage: 'The coverage record is out of date.',
  },
  reasonNeverChecked: {
    id: 'Approval.reasonNeverChecked',
    description: 'Stale reason',
    defaultMessage: 'It was never checked.',
  },
  reasonRuleMissing: {
    id: 'Approval.reasonRuleMissing',
    description: 'Stale reason',
    defaultMessage: 'The recorded rule does not exist any more.',
  },
  reasonRuleInactive: {
    id: 'Approval.reasonRuleInactive',
    description: 'Stale reason',
    defaultMessage: 'The recorded rule is no longer an active budget rule.',
  },
  reasonRuleChanged: {
    id: 'Approval.reasonRuleChanged',
    description: 'Stale reason',
    defaultMessage: 'The rule changed after the last check.',
  },
  reasonRequesters: {
    id: 'Approval.reasonRequesters',
    description: 'Stale reason',
    defaultMessage:
      'The requester roles of the active budget rules differ from the record.',
  },
  saveCheck: {
    id: 'Approval.saveCheck',
    description: 'Button that writes the coverage record',
    defaultMessage: 'Save check result',
  },
  checkSaved: {
    id: 'Approval.checkSaved',
    description: 'Confirmation',
    defaultMessage: 'The coverage record is up to date.',
  },
  setupTitle: {
    id: 'Approval.setupTitle',
    description: 'Heading of the setup',
    defaultMessage: 'Set up budget approval',
  },
  requesters: {
    id: 'Approval.requesters',
    description: 'Group heading',
    defaultMessage: 'Requester roles',
  },
  requesterLabel: {
    id: 'Approval.requesterLabel',
    description: 'Accessible label of a requester checkbox',
    defaultMessage: 'Requester {role}',
  },
  tier: {
    id: 'Approval.tier',
    description: 'Group heading of an approver tier',
    defaultMessage: 'Approver tier {n} (any of these roles approves)',
  },
  tierRoleLabel: {
    id: 'Approval.tierRoleLabel',
    description: 'Accessible label of an approver checkbox',
    defaultMessage: 'Tier {n} {role}',
  },
  addTier: {
    id: 'Approval.addTier',
    description: 'Button',
    defaultMessage: 'Add approver tier',
  },
  create: {
    id: 'Approval.create',
    description: 'Button that creates the rule',
    defaultMessage: 'Create rule as {associate}',
  },
  createFailed: {
    id: 'Approval.createFailed',
    description: 'Error',
    defaultMessage: 'The rule was not created: {message}',
  },
  readFailed: {
    id: 'Approval.readFailed',
    description: 'Error',
    defaultMessage: 'The Approval Rules could not be read: {message}',
  },
});
