// UI text of the panel frame. [BCC-VIEW-10]
import { defineMessages } from 'react-intl';

export default defineMessages({
  title: {
    id: 'BudgetPanel.title',
    description: 'Panel heading with the Business Unit name',
    defaultMessage: 'Budgets of {unitName}',
  },
  unitKey: {
    id: 'BudgetPanel.unitKey',
    description: 'Label before the Business Unit key',
    defaultMessage: 'Business Unit key',
  },
  loading: {
    id: 'BudgetPanel.loading',
    description: 'Shown while the Business Unit loads',
    defaultMessage: 'Loading the Business Unit',
  },
  notAUnitPage: {
    id: 'BudgetPanel.notAUnitPage',
    description: 'Shown when the host page is not a Business Unit detail page',
    defaultMessage: 'Open this panel on a Business Unit page.',
  },
  loadFailedTitle: {
    id: 'BudgetPanel.loadFailedTitle',
    description: 'Title of the error when the Business Unit cannot be loaded',
    defaultMessage: 'The Business Unit could not be loaded.',
  },
  loadFailedDetail: {
    id: 'BudgetPanel.loadFailedDetail',
    description: 'Detail of the error, with the platform message',
    defaultMessage: 'The platform answered: {message}',
  },
  sections: {
    id: 'BudgetPanel.sections',
    description: 'Accessible label of the tab list',
    defaultMessage: 'Budget sections',
  },
  tabCostObjects: {
    id: 'BudgetPanel.tabCostObjects',
    description: 'Tab label',
    defaultMessage: 'Cost objects',
  },
  tabBudgets: {
    id: 'BudgetPanel.tabBudgets',
    description: 'Tab label',
    defaultMessage: 'Budgets',
  },
  tabSettings: {
    id: 'BudgetPanel.tabSettings',
    description: 'Tab label',
    defaultMessage: 'Settings',
  },
  tabApproval: {
    id: 'BudgetPanel.tabApproval',
    description: 'Tab label',
    defaultMessage: 'Approval',
  },
});
