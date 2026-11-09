// Keep the budget snapshot of a B2B cart current. [BCC-CART-2] [BCC-CART-3] [BCC-CART-4] [BCC-CART-5] [BCC-CART-6]
// [BCC-CART-7] [BCC-CART-8] [BCC-CART-11] [BCC-CART-12] [BCC-APPR-2] [BCC-PROJ-3] [BCC-BUDGET-2]
import {
  amountOf,
  applicableScopes,
  type Budget,
  cartOutcome,
  type CheckContext,
  consumed,
  CONTAINERS,
  type CustomState,
  effectiveMode,
  type Outcome,
  parseRecordKey,
  projected,
  type ScopeResult,
  scopeLevel,
  snapshotActions,
  uncheckedOutcome,
  type UpdateAction,
  validateBudget,
} from 'budgets-cost-centers-core';
import type { AppConfig } from 'budgets-cost-centers-shared';
import { log } from 'budgets-cost-centers-shared';
import { ordersWhere } from './consumption-query';
import { costObjectProblem, resolveCostObjectKey } from './cost-object-check';
import { withDeadline } from './deadline';
import type { CartLike, CustomLike, ServicePlatform, StoredRecord } from './platform';
import { typeIdFor } from './type-ids';
import { loadUnitContext, type UnitContext } from './unit-context';

export type ExtensionResult = { status: 200; actions: UpdateAction[] } | { status: 400; message: string };
export type ServiceDeps = { platform: ServicePlatform; config: AppConfig; now: () => string; deadlineMs: number };

type Evaluation =
  | { kind: 'invalid'; message: string }
  | { kind: 'outcome'; outcome: Outcome; defaultedCostObject?: string; isProject: boolean };

const ok = (actions: UpdateAction[]): ExtensionResult => ({ status: 200, actions });
const UNAVAILABLE = 'The budget check is not available right now. Please try again.';

// The cart's custom state with the configured type named by key, or a foreign type named by id.
export const customState = (custom: CustomLike | undefined, typeId: string, typeKey: string): CustomState =>
  custom ? { typeKey: custom.type.id === typeId ? typeKey : custom.type.id, fields: custom.fields } : undefined;

// Budgets are validated on read; a corrupt record or a key whose owner differs from the value throws, so the
// cart becomes unchecked instead of passing a budget silently.
function readBudget(r: StoredRecord): { key: string; value: Budget } {
  const parsed = validateBudget(r.value);
  if (!parsed.ok) throw new Error(`Invalid budget record ${r.key}`);
  if (parseRecordKey(r.key)?.ownerBusinessUnitKey !== parsed.value.ownerBusinessUnitKey) {
    throw new Error(`Budget record ${r.key} does not belong to ${parsed.value.ownerBusinessUnitKey}`);
  }
  return { key: r.key, value: parsed.value };
}

async function evaluate(cart: CartLike, unitKey: string, custom: CustomState, deps: ServiceDeps, seen: { ctx?: UnitContext }): Promise<Evaluation> {
  const { platform } = deps;
  const at = deps.now();
  // Independent reads start together; a rejection is observed late, once its result is needed. [BCC-CART-12]
  const early = <T>(promise: Promise<T>): Promise<T> => {
    promise.catch(() => undefined);
    return promise;
  };
  const cartValue = typeof custom?.fields.bccCostObject === 'string' && custom.fields.bccCostObject ? custom.fields.bccCostObject : undefined;
  const ctxRead = early(loadUnitContext(platform, unitKey));
  const cartObjectRead = cartValue ? early(platform.getCustomObjects(CONTAINERS.costObjects, [cartValue])) : undefined;
  const unitBudgetsRead = early(platform.queryBudgets([unitKey]));

  const ctx = await ctxRead;
  seen.ctx = ctx;
  const roles = ctx.rolesOf(cart.customerId);

  const wanted = cartValue ?? ctx.effective.defaultCostObject;
  const records = cartObjectRead ? await cartObjectRead : wanted ? await platform.getCustomObjects(CONTAINERS.costObjects, [wanted]) : [];
  const recordOf = (key: string) => records.find((r) => r.key === key)?.value;
  const base = { unitKey, units: ctx.units, at, ...(cart.customerId ? { customerId: cart.customerId } : {}) };
  const resolved = resolveCostObjectKey({
    ...base,
    settings: ctx.effective,
    defaultRecord: cartValue ? undefined : wanted ? recordOf(wanted) : undefined,
    ...(cartValue ? { cartValue } : {}),
  });

  let costObject;
  if (resolved.key) {
    const check = costObjectProblem({ ...base, key: resolved.key, record: recordOf(resolved.key) });
    if (!check.ok) return { kind: 'invalid', message: check.message };
    costObject = check.costObject;
  }

  const otherOwner = costObject && costObject.ownerBusinessUnitKey !== unitKey ? costObject.ownerBusinessUnitKey : undefined;
  const budgets = [...(await unitBudgetsRead), ...(otherOwner ? await platform.queryBudgets([otherOwner]) : [])].map(readBudget);
  const amount = amountOf(cart);
  const checkCtx: CheckContext = {
    unitKey,
    customerId: cart.customerId ?? '',
    buyerRoles: roles,
    currencyCode: amount.currencyCode,
    at,
    ...(resolved.key ? { costObjectKey: resolved.key } : {}),
  };
  const { scopes, skipped } = applicableScopes(checkCtx, budgets);
  const results: ScopeResult[] = await Promise.all(
    scopes.map(async (s) => {
      const orders = await platform.queryOrders(ordersWhere(s, checkCtx));
      const used = consumed(orders, s, checkCtx).amount;
      const proj = projected(used, cart).centAmount;
      return {
        key: s.key,
        kind: s.budget.scope.kind,
        amount: s.budget.amount.centAmount,
        used: used.centAmount,
        projected: proj,
        level: scopeLevel(s.budget.amount.centAmount, proj, s.budget.warnAtPercent),
        mode: effectiveMode(s.budget, roles, ctx.covered),
      };
    }),
  );

  return {
    kind: 'outcome',
    outcome: cartOutcome({
      costObjectRequired: ctx.effective.costObjectRequired,
      results,
      skipped,
      ...(resolved.key ? { costObjectKey: resolved.key } : {}),
    }),
    ...(resolved.defaulted && resolved.key ? { defaultedCostObject: resolved.key } : {}),
    isProject: costObject?.type === 'project',
  };
}

export async function checkCart(cart: CartLike, deps: ServiceDeps): Promise<ExtensionResult> {
  const unitKey = cart.businessUnit?.key;
  if (!unitKey) return ok([]);

  // One time budget for the type lookup and the evaluation together. [BCC-CART-8]
  const started = Date.now();
  const remaining = () => Math.max(0, deps.deadlineMs - (Date.now() - started));
  const typeKey = deps.config.typeKeys.order;
  let typeId: string | undefined;
  try {
    typeId = await withDeadline(typeIdFor(deps.platform, typeKey, cart.custom?.type.id), remaining());
  } catch (error) {
    // Answering without actions would keep a stale snapshot that the order guard trusts, so the update fails.
    log('warn', 'Custom Type lookup failed; cart update rejected.', { cartId: cart.id, reason: (error as Error).message });
    return { status: 400, message: UNAVAILABLE };
  }
  if (!typeId) {
    log('error', `Custom Type ${typeKey} not found; deploy the service app first.`, { cartId: cart.id });
    return { status: 400, message: `The budget check is not set up: the Custom Type ${typeKey} is missing.` };
  }
  const custom = customState(cart.custom, typeId, typeKey);
  const snapshot = (outcome: Outcome, extra: { defaultedCostObject?: string; isProject: boolean }) => {
    const r = snapshotActions({
      custom,
      configuredTypeKey: typeKey,
      outcome,
      now: deps.now(),
      projectRetentionDays: deps.config.projectRetentionDays,
      ...extra,
      ...(cart.deleteDaysAfterLastModification !== undefined ? { deleteDaysAfterLastModification: cart.deleteDaysAfterLastModification } : {}),
    });
    return r.ok ? ok(r.value) : ({ status: 400, message: r.errors[0]?.message ?? 'Invalid cart type.' } as const);
  };

  // A foreign cart type is a misconfiguration; report it before anything else.
  const typeCheck = snapshot(uncheckedOutcome(false), { isProject: false });
  if (typeCheck.status === 400) return typeCheck;

  const seen: { ctx?: UnitContext } = {};
  let evaluation: Evaluation;
  try {
    evaluation = await withDeadline(evaluate(cart, unitKey, custom, deps, seen), remaining());
  } catch (error) {
    const ctx = seen.ctx;
    const covered = ctx ? ctx.rolesOf(cart.customerId).some((r) => ctx.covered.includes(r)) : false;
    log('warn', 'Budget could not be computed; cart marked unchecked.', { cartId: cart.id, reason: (error as Error).message, covered });
    return snapshot(uncheckedOutcome(covered), { isProject: false });
  }
  if (evaluation.kind === 'invalid') return { status: 400, message: evaluation.message };
  return snapshot(evaluation.outcome, {
    isProject: evaluation.isProject,
    ...(evaluation.defaultedCostObject ? { defaultedCostObject: evaluation.defaultedCostObject } : {}),
  });
}
