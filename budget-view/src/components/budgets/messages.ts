// UI text of the budgets section, the consumption bar and the CSV export. [BCC-VIEW-3] [BCC-VIEW-4] [BCC-VIEW-7]
// [BCC-VIEW-10]
import { defineMessages } from 'react-intl';

export default defineMessages({
  title: {
    id: 'Budgets.title',
    description: 'Section heading',
    defaultMessage: 'Budgets and limits',
  },
  empty: {
    id: 'Budgets.empty',
    description: 'Shown when the unit has no budget',
    defaultMessage: 'No budgets or limits yet.',
  },
  add: {
    id: 'Budgets.add',
    description: 'Button that opens the form for a new budget',
    defaultMessage: 'Add budget or limit',
  },
  edit: {
    id: 'Budgets.edit',
    description: 'Button text',
    defaultMessage: 'Edit',
  },
  editLabel: {
    id: 'Budgets.editLabel',
    description: 'Accessible label of the edit button',
    defaultMessage: 'Edit {key}',
  },
  deactivate: {
    id: 'Budgets.deactivate',
    description: 'Button text',
    defaultMessage: 'Deactivate',
  },
  deactivateLabel: {
    id: 'Budgets.deactivateLabel',
    description: 'Accessible label of the deactivate button',
    defaultMessage: 'Deactivate {key}',
  },
  inactive: {
    id: 'Budgets.inactive',
    description: 'Badge of a deactivated budget',
    defaultMessage: 'Inactive',
  },
  scopeCostObject: {
    id: 'Budgets.scopeCostObject',
    description: 'Scope kind',
    defaultMessage: 'Cost object',
  },
  scopeBusinessUnit: {
    id: 'Budgets.scopeBusinessUnit',
    description: 'Scope kind',
    defaultMessage: 'Business Unit',
  },
  scopeRole: {
    id: 'Budgets.scopeRole',
    description: 'Scope kind: a limit per person holding the role',
    defaultMessage: 'Associate Role',
  },
  scopeAssociate: {
    id: 'Budgets.scopeAssociate',
    description: 'Scope kind: a limit for one associate',
    defaultMessage: 'Associate',
  },
  periodMonth: {
    id: 'Budgets.periodMonth',
    description: 'Period kind',
    defaultMessage: 'Month',
  },
  periodQuarter: {
    id: 'Budgets.periodQuarter',
    description: 'Period kind',
    defaultMessage: 'Quarter',
  },
  periodYear: {
    id: 'Budgets.periodYear',
    description: 'Period kind',
    defaultMessage: 'Year',
  },
  periodRange: {
    id: 'Budgets.periodRange',
    description: 'Period kind: one fixed date range',
    defaultMessage: 'Date range',
  },
  summary: {
    id: 'Budgets.summary',
    description: 'One line describing a budget',
    defaultMessage:
      '{scopeKind} {scopeRef}: {amount} per {period}, mode {mode}, warning at {warnAt} %',
  },
  roleOverrides: {
    id: 'Budgets.roleOverrides',
    description: 'Lists the mode overrides per role',
    defaultMessage: 'Mode per role: {overrides}',
  },
  inEffect: {
    id: 'Budgets.inEffect',
    description: 'Period in effect today',
    defaultMessage: 'Period in effect: {from} to {to}',
  },
  notInEffect: {
    id: 'Budgets.notInEffect',
    description: 'The budget does not apply today',
    defaultMessage: 'Not in effect today.',
  },
  consumed: {
    id: 'Budgets.consumed',
    description: 'Consumption of a budget',
    defaultMessage:
      'Consumed {consumed} of {amount}, remaining {remaining} ({orders, plural, one {# order} other {# orders}})',
  },
  barLabel: {
    id: 'Budgets.barLabel',
    description: 'Accessible label of the consumption bar',
    defaultMessage: 'Consumption',
  },
  barLabelFor: {
    id: 'Budgets.barLabelFor',
    description: 'Label of the consumption bar of one person',
    defaultMessage: 'Consumption of {who}',
  },
  levelOk: {
    id: 'Budgets.levelOk',
    description: 'Consumption state',
    defaultMessage: 'Within budget',
  },
  levelWarn: {
    id: 'Budgets.levelWarn',
    description: 'Consumption state',
    defaultMessage: 'Warning level',
  },
  levelExceeded: {
    id: 'Budgets.levelExceeded',
    description: 'Consumption state',
    defaultMessage: 'Exceeded',
  },
  otherCurrency: {
    id: 'Budgets.otherCurrency',
    description: 'Hint about orders in another currency',
    defaultMessage:
      '{count, plural, one {# order in another currency is} other {# orders in another currency are}} not counted.',
  },
  allReplaced: {
    id: 'Budgets.allReplaced',
    description:
      'A role limit whose holders all have an own associate limit, which replaces it',
    defaultMessage:
      'Every holder of this role has an own associate limit, which replaces this role limit.',
  },
  noHolders: {
    id: 'Budgets.noHolders',
    description: 'A role limit nobody in the unit holds',
    defaultMessage: 'No associate of this unit holds this role.',
  },
  newTitle: {
    id: 'Budgets.newTitle',
    description: 'Heading of the form',
    defaultMessage: 'New budget or limit',
  },
  editTitle: {
    id: 'Budgets.editTitle',
    description: 'Heading of the edit form',
    defaultMessage: 'Edit {key}',
  },
  fieldScopeKind: {
    id: 'Budgets.fieldScopeKind',
    description: 'Form label: what the budget applies to',
    defaultMessage: 'Applies to',
  },
  fieldCostObject: {
    id: 'Budgets.fieldCostObject',
    description: 'Form label',
    defaultMessage: 'Cost object',
  },
  fieldRole: {
    id: 'Budgets.fieldRole',
    description: 'Form label',
    defaultMessage: 'Associate Role',
  },
  fieldAssociate: {
    id: 'Budgets.fieldAssociate',
    description: 'Form label',
    defaultMessage: 'Associate',
  },
  fieldUnit: {
    id: 'Budgets.fieldUnit',
    description: 'Shows the unit a Business Unit budget applies to',
    defaultMessage: 'Business Unit: {unitKey}',
  },
  choose: {
    id: 'Budgets.choose',
    description: 'Placeholder of a selection',
    defaultMessage: 'Choose',
  },
  fieldId: {
    id: 'Budgets.fieldId',
    description: 'Form label',
    defaultMessage: 'Budget ID',
  },
  fieldIdHint: {
    id: 'Budgets.fieldIdHint',
    description: 'Help text',
    defaultMessage:
      'Optional. Leave empty to generate one from scope and period.',
  },
  fieldAmount: {
    id: 'Budgets.fieldAmount',
    description: 'Form label',
    defaultMessage: 'Amount',
  },
  fieldCurrency: {
    id: 'Budgets.fieldCurrency',
    description: 'Form label',
    defaultMessage: 'Currency',
  },
  fieldPeriod: {
    id: 'Budgets.fieldPeriod',
    description: 'Form label',
    defaultMessage: 'Period',
  },
  fieldFrom: {
    id: 'Budgets.fieldFrom',
    description: 'Form label',
    defaultMessage: 'From',
  },
  fieldTo: {
    id: 'Budgets.fieldTo',
    description: 'Form label',
    defaultMessage: 'To',
  },
  fieldPeriodHint: {
    id: 'Budgets.fieldPeriodHint',
    description: 'Help text',
    defaultMessage:
      'Month, quarter and year repeat and must start on the first and end on the last day of such a period. To is optional except for a date range.',
  },
  datePlaceholder: {
    id: 'Budgets.datePlaceholder',
    description: 'Placeholder of a date field',
    defaultMessage: 'YYYY-MM-DD',
  },
  fieldMode: {
    id: 'Budgets.fieldMode',
    description: 'Form label',
    defaultMessage: 'Mode',
  },
  fieldModeFor: {
    id: 'Budgets.fieldModeFor',
    description: 'Form label of the mode override for one role',
    defaultMessage: 'Mode for {role}',
  },
  noOverride: {
    id: 'Budgets.noOverride',
    description: 'Option: no mode override for a role',
    defaultMessage: 'Budget mode',
  },
  fieldOverrides: {
    id: 'Budgets.fieldOverrides',
    description: 'Group heading',
    defaultMessage: 'Mode per role (the strictest applies)',
  },
  fieldWarnAt: {
    id: 'Budgets.fieldWarnAt',
    description: 'Form label',
    defaultMessage: 'Warn at percent',
  },
  exportTitle: {
    id: 'Budgets.exportTitle',
    description: 'Heading of the export',
    defaultMessage: 'Spend report',
  },
  exportPeriod: {
    id: 'Budgets.exportPeriod',
    description: 'Form label',
    defaultMessage: 'Report period',
  },
  exportDate: {
    id: 'Budgets.exportDate',
    description: 'Form label',
    defaultMessage: 'A date in the period',
  },
  exportButton: {
    id: 'Budgets.exportButton',
    description: 'Button',
    defaultMessage: 'Export CSV',
  },
  exported: {
    id: 'Budgets.exported',
    description: 'Confirmation of the export',
    defaultMessage: 'Exported {rows} rows.',
  },
  exportFailed: {
    id: 'Budgets.exportFailed',
    description: 'Export error',
    defaultMessage: 'The export failed: {message}',
  },
  exportBadDate: {
    id: 'Budgets.exportBadDate',
    description: 'Export date error',
    defaultMessage: 'Enter a date as YYYY-MM-DD.',
  },
});
