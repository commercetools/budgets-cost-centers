// Order Create: enforce the cart snapshot, re-validate the cost object, copy it from a quote.
// [BCC-CART-9] [BCC-QUOTE-2] [BCC-PROJ-4]
import { CONTAINERS, parseRecordKey } from 'budgets-cost-centers-core';
import { log } from 'budgets-cost-centers-shared';
import type { ExtensionResult, ServiceDeps } from './cart-check';
import { costObjectProblem } from './cost-object-check';
import { setFieldActions } from './custom-fields';
import { withDeadline } from './deadline';
import type { CustomLike } from './platform';
import { typeIdFor } from './type-ids';
import { loadUnitContext } from './unit-context';

export type OrderDraftLike = {
  cart?: { id: string };
  quote?: { id: string };
  customerId?: string;
  businessUnit?: { key: string };
  custom?: CustomLike;
};

const reject = (message: string): ExtensionResult => ({ status: 400, message });
const NOT_CHECKED = 'The budget of this cart has not been checked yet. Update the cart and try again.';
const UNAVAILABLE = 'The budget could not be checked. Please try again.';

function blockedMessage(scopesJson: unknown): string {
  try {
    const scopes = JSON.parse(String(scopesJson)) as unknown;
    if (!Array.isArray(scopes)) return 'The budget could not be checked and no approval applies to this buyer, so the order cannot be placed.';
    const hit = scopes.find((s: { level?: string; mode?: string }) => s.level === 'exceeded' && s.mode === 'block') as { key?: string } | undefined;
    const code = hit?.key ? (parseRecordKey(hit.key)?.code ?? hit.key) : undefined;
    if (code) return `This order exceeds the budget ${code} and cannot be placed.`;
  } catch {
    // Unreadable scopes fall through to the generic message.
  }
  return 'This order exceeds a budget and cannot be placed.';
}

async function fromQuote(order: OrderDraftLike & { quote: { id: string } }, deps: ServiceDeps): Promise<ExtensionResult> {
  const typeKey = deps.config.typeKeys.order;
  const [quote, typeId] = await Promise.all([deps.platform.getQuote(order.quote.id), typeIdFor(deps.platform, typeKey, order.custom?.type.id)]);
  const value = quote?.custom?.fields.bccCostObject;
  if (typeof value !== 'string' || !typeId) return { status: 200, actions: [] };
  const actions = setFieldActions(order.custom, typeId, typeKey, 'bccCostObject', value);
  if (!actions) log('warn', 'Order from a quote has another Custom Type; cost object not copied.', { quoteId: order.quote.id });
  return { status: 200, actions: actions ?? [] };
}

async function fromCart(order: OrderDraftLike, unitKey: string, at: string, deps: ServiceDeps): Promise<ExtensionResult> {
  const typeId = await typeIdFor(deps.platform, deps.config.typeKeys.order, order.custom?.type.id);
  if (!typeId) return reject(`The budget check is not set up: the Custom Type ${deps.config.typeKeys.order} is missing.`);
  const fields = order.custom && order.custom.type.id === typeId ? order.custom.fields : undefined;
  const status = fields?.bccBudgetStatus;
  if (status === undefined) return reject(NOT_CHECKED);
  if (status === 'blocked') return reject(blockedMessage(fields?.bccBudgetScopes));

  const ctx = await loadUnitContext(deps.platform, unitKey);
  const key = fields?.bccCostObject;
  // Settings may have changed since the last cart check: the current requirement decides, and a `none` snapshot
  // without a requirement hides the real budget status, so the cart must be checked again.
  if (ctx.effective.costObjectRequired && !(typeof key === 'string' && key)) {
    return reject('This business unit requires a cost object. Choose one on the cart before ordering.');
  }
  if (status === 'none') return reject(NOT_CHECKED);
  if (typeof key === 'string' && key) {
    const [record] = await deps.platform.getCustomObjects(CONTAINERS.costObjects, [key]);
    const check = costObjectProblem({
      key,
      record: record?.value,
      unitKey,
      units: ctx.units,
      at,
      ...(order.customerId ? { customerId: order.customerId } : {}),
    });
    if (!check.ok) return reject(check.message);
  }
  return { status: 200, actions: [] };
}

export async function guardOrder(order: OrderDraftLike, deps: ServiceDeps): Promise<ExtensionResult> {
  const unitKey = order.businessUnit?.key;
  if (!unitKey) return { status: 200, actions: [] };
  try {
    const work = order.quote ? fromQuote({ ...order, quote: order.quote }, deps) : fromCart(order, unitKey, deps.now(), deps);
    return await withDeadline(work, deps.deadlineMs);
  } catch (error) {
    // The guard is the only enforcement of `block`, so it fails closed.
    log('error', 'Order guard could not check the order.', { reason: (error as Error).message, unitKey });
    return order.quote ? { status: 200, actions: [] } : reject(UNAVAILABLE);
  }
}
