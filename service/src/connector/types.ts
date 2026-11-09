// Composable Custom Types: create the configured types or add the missing bcc fields. [BCC-DEPLOY-1] [BCC-DEPLOY-2] [BCC-PROJ-2]
import type { FieldDefinition, TypeDraft, TypeUpdateAction } from '@commercetools/platform-sdk';
import type { ApiRoot } from 'budgets-cost-centers-shared';
import type { AppConfig } from 'budgets-cost-centers-shared';
import { orUndefined } from '../sdk-platform';

const field = (name: string, label: string, type: FieldDefinition['type'], inputHint?: 'SingleLine' | 'MultiLine'): FieldDefinition => ({
  name,
  label: { en: label },
  required: false,
  type,
  ...(inputHint ? { inputHint } : {}),
});
const enumOf = (values: Array<[string, string]>): FieldDefinition['type'] => ({
  name: 'Enum',
  values: values.map(([key, label]) => ({ key, label })),
});
const costObject = () => field('bccCostObject', 'Cost object', { name: 'String' }, 'SingleLine');

export function TYPE_DRAFTS(config: AppConfig): TypeDraft[] {
  const t = config.typeKeys;
  return [
    {
      key: t.order,
      name: { en: 'Budgets: carts and orders' },
      resourceTypeIds: ['order'],
      fieldDefinitions: [
        costObject(),
        field('bccBudgetStatus', 'Budget status', enumOf([['ok', 'OK'], ['warn', 'Warning'], ['exceeded', 'Exceeded'], ['blocked', 'Blocked'], ['none', 'No cost object']])),
        field('bccBudgetExceeded', 'Budget exceeded', { name: 'Boolean' }),
        field('bccBudgetScopes', 'Budget scopes', { name: 'String' }, 'MultiLine'),
        field('bccCheckedAt', 'Budget checked at', { name: 'DateTime' }),
        field('bccApprovalStatus', 'Approval status', enumOf([['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']])),
      ],
    },
    { key: t.lineItem, name: { en: 'Budgets: line items (reserved)' }, resourceTypeIds: ['line-item'], fieldDefinitions: [costObject()] },
    { key: t.shoppingList, name: { en: 'Budgets: shopping lists' }, resourceTypeIds: ['shopping-list'], fieldDefinitions: [costObject()] },
    { key: t.quote, name: { en: 'Budgets: quote requests and quotes' }, resourceTypeIds: ['quote'], fieldDefinitions: [costObject()] },
  ];
}

export async function ensureType(apiRoot: ApiRoot, draft: TypeDraft): Promise<'created' | 'updated' | 'unchanged'> {
  const existing = await orUndefined(() => apiRoot.types().withKey({ key: draft.key }).get().execute());
  if (!existing) {
    await apiRoot.types().post({ body: draft }).execute();
    return 'created';
  }
  for (const r of draft.resourceTypeIds) {
    if (!existing.resourceTypeIds.includes(r)) throw new Error(`Type ${draft.key} does not apply to ${r}.`);
  }
  const actions: TypeUpdateAction[] = [];
  for (const f of draft.fieldDefinitions ?? []) {
    const have = existing.fieldDefinitions.find((x) => x.name === f.name);
    if (!have) actions.push({ action: 'addFieldDefinition', fieldDefinition: f });
    else if (have.type.name !== f.type.name) throw new Error(`Field ${f.name} exists on type ${draft.key} with another type.`);
    else if (f.type.name === 'Enum' && have.type.name === 'Enum') {
      // Values this package writes must exist, or every write of a missing value fails.
      const present = new Set(have.type.values.map((v) => v.key));
      for (const value of f.type.values) {
        if (!present.has(value.key)) actions.push({ action: 'addEnumValue', fieldName: f.name, value });
      }
    }
  }
  if (!actions.length) return 'unchanged';
  await apiRoot.types().withKey({ key: draft.key }).post({ body: { version: existing.version, actions } }).execute();
  return 'updated';
}
