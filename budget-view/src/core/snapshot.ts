// Update actions that keep a cart's budget snapshot current. [BCC-CART-2] [BCC-CART-7] [BCC-CART-11] [BCC-PROJ-3]
import type { Outcome } from './evaluate';
import { type Result, fail, ok } from './result';

// The cart's current `custom`, with the Type key resolved by the caller.
export type CustomState = { typeKey?: string; fields: Record<string, unknown> } | undefined;
export type UpdateAction = { action: string; [k: string]: unknown };

export function snapshotActions(input: {
  custom: CustomState;
  configuredTypeKey: string;
  outcome: Outcome;
  defaultedCostObject?: string;
  now: string;
  isProject: boolean;
  deleteDaysAfterLastModification?: number;
  projectRetentionDays: number;
}): Result<UpdateAction[]> {
  const { custom, configuredTypeKey, outcome, now } = input;
  if (custom && custom.typeKey !== configuredTypeKey) {
    return fail([
      {
        field: 'custom.type',
        message: `The cart uses the Custom Type "${custom.typeKey ?? 'unknown'}", which is not configured for budgets ("${configuredTypeKey}").`,
      },
    ]);
  }

  const snapshot: Record<string, unknown> = {
    bccBudgetStatus: outcome.status,
    bccBudgetExceeded: outcome.exceeded,
    bccBudgetScopes: JSON.stringify(outcome.scopes),
  };
  const actions: UpdateAction[] = [];

  if (!custom) {
    const fields: Record<string, unknown> = { ...snapshot, bccCheckedAt: now };
    if (input.defaultedCostObject) fields.bccCostObject = input.defaultedCostObject;
    actions.push({ action: 'setCustomType', type: { typeId: 'type', key: configuredTypeKey }, fields });
  } else {
    if (input.defaultedCostObject && custom.fields.bccCostObject !== input.defaultedCostObject) {
      actions.push({ action: 'setCustomField', name: 'bccCostObject', value: input.defaultedCostObject });
    }
    const changed = Object.entries(snapshot).filter(([name, value]) => custom.fields[name] !== value);
    for (const [name, value] of changed) actions.push({ action: 'setCustomField', name, value });
    if (changed.length) actions.push({ action: 'setCustomField', name: 'bccCheckedAt', value: now });
  }

  if (input.isProject && (input.deleteDaysAfterLastModification ?? 0) < input.projectRetentionDays) {
    actions.push({ action: 'setDeleteDaysAfterLastModification', deleteDaysAfterLastModification: input.projectRetentionDays });
  }
  return ok(actions);
}
