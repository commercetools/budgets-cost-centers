// UI text of the cost objects section. [BCC-VIEW-2] [BCC-VIEW-10]
import { defineMessages } from 'react-intl';

export default defineMessages({
  title: {
    id: 'CostObjects.title',
    description: 'Section heading',
    defaultMessage: 'Cost objects',
  },
  tableLabel: {
    id: 'CostObjects.tableLabel',
    description: 'Accessible label of the table',
    defaultMessage: 'Cost objects of this unit and its parents',
  },
  empty: {
    id: 'CostObjects.empty',
    description: 'Shown when the unit sees no cost object',
    defaultMessage: 'No cost objects yet.',
  },
  colCode: {
    id: 'CostObjects.colCode',
    description: 'Column header',
    defaultMessage: 'Code',
  },
  colName: {
    id: 'CostObjects.colName',
    description: 'Column header',
    defaultMessage: 'Name',
  },
  colType: {
    id: 'CostObjects.colType',
    description: 'Column header',
    defaultMessage: 'Type',
  },
  colOwner: {
    id: 'CostObjects.colOwner',
    description: 'Column header: owner Business Unit',
    defaultMessage: 'Owner',
  },
  colStatus: {
    id: 'CostObjects.colStatus',
    description: 'Column header',
    defaultMessage: 'Status',
  },
  colActions: {
    id: 'CostObjects.colActions',
    description: 'Column header',
    defaultMessage: 'Actions',
  },
  active: {
    id: 'CostObjects.active',
    description: 'Status of an active cost object',
    defaultMessage: 'Active',
  },
  inactive: {
    id: 'CostObjects.inactive',
    description: 'Status of a deactivated cost object',
    defaultMessage: 'Inactive',
  },
  inherited: {
    id: 'CostObjects.inherited',
    description: 'Marks a cost object of a parent unit',
    defaultMessage: 'Inherited, read-only',
  },
  typeCostCenter: {
    id: 'CostObjects.typeCostCenter',
    description: 'Cost object type',
    defaultMessage: 'Cost center',
  },
  typeProject: {
    id: 'CostObjects.typeProject',
    description: 'Cost object type',
    defaultMessage: 'Project',
  },
  typeSite: {
    id: 'CostObjects.typeSite',
    description: 'Cost object type',
    defaultMessage: 'Site',
  },
  add: {
    id: 'CostObjects.add',
    description: 'Button that opens the form for a new cost object',
    defaultMessage: 'Add cost object',
  },
  edit: {
    id: 'CostObjects.edit',
    description: 'Button text to edit a cost object',
    defaultMessage: 'Edit',
  },
  editLabel: {
    id: 'CostObjects.editLabel',
    description: 'Accessible label of the edit button',
    defaultMessage: 'Edit {code}',
  },
  deactivate: {
    id: 'CostObjects.deactivate',
    description: 'Button text to deactivate a cost object',
    defaultMessage: 'Deactivate',
  },
  deactivateLabel: {
    id: 'CostObjects.deactivateLabel',
    description: 'Accessible label of the deactivate button',
    defaultMessage: 'Deactivate {code}',
  },
  openProject: {
    id: 'CostObjects.openProject',
    description: 'Button text to open the project overview',
    defaultMessage: 'Open project',
  },
  openProjectLabel: {
    id: 'CostObjects.openProjectLabel',
    description: 'Accessible label of the open project button',
    defaultMessage: 'Open project {code}',
  },
  newTitle: {
    id: 'CostObjects.newTitle',
    description: 'Heading of the form for a new cost object',
    defaultMessage: 'New cost object',
  },
  editTitle: {
    id: 'CostObjects.editTitle',
    description: 'Heading of the edit form',
    defaultMessage: 'Edit {code}',
  },
  fieldCode: {
    id: 'CostObjects.fieldCode',
    description: 'Form label',
    defaultMessage: 'Code',
  },
  fieldCodeHint: {
    id: 'CostObjects.fieldCodeHint',
    description: 'Help text of the code field',
    defaultMessage:
      'Letters, digits, "-", "_" or ".". The code cannot change later.',
  },
  fieldName: {
    id: 'CostObjects.fieldName',
    description: 'Form label',
    defaultMessage: 'Name',
  },
  fieldType: {
    id: 'CostObjects.fieldType',
    description: 'Form label',
    defaultMessage: 'Type',
  },
  fieldExternalId: {
    id: 'CostObjects.fieldExternalId',
    description: 'Form label',
    defaultMessage: 'External ID',
  },
  fieldValidFrom: {
    id: 'CostObjects.fieldValidFrom',
    description: 'Form label',
    defaultMessage: 'Valid from',
  },
  fieldValidTo: {
    id: 'CostObjects.fieldValidTo',
    description: 'Form label',
    defaultMessage: 'Valid to',
  },
  datePlaceholder: {
    id: 'CostObjects.datePlaceholder',
    description: 'Placeholder of a date field',
    defaultMessage: 'YYYY-MM-DD',
  },
  fieldBuyers: {
    id: 'CostObjects.fieldBuyers',
    description: 'Group label for allowed buyers',
    defaultMessage: 'Allowed buyers',
  },
  fieldBuyersHint: {
    id: 'CostObjects.fieldBuyersHint',
    description: 'Help text for allowed buyers',
    defaultMessage: 'Pick none to allow every associate of the unit.',
  },
  buyerOfDivision: {
    id: 'CostObjects.buyerOfDivision',
    description:
      'A possible buyer who is an associate of a division of the unit',
    defaultMessage: '{label}, {unitKey}',
  },
  formerBuyer: {
    id: 'CostObjects.formerBuyer',
    description:
      'A listed buyer who is no associate of the unit or its divisions any more',
    defaultMessage: '{id} (no longer an associate)',
  },
  noAssociates: {
    id: 'CostObjects.noAssociates',
    description: 'Shown when the unit has no associates',
    defaultMessage: 'This unit has no associates.',
  },
  fieldProjectStatus: {
    id: 'CostObjects.fieldProjectStatus',
    description: 'Form label',
    defaultMessage: 'Project status',
  },
  fieldSiteAddress: {
    id: 'CostObjects.fieldSiteAddress',
    description: 'Form label',
    defaultMessage: 'Site address',
  },
  fieldErpProjectNumber: {
    id: 'CostObjects.fieldErpProjectNumber',
    description: 'Form label',
    defaultMessage: 'ERP project number',
  },
  statusPlanned: {
    id: 'CostObjects.statusPlanned',
    description: 'Project status',
    defaultMessage: 'Planned',
  },
  statusActive: {
    id: 'CostObjects.statusActive',
    description: 'Project status',
    defaultMessage: 'Active',
  },
  statusClosed: {
    id: 'CostObjects.statusClosed',
    description: 'Project status',
    defaultMessage: 'Closed',
  },
});
