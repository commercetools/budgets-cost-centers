// Update actions that set one field through the configured Custom Type. [BCC-QUOTE-1] [BCC-QUOTE-2]
import type { UpdateAction } from 'budgets-cost-centers-core';
import type { CustomLike } from './platform';

// `null` when the resource uses another Custom Type, which this package never replaces.
export function setFieldActions(custom: CustomLike | undefined, typeId: string, typeKey: string, name: string, value: unknown): UpdateAction[] | null {
  if (!custom) return [{ action: 'setCustomType', type: { typeId: 'type', key: typeKey }, fields: { [name]: value } }];
  if (custom.type.id !== typeId) return null;
  return custom.fields[name] === value ? [] : [{ action: 'setCustomField', name, value }];
}

export const foreignTypeMessage = (what: string, typeId: string, typeKey: string) =>
  `The ${what} uses the Custom Type "${typeId}", which is not configured for budgets ("${typeKey}").`;
