// Writes the approval status of an Approval Flow Message onto its order. [BCC-APPR-5] [BCC-APPR-6] [BCC-APPR-7] [BCC-APPR-8]
// https://docs.commercetools.com/api/projects/messages/approval-rule-approval-flow-messages
import { type ApprovalStatus, coverageAfterRuleChange, nextApprovalStatus, RULE_CHANGE_TYPES, toApprovalMessage, toRuleChange, validateSettings } from 'budgets-cost-centers-core';
import { isRecord } from 'budgets-cost-centers-core';
import type { AppConfig } from 'budgets-cost-centers-shared';
import { log } from 'budgets-cost-centers-shared';
import { type LedgerOrder, type LedgerPlatform, type OrderAction, statusOf } from './platform';

export type Outcome = 'written' | 'ignored' | 'retry';
export type HandleDeps = { platform: LedgerPlatform; config: AppConfig; fields?: Record<string, unknown> };

const FIELD = 'bccApprovalStatus';
const STATUSES: readonly string[] = ['pending', 'approved', 'rejected'];

// Type id per type key, resolved once per process and platform.
const typeIds = new WeakMap<LedgerPlatform, Map<string, string>>();

// When the order carries another id, the type may have been recreated: the cache is refreshed once before the
// order is treated as foreign.
async function orderTypeId(platform: LedgerPlatform, key: string, seenTypeId?: string): Promise<string | undefined> {
  let cache = typeIds.get(platform);
  if (!cache) typeIds.set(platform, (cache = new Map()));
  const cached = cache.get(key);
  if (cached && (!seenTypeId || cached === seenTypeId)) return cached;
  const id = await platform.typeIdByKey(key);
  if (id) cache.set(key, id);
  else cache.delete(key);
  return id;
}

const currentStatus = (order: LedgerOrder): ApprovalStatus | undefined => {
  const v = order.custom?.fields[FIELD];
  return typeof v === 'string' && STATUSES.includes(v) ? (v as ApprovalStatus) : undefined;
};

// A retry helps only for conflicts, platform faults and network failures.
const isTransient = (error: unknown): boolean => {
  const status = statusOf(error);
  return status === undefined || status === 409 || status === 429 || status >= 500 || status === 401 || status === 403;
};

const READ_BACK_WINDOW_MS = 5 * 60 * 1000;
export const HANDLED_TYPES: readonly string[] = ['ApprovalFlowCreated', 'ApprovalFlowCompleted', ...RULE_CHANGE_TYPES];

// Narrows or clears the coverage of every unit whose settings name the changed rule. [BCC-APPR-8]
async function handleRuleChange(stored: Record<string, unknown>, deps: HandleDeps): Promise<Outcome> {
  const change = toRuleChange(stored);
  if (!change) return 'ignored';
  const fields = { ...deps.fields, ruleId: change.ruleId, messageType: change.type };
  let records;
  try {
    records = await deps.platform.findSettingsByRuleId(change.ruleId);
  } catch (error) {
    log('warn', `Settings for rule ${change.ruleId} could not be read; retrying.`, { ...fields, status: statusOf(error) });
    return 'retry';
  }
  let written = false;
  for (const r of records) {
    const parsed = validateSettings(r.value);
    if (!parsed.ok) {
      log('error', `Settings record ${r.key} is invalid; coverage not updated.`, fields);
      continue;
    }
    const approval = coverageAfterRuleChange(parsed.value.approval, change);
    if (!approval) continue;
    try {
      await deps.platform.saveSettings(r.key, { ...parsed.value, approval }, r.version);
      written = true;
      log('info', `Coverage of ${r.key} updated after a rule change.`, { ...fields, requesterRoles: approval.requesterRoles });
    } catch (error) {
      if (isTransient(error)) return 'retry';
      log('error', `Coverage of ${r.key} could not be written.`, { ...fields, status: statusOf(error) });
    }
  }
  return written ? 'written' : 'ignored';
}

export async function handleMessage(message: unknown, deps: HandleDeps): Promise<Outcome> {
  const { platform, config } = deps;
  // Subscription test messages and change notifications carry another notificationType. Messages read from the
  // Messages API (replay) carry none.
  if (isRecord(message) && message.notificationType !== undefined && message.notificationType !== 'Message') return 'ignored';
  // The pushed payload is not trusted: the Message is read back from the Messages API, which also returns the full
  // payload when the push carried `payloadNotIncluded`. [BCC-APPR-7]
  // https://docs.commercetools.com/api/projects/messages
  // A push without payload carries its type only in `payloadNotIncluded.payloadType`.
  const pushedType = !isRecord(message)
    ? undefined
    : typeof message.type === 'string'
      ? message.type
      : isRecord(message.payloadNotIncluded) && typeof message.payloadNotIncluded.payloadType === 'string'
        ? message.payloadNotIncluded.payloadType
        : undefined;
  if (!isRecord(message) || !pushedType || !HANDLED_TYPES.includes(pushedType)) return 'ignored';
  const messageId = typeof message.id === 'string' ? message.id : undefined;
  if (!messageId) return 'ignored';
  let stored: unknown;
  try {
    stored = await platform.getMessage(messageId);
  } catch (error) {
    log('warn', `Message ${messageId} could not be read; retrying.`, { ...deps.fields, messageId, status: statusOf(error) });
    return 'retry';
  }
  if (stored === undefined) {
    // Persistence may lag behind the push; a young Message is retried before it is given up.
    const createdAt = typeof message.createdAt === 'string' ? Date.parse(message.createdAt) : NaN;
    if (Date.now() - createdAt < READ_BACK_WINDOW_MS) {
      log('warn', `Message ${messageId} is not readable yet; retrying.`, { ...deps.fields, messageId });
      return 'retry';
    }
    log('error', `Message ${messageId} cannot be verified through the Messages API; nothing written. Enable Messages querying in the project.`, { ...deps.fields, messageId });
    return 'ignored';
  }
  if (isRecord(stored) && (RULE_CHANGE_TYPES as readonly unknown[]).includes(stored.type)) return handleRuleChange(stored, deps);
  const parsed = toApprovalMessage(stored);
  if (parsed.type === 'other') return 'ignored';
  const orderId = parsed.orderId;
  const fields = { ...deps.fields, orderId, messageType: parsed.type };

  let order: LedgerOrder | undefined;
  try {
    order = await platform.getOrder(orderId);
  } catch (error) {
    log('warn', `Order ${orderId} could not be read; retrying.`, { ...fields, status: statusOf(error) });
    return 'retry';
  }
  if (!order) {
    log('info', `Order ${orderId} no longer exists; message acknowledged.`, fields);
    return 'ignored';
  }

  if (order.custom) {
    let typeId: string | undefined;
    try {
      typeId = await orderTypeId(platform, config.typeKeys.order, order.custom.type.id);
    } catch (error) {
      log('warn', `Type ${config.typeKeys.order} could not be read; retrying.`, { ...fields, status: statusOf(error) });
      return 'retry';
    }
    if (!typeId) {
      log('error', `Type ${config.typeKeys.order} does not exist; deploy the service app first.`, fields);
      return 'retry';
    }
    if (order.custom.type.id !== typeId) {
      log('warn', `Order ${orderId} has another Custom Type; approval status not written.`, fields);
      return 'ignored';
    }
  }

  const next = nextApprovalStatus(currentStatus(order), parsed);
  if (!next) return 'ignored';
  const actions: OrderAction[] = order.custom
    ? [{ action: 'setCustomField', name: FIELD, value: next }]
    : [{ action: 'setCustomType', type: { typeId: 'type', key: config.typeKeys.order }, fields: { [FIELD]: next } }];

  try {
    await platform.updateOrder(order.id, order.version, actions);
  } catch (error) {
    const status = statusOf(error);
    if (isTransient(error)) {
      log('warn', `Order ${orderId} could not be written; retrying.`, { ...fields, status });
      return 'retry';
    }
    if (status === 404) {
      log('info', `Order ${orderId} no longer exists; message acknowledged.`, fields);
      return 'ignored';
    }
    log('error', `Order ${orderId} rejected the approval status ${next}; message acknowledged.`, { ...fields, status });
    return 'ignored';
  }
  log('info', `Order ${orderId} has approval status ${next}.`, fields);
  return 'written';
}
