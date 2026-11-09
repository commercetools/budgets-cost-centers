// Texts the view's model and data layer return as message descriptors, so components translate them. [BCC-VIEW-10]
import { defineMessages } from 'react-intl';

export default defineMessages({
  amountFormat: {
    id: 'Model.amountFormat',
    description:
      'Validation: the amount is not a number with the allowed decimals',
    defaultMessage:
      'Enter an amount like {example}, with at most {digits} decimals.',
  },
  amountFormatWhole: {
    id: 'Model.amountFormatWhole',
    description:
      'Validation: the currency has no minor unit, so the amount must be whole',
    defaultMessage:
      'Enter a whole amount like {example}; {currency} has no decimals.',
  },
  requesterMissing: {
    id: 'Model.requesterMissing',
    description: 'Validation of the rule setup: no requester role picked',
    defaultMessage: 'Pick at least one requester role.',
  },
  tiersInvalid: {
    id: 'Model.tiersInvalid',
    description: 'Validation of the rule setup: approver tiers',
    defaultMessage:
      'Use one to five approver tiers, each with at least one role.',
  },
  keyInvalid: {
    id: 'Model.keyInvalid',
    description: 'Validation: the record key is not a valid Custom Object key',
    defaultMessage: 'Key "{key}" is not a valid Custom Object key.',
  },
  keyCostObject: {
    id: 'Model.keyCostObject',
    description:
      'Validation: a cost-object key must be owner unit key, tilde, code',
    defaultMessage:
      'The key must be the owner unit key, a tilde (~) and the code.',
  },
  keyBudget: {
    id: 'Model.keyBudget',
    description: 'Validation: a budget key must start with the owner unit key',
    defaultMessage: 'The key must start with the owner Business Unit key.',
  },
  unknownContainer: {
    id: 'Model.unknownContainer',
    description: 'Internal error: the view cannot read or write this container',
    defaultMessage: 'The view cannot use the container "{container}".',
  },
});
