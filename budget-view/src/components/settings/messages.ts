// UI text of the settings section. [BCC-VIEW-5] [BCC-VIEW-10]
import { defineMessages } from 'react-intl';

export default defineMessages({
  title: {
    id: 'Settings.title',
    description: 'Section heading',
    defaultMessage: 'Settings',
  },
  sourceOwn: {
    id: 'Settings.sourceOwn',
    description: 'The unit has its own settings record',
    defaultMessage: 'This unit has its own settings.',
  },
  sourceInherited: {
    id: 'Settings.sourceInherited',
    description: 'The unit uses the settings of an ancestor',
    defaultMessage:
      'These settings are inherited from {unitKey}. Saving stores them as own settings of this unit, with every value shown here.',
  },
  sourceDefaults: {
    id: 'Settings.sourceDefaults',
    description: 'No unit in the chain has settings',
    defaultMessage: 'No settings are stored; the default settings apply.',
  },
  fieldDefaultMode: {
    id: 'Settings.fieldDefaultMode',
    description: 'Form label',
    defaultMessage: 'Default mode',
  },
  fieldDefaultModeHint: {
    id: 'Settings.fieldDefaultModeHint',
    description: 'Help text',
    defaultMessage: 'New budgets start with this mode.',
  },
  fieldRequired: {
    id: 'Settings.fieldRequired',
    description: 'Switch label',
    defaultMessage: 'Cost object required',
  },
  fieldDefaultCostObject: {
    id: 'Settings.fieldDefaultCostObject',
    description: 'Form label',
    defaultMessage: 'Default cost object',
  },
  fieldDefaultCostObjectHint: {
    id: 'Settings.fieldDefaultCostObjectHint',
    description: 'Help text',
    defaultMessage:
      'Only cost objects this unit can see and use today are offered.',
  },
  noDefault: {
    id: 'Settings.noDefault',
    description: 'Option for no default cost object',
    defaultMessage: 'No default',
  },
  defaultUnavailable: {
    id: 'Settings.defaultUnavailable',
    description: 'Warning when the stored default cannot be used any more',
    defaultMessage:
      'The default cost object {key} is not usable any more. Choose another one or none.',
  },
  saved: {
    id: 'Settings.saved',
    description: 'Confirmation after saving',
    defaultMessage: 'Settings saved.',
  },
});
