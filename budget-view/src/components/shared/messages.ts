// UI text shared by the sections: loading, read errors, save problems and conflicts. [BCC-VIEW-10] [BCC-VIEW-8]
import { defineMessages } from 'react-intl';

export default defineMessages({
  loading: {
    id: 'Shared.loading',
    description: 'Accessible label of the spinner while a section loads',
    defaultMessage: 'Loading',
  },
  readFailedTitle: {
    id: 'Shared.readFailedTitle',
    description: 'Title when data of a section cannot be read',
    defaultMessage: 'Some data could not be read.',
  },
  readFailedDetail: {
    id: 'Shared.readFailedDetail',
    description: 'Detail of a read error, with the platform message',
    defaultMessage: 'The platform answered: {message}',
  },
  corruptRecords: {
    id: 'Shared.corruptRecords',
    description: 'Detail when stored records fail validation and are left out',
    defaultMessage: 'These records are invalid and are not shown: {keys}',
  },
  unknownContainer: {
    id: 'Shared.unknownContainer',
    description: 'Internal error: the view cannot read this container',
    defaultMessage: 'The view cannot read the container "{container}".',
  },
  conflictTitle: {
    id: 'Shared.conflictTitle',
    description:
      'Title when a save fails because someone else changed the record',
    defaultMessage: 'Someone else changed this record.',
  },
  conflictDetail: {
    id: 'Shared.conflictDetail',
    description: 'Detail of a version conflict',
    defaultMessage:
      'Your input is kept. Reload to see the latest version, then save again.',
  },
  reload: {
    id: 'Shared.reload',
    description: 'Button that reloads the records after a conflict',
    defaultMessage: 'Reload',
  },
  reloadedTitle: {
    id: 'Shared.reloadedTitle',
    description: 'Title after reloading a record that someone else changed',
    defaultMessage: 'The latest version was loaded.',
  },
  reloadedChanged: {
    id: 'Shared.reloadedChanged',
    description: 'The fields someone else changed, as a list of field labels',
    defaultMessage: 'Changed by someone else: {fields}.',
  },
  reloadedUnchanged: {
    id: 'Shared.reloadedUnchanged',
    description:
      'After a reload no field differs from the version the user started from',
    defaultMessage: 'No field differs from the version you started from.',
  },
  reloadedYours: {
    id: 'Shared.reloadedYours',
    description: 'The fields whose unsaved input the reload replaced',
    defaultMessage: 'Your unsaved values were replaced: {fields}.',
  },
  reapply: {
    id: 'Shared.reapply',
    description: 'Button that puts the replaced input back into the form',
    defaultMessage: 'Re-apply my values',
  },
  saveFailedTitle: {
    id: 'Shared.saveFailedTitle',
    description: 'Title when a save fails',
    defaultMessage: 'The change was not saved.',
  },
  fieldError: {
    id: 'Shared.fieldError',
    description: 'One validation error with the field it belongs to',
    defaultMessage: '{field}: {message}',
  },
  keyTaken: {
    id: 'Shared.keyTaken',
    description: 'Shown when a new record would replace an existing one',
    defaultMessage:
      'A record with the key {key} exists already. Choose another code or ID.',
  },
  saved: {
    id: 'Shared.saved',
    description: 'Confirmation after a save',
    defaultMessage: 'Saved.',
  },
  save: {
    id: 'Shared.save',
    description: 'Save button',
    defaultMessage: 'Save',
  },
  cancel: {
    id: 'Shared.cancel',
    description: 'Cancel button',
    defaultMessage: 'Cancel',
  },
  yes: {
    id: 'Shared.yes',
    description: 'Boolean value yes',
    defaultMessage: 'Yes',
  },
  no: {
    id: 'Shared.no',
    description: 'Boolean value no',
    defaultMessage: 'No',
  },
  modeApproval: {
    id: 'Shared.modeApproval',
    description: 'Budget mode: over-budget orders need approval',
    defaultMessage: 'Approval',
  },
  modeWarn: {
    id: 'Shared.modeWarn',
    description: 'Budget mode: over-budget orders go through with a warning',
    defaultMessage: 'Warn',
  },
  modeBlock: {
    id: 'Shared.modeBlock',
    description: 'Budget mode: over-budget orders are blocked',
    defaultMessage: 'Block',
  },
  field_value: {
    id: 'Shared.field.value',
    description: 'Field label in validation errors: value',
    defaultMessage: 'Record',
  },
  field_key: {
    id: 'Shared.field.key',
    description: 'Field label in validation errors: key',
    defaultMessage: 'Key',
  },
  field_container: {
    id: 'Shared.field.container',
    description: 'Field label in validation errors: container',
    defaultMessage: 'Container',
  },
  field_code: {
    id: 'Shared.field.code',
    description: 'Field label in validation errors: code',
    defaultMessage: 'Code',
  },
  field_name: {
    id: 'Shared.field.name',
    description: 'Field label in validation errors: name',
    defaultMessage: 'Name',
  },
  field_type: {
    id: 'Shared.field.type',
    description: 'Field label in validation errors: type',
    defaultMessage: 'Type',
  },
  field_ownerBusinessUnitKey: {
    id: 'Shared.field.ownerBusinessUnitKey',
    description: 'Field label in validation errors: ownerBusinessUnitKey',
    defaultMessage: 'Owner unit',
  },
  field_linkedBusinessUnitKey: {
    id: 'Shared.field.linkedBusinessUnitKey',
    description: 'Field label in validation errors: linkedBusinessUnitKey',
    defaultMessage: 'Linked unit',
  },
  field_active: {
    id: 'Shared.field.active',
    description: 'Field label in validation errors: active',
    defaultMessage: 'Active',
  },
  field_validFrom: {
    id: 'Shared.field.validFrom',
    description: 'Field label in validation errors: validFrom',
    defaultMessage: 'Valid from',
  },
  field_validTo: {
    id: 'Shared.field.validTo',
    description: 'Field label in validation errors: validTo',
    defaultMessage: 'Valid to',
  },
  field_externalId: {
    id: 'Shared.field.externalId',
    description: 'Field label in validation errors: externalId',
    defaultMessage: 'External ID',
  },
  field_buyers: {
    id: 'Shared.field.buyers',
    description: 'Field label in validation errors: buyers',
    defaultMessage: 'Allowed buyers',
  },
  field_project: {
    id: 'Shared.field.project',
    description: 'Field label in validation errors: project',
    defaultMessage: 'Project fields',
  },
  field_projectStatus: {
    id: 'Shared.field.projectStatus',
    description: 'Field label in validation errors: projectStatus',
    defaultMessage: 'Project status',
  },
  field_status: {
    id: 'Shared.field.status',
    description: 'Field label in validation errors: status',
    defaultMessage: 'Project status',
  },
  field_siteAddress: {
    id: 'Shared.field.siteAddress',
    description: 'Field label in validation errors: siteAddress',
    defaultMessage: 'Site address',
  },
  field_erpProjectNumber: {
    id: 'Shared.field.erpProjectNumber',
    description: 'Field label in validation errors: erpProjectNumber',
    defaultMessage: 'ERP project number',
  },
  field_custom_type: {
    id: 'Shared.field.custom.type',
    description: 'Field label in validation errors: custom.type',
    defaultMessage: 'Custom type',
  },
  field_id: {
    id: 'Shared.field.id',
    description: 'Field label in validation errors: id',
    defaultMessage: 'Budget ID',
  },
  field_scope: {
    id: 'Shared.field.scope',
    description: 'Field label in validation errors: scope',
    defaultMessage: 'Applies to',
  },
  field_scopeKind: {
    id: 'Shared.field.scopeKind',
    description: 'Field label in validation errors: scopeKind',
    defaultMessage: 'Applies to',
  },
  field_scopeRef: {
    id: 'Shared.field.scopeRef',
    description: 'Field label in validation errors: scopeRef',
    defaultMessage: 'Scope reference',
  },
  field_amount: {
    id: 'Shared.field.amount',
    description: 'Field label in validation errors: amount',
    defaultMessage: 'Amount',
  },
  field_currencyCode: {
    id: 'Shared.field.currencyCode',
    description: 'Field label in validation errors: currencyCode',
    defaultMessage: 'Currency',
  },
  field_period: {
    id: 'Shared.field.period',
    description: 'Field label in validation errors: period',
    defaultMessage: 'Period',
  },
  field_periodKind: {
    id: 'Shared.field.periodKind',
    description: 'Field label in validation errors: periodKind',
    defaultMessage: 'Period',
  },
  field_period_from: {
    id: 'Shared.field.period.from',
    description: 'Field label in validation errors: period.from',
    defaultMessage: 'From',
  },
  field_from: {
    id: 'Shared.field.from',
    description: 'Field label in validation errors: from',
    defaultMessage: 'From',
  },
  field_period_to: {
    id: 'Shared.field.period.to',
    description: 'Field label in validation errors: period.to',
    defaultMessage: 'To',
  },
  field_to: {
    id: 'Shared.field.to',
    description: 'Field label in validation errors: to',
    defaultMessage: 'To',
  },
  field_mode: {
    id: 'Shared.field.mode',
    description: 'Field label in validation errors: mode',
    defaultMessage: 'Mode',
  },
  field_modeByRole: {
    id: 'Shared.field.modeByRole',
    description: 'Field label in validation errors: modeByRole',
    defaultMessage: 'Mode per role',
  },
  field_warnAtPercent: {
    id: 'Shared.field.warnAtPercent',
    description: 'Field label in validation errors: warnAtPercent',
    defaultMessage: 'Warning threshold (%)',
  },
  field_defaultMode: {
    id: 'Shared.field.defaultMode',
    description: 'Field label in validation errors: defaultMode',
    defaultMessage: 'Default mode',
  },
  field_costObjectRequired: {
    id: 'Shared.field.costObjectRequired',
    description: 'Field label in validation errors: costObjectRequired',
    defaultMessage: 'Cost object required',
  },
  field_defaultCostObject: {
    id: 'Shared.field.defaultCostObject',
    description: 'Field label in validation errors: defaultCostObject',
    defaultMessage: 'Default cost object',
  },
  field_costObjectLevel: {
    id: 'Shared.field.costObjectLevel',
    description: 'Field label in validation errors: costObjectLevel',
    defaultMessage: 'Cost object level',
  },
  field_features: {
    id: 'Shared.field.features',
    description: 'Field label in validation errors: features',
    defaultMessage: 'Features',
  },
  field_approval: {
    id: 'Shared.field.approval',
    description: 'Field label in validation errors: approval',
    defaultMessage: 'Approval coverage',
  },
  field_requesters: {
    id: 'Shared.field.requesters',
    description: 'Field label in validation errors: requesters',
    defaultMessage: 'Requester roles',
  },
  field_approvers: {
    id: 'Shared.field.approvers',
    description: 'Field label in validation errors: approvers',
    defaultMessage: 'Approver tiers',
  },
  field_unknown: {
    id: 'Shared.field.unknown',
    description:
      'Field label in validation errors for a field the view does not know',
    defaultMessage: 'Input',
  },
});
