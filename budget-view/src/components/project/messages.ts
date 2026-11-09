// UI text of the project overview. [BCC-VIEW-6] [BCC-PROJ-1] [BCC-PROJ-4] [BCC-VIEW-10]
import { defineMessages } from 'react-intl';

export default defineMessages({
  title: {
    id: 'Project.title',
    description: 'Heading of the project overview',
    defaultMessage: 'Project {code}: {name}',
  },
  close: {
    id: 'Project.close',
    description: 'Button that closes the overview',
    defaultMessage: 'Close project overview',
  },
  tableLabel: {
    id: 'Project.tableLabel',
    description: 'Accessible label of the table',
    defaultMessage: 'Everything bought for {code}',
  },
  empty: {
    id: 'Project.empty',
    description: 'Nothing carries the project yet',
    defaultMessage:
      'No shopping list, cart, quote or order carries this project yet.',
  },
  colKind: {
    id: 'Project.colKind',
    description: 'Column header',
    defaultMessage: 'Kind',
  },
  colName: {
    id: 'Project.colName',
    description: 'Column header',
    defaultMessage: 'Name or number',
  },
  colState: {
    id: 'Project.colState',
    description: 'Column header',
    defaultMessage: 'State',
  },
  colItems: {
    id: 'Project.colItems',
    description: 'Column header',
    defaultMessage: 'Line items',
  },
  colTotal: {
    id: 'Project.colTotal',
    description: 'Column header: net total',
    defaultMessage: 'Net total',
  },
  kindShoppingList: {
    id: 'Project.kindShoppingList',
    description: 'Resource kind',
    defaultMessage: 'Shopping list',
  },
  kindCart: {
    id: 'Project.kindCart',
    description: 'Resource kind',
    defaultMessage: 'Cart',
  },
  kindQuoteRequest: {
    id: 'Project.kindQuoteRequest',
    description: 'Resource kind',
    defaultMessage: 'Quote request',
  },
  kindQuote: {
    id: 'Project.kindQuote',
    description: 'Resource kind',
    defaultMessage: 'Quote',
  },
  kindOrder: {
    id: 'Project.kindOrder',
    description: 'Resource kind',
    defaultMessage: 'Order',
  },
  budgetsTitle: {
    id: 'Project.budgetsTitle',
    description: 'Heading',
    defaultMessage: 'Project budgets',
  },
  noBudgets: {
    id: 'Project.noBudgets',
    description: 'The project has no budget',
    defaultMessage: 'This project has no budget.',
  },
  fieldsTitle: {
    id: 'Project.fieldsTitle',
    description: 'Heading',
    defaultMessage: 'Project fields',
  },
  save: {
    id: 'Project.save',
    description: 'Button',
    defaultMessage: 'Save project',
  },
  saved: {
    id: 'Project.saved',
    description: 'Confirmation',
    defaultMessage: 'Project saved.',
  },
  notSet: {
    id: 'Project.notSet',
    description: 'Shown for an empty field',
    defaultMessage: 'Not set',
  },
  stateOpen: {
    id: 'Project.stateOpen',
    description: 'Platform state Open of an order, quote or quote request',
    defaultMessage: 'Open',
  },
  stateConfirmed: {
    id: 'Project.stateConfirmed',
    description: 'Platform state Confirmed of an order, quote or quote request',
    defaultMessage: 'Confirmed',
  },
  stateComplete: {
    id: 'Project.stateComplete',
    description: 'Platform state Complete of an order, quote or quote request',
    defaultMessage: 'Complete',
  },
  stateCancelled: {
    id: 'Project.stateCancelled',
    description: 'Platform state Cancelled of an order, quote or quote request',
    defaultMessage: 'Cancelled',
  },
  statePending: {
    id: 'Project.statePending',
    description: 'Platform state Pending of an order, quote or quote request',
    defaultMessage: 'Pending',
  },
  stateDeclined: {
    id: 'Project.stateDeclined',
    description: 'Platform state Declined of an order, quote or quote request',
    defaultMessage: 'Declined',
  },
  stateDeclinedForRenegotiation: {
    id: 'Project.stateDeclinedForRenegotiation',
    description:
      'Platform state DeclinedForRenegotiation of an order, quote or quote request',
    defaultMessage: 'Declined, renegotiation requested',
  },
  stateRenegotiationAddressed: {
    id: 'Project.stateRenegotiationAddressed',
    description:
      'Platform state RenegotiationAddressed of an order, quote or quote request',
    defaultMessage: 'Renegotiation addressed',
  },
  stateAccepted: {
    id: 'Project.stateAccepted',
    description: 'Platform state Accepted of an order, quote or quote request',
    defaultMessage: 'Accepted',
  },
  stateWithdrawn: {
    id: 'Project.stateWithdrawn',
    description: 'Platform state Withdrawn of an order, quote or quote request',
    defaultMessage: 'Withdrawn',
  },
  stateSubmitted: {
    id: 'Project.stateSubmitted',
    description: 'Platform state Submitted of an order, quote or quote request',
    defaultMessage: 'Submitted',
  },
  stateClosed: {
    id: 'Project.stateClosed',
    description: 'Platform state Closed of an order, quote or quote request',
    defaultMessage: 'Closed',
  },
  stateRejected: {
    id: 'Project.stateRejected',
    description: 'Platform state Rejected of an order, quote or quote request',
    defaultMessage: 'Rejected',
  },
  stateOther: {
    id: 'Project.stateOther',
    description: 'A platform state the view has no text for, shown as received',
    defaultMessage: 'Other state: {state}',
  },
});
