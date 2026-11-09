// Quote request Create: carry the cart's cost object, which the platform does not copy. [BCC-QUOTE-1]
import { CONTAINERS } from 'budgets-cost-centers-core';
import { log } from 'budgets-cost-centers-shared';
import type { ExtensionResult, ServiceDeps } from './cart-check';
import { costObjectProblem } from './cost-object-check';
import { foreignTypeMessage, setFieldActions } from './custom-fields';
import { withDeadline } from './deadline';
import type { CustomLike } from './platform';
import { typeIdFor, typeIdOf } from './type-ids';
import { loadUnitContext } from './unit-context';

export type QuoteRequestLike = { cart?: { id: string }; customerId?: string; businessUnit?: { key: string }; custom?: CustomLike };

async function handle(qr: QuoteRequestLike, unitKey: string, deps: ServiceDeps): Promise<ExtensionResult> {
  const { platform, config } = deps;
  const [quoteTypeId, orderTypeId] = await Promise.all([typeIdFor(platform, config.typeKeys.quote, qr.custom?.type.id), typeIdOf(platform, config.typeKeys.order)]);
  if (!quoteTypeId || !orderTypeId) return { status: 200, actions: [] };
  if (qr.custom && qr.custom.type.id !== quoteTypeId) {
    return { status: 400, message: foreignTypeMessage('quote request', qr.custom.type.id, config.typeKeys.quote) };
  }

  const own = qr.custom?.fields.bccCostObject;
  let key = typeof own === 'string' && own ? own : undefined;
  if (!key && qr.cart) {
    const cart = await platform.getCart(qr.cart.id);
    const fromCart = cart?.custom?.type.id === orderTypeId ? cart.custom.fields.bccCostObject : undefined;
    key = typeof fromCart === 'string' && fromCart ? fromCart : undefined;
  }
  if (!key) return { status: 200, actions: [] };

  const [ctx, records] = await Promise.all([loadUnitContext(platform, unitKey), platform.getCustomObjects(CONTAINERS.costObjects, [key])]);
  const check = costObjectProblem({
    key,
    record: records[0]?.value,
    unitKey,
    units: ctx.units,
    at: deps.now(),
    ...(qr.customerId ? { customerId: qr.customerId } : {}),
  });
  if (!check.ok) return { status: 400, message: check.message };
  return { status: 200, actions: setFieldActions(qr.custom, quoteTypeId, config.typeKeys.quote, 'bccCostObject', key) ?? [] };
}

export async function handleQuoteRequest(qr: QuoteRequestLike, deps: ServiceDeps): Promise<ExtensionResult> {
  const unitKey = qr.businessUnit?.key;
  if (!unitKey) return { status: 200, actions: [] };
  try {
    return await withDeadline(handle(qr, unitKey, deps), deps.deadlineMs);
  } catch (error) {
    // Quote requests carry the reference only; budgets are not enforced on them, so a failure must not block.
    log('warn', 'Cost object not copied to the quote request.', { reason: (error as Error).message, unitKey });
    return { status: 200, actions: [] };
  }
}
