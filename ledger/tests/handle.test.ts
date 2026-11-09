// [BCC-APPR-5] [BCC-APPR-6] [BCC-APPR-7]
import * as logger from '../../shared/src/logger';
import { handleMessage } from '../src/handle';
import { PlatformError } from '../src/platform';
import { config, FakeLedgerPlatform, store } from './fixtures';

const ref = { typeId: 'order', id: 'o-1' };
const created = { notificationType: 'Message', id: 'msg-1', type: 'ApprovalFlowCreated', approvalFlow: { id: 'af-1', order: ref } };
const completed = (status: 'Approved' | 'Rejected') => ({
  notificationType: 'Message',
  id: `msg-${status}`,
  type: 'ApprovalFlowCompleted',
  status,
  order: ref,
});

let platform: FakeLedgerPlatform;
let logSpy: jest.SpyInstance;
const run = (message: unknown, opts: { stored?: boolean } = {}) => {
  if (opts.stored !== false && typeof message === 'object' && message && 'id' in message) store(platform, message as Record<string, unknown>);
  return handleMessage(message, { platform, config: config() });
};
const statusOf = () => platform.orders[0]?.custom?.fields.bccApprovalStatus;

beforeEach(() => {
  platform = new FakeLedgerPlatform();
  platform.orders = [{ id: 'o-1', version: 3, custom: { type: { id: 'type-order' }, fields: { poReference: 'PO-1' } } }];
  logSpy = jest.spyOn(logger, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('[BCC-APPR-5] status on the order', () => {
  test('ApprovalFlowCreated sets pending', async () => {
    expect(await run(created)).toBe('written');
    expect(platform.updates).toEqual([
      { id: 'o-1', version: 3, actions: [{ action: 'setCustomField', name: 'bccApprovalStatus', value: 'pending' }] },
    ]);
  });
  test('ApprovalFlowCompleted Rejected sets rejected', async () => {
    expect(await run(completed('Rejected'))).toBe('written');
    expect(statusOf()).toBe('rejected');
  });
  test('ApprovalFlowCompleted Approved sets approved after pending', async () => {
    await run(created);
    expect(await run(completed('Approved'))).toBe('written');
    expect(statusOf()).toBe('approved');
  });
  test('Created after Completed keeps the final status', async () => {
    await run(completed('Rejected'));
    expect(await run(created)).toBe('ignored');
    expect(statusOf()).toBe('rejected');
    expect(platform.updates).toHaveLength(1);
  });
  test('the same message twice writes once', async () => {
    expect(await run(completed('Approved'))).toBe('written');
    expect(await run(completed('Approved'))).toBe('ignored');
    expect(platform.updates).toHaveLength(1);
  });
  test('an order without custom gets the type and the field', async () => {
    platform.orders = [{ id: 'o-1', version: 1 }];
    expect(await run(created)).toBe('written');
    expect(platform.updates[0]?.actions).toEqual([
      { action: 'setCustomType', type: { typeId: 'type', key: 'bcc-order' }, fields: { bccApprovalStatus: 'pending' } },
    ]);
    expect(platform.calls).not.toContain('typeIdByKey');
  });
  test('the order is re-fetched, never taken from the payload', async () => {
    await run({ ...completed('Rejected'), order: { ...ref, obj: { version: 99, custom: undefined } } });
    expect(platform.calls.slice(0, 2)).toEqual(['getMessage', 'getOrder']);
    expect(platform.updates[0]?.version).toBe(3);
  });
  test('the type id is resolved once per process', async () => {
    await run(created);
    await run(completed('Approved'));
    expect(platform.calls.filter((c) => c === 'typeIdByKey')).toHaveLength(1);
  });
});

describe('[BCC-APPR-6] ack or retry', () => {
  test('a foreign order type is acked, logged and not written', async () => {
    platform.orders = [{ id: 'o-1', version: 3, custom: { type: { id: 'type-erp' }, fields: {} } }];
    expect(await run(completed('Rejected'))).toBe('ignored');
    expect(platform.updates).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith('warn', 'Order o-1 has another Custom Type; approval status not written.', expect.any(Object));
  });
  test('an unhandled message type is ignored without a platform call', async () => {
    expect(await run({ notificationType: 'Message', type: 'ApprovalFlowApproved', order: ref })).toBe('ignored');
    expect(platform.calls).toEqual([]);
  });
  test('the subscription test message is ignored', async () => {
    expect(await run({ notificationType: 'ResourceCreated', resource: { typeId: 'subscription', id: 's-1' } })).toBe('ignored');
    expect(platform.calls).toEqual([]);
  });
  test('a change notification is ignored even if it looks like a message', async () => {
    expect(await run({ ...created, notificationType: 'ResourceUpdated' })).toBe('ignored');
    expect(platform.calls).toEqual([]);
  });
  test('a deleted order is acked', async () => {
    platform.orders = [];
    expect(await run(created)).toBe('ignored');
  });
  test('getOrder 503 retries', async () => {
    platform.failWith.getOrder = new PlatformError(503, 'unavailable');
    expect(await run(created)).toBe('retry');
  });
  test('a type lookup failure retries', async () => {
    platform.failWith.typeIdByKey = new PlatformError(503, 'unavailable');
    expect(await run(created)).toBe('retry');
  });
  test('a missing order type retries', async () => {
    platform.types = {};
    expect(await run(created)).toBe('retry');
  });
  test('updateOrder 409 retries', async () => {
    platform.failWith.updateOrder = new PlatformError(409, 'conflict');
    expect(await run(created)).toBe('retry');
  });
  test('updateOrder 502 retries', async () => {
    platform.failWith.updateOrder = new PlatformError(502, 'bad gateway');
    expect(await run(created)).toBe('retry');
  });
  test('a network failure on update retries', async () => {
    platform.failWith.updateOrder = new Error('socket hang up');
    expect(await run(created)).toBe('retry');
  });
  test('an order deleted before the write is acked', async () => {
    platform.failWith.updateOrder = new PlatformError(404, 'not found');
    expect(await run(created)).toBe('ignored');
  });
  test('a rejected update (400) is acked and logged as an error', async () => {
    platform.failWith.updateOrder = new PlatformError(400, 'InvalidOperation');
    expect(await run(created)).toBe('ignored');
    expect(logSpy).toHaveBeenCalledWith('error', expect.stringContaining('o-1'), expect.any(Object));
  });
});

describe('[BCC-APPR-7] verified Messages', () => {
  test('a pushed Message the Messages API does not know is not trusted', async () => {
    expect(await run(completed('Rejected'), { stored: false })).toBe('ignored');
    expect(statusOf()).toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith('error', expect.stringMatching(/cannot be verified/), expect.objectContaining({ messageId: 'msg-Rejected' }));
  });
  test('the stored Message wins over the pushed payload', async () => {
    store(platform, { ...completed('Approved'), id: 'msg-x' });
    expect(await run({ ...completed('Rejected'), id: 'msg-x' }, { stored: false })).toBe('written');
    expect(statusOf()).toBe('approved');
  });
  test('a Message without payload is read in full from the Messages API', async () => {
    store(platform, completed('Rejected'));
    const pushed = { notificationType: 'Message', id: 'msg-Rejected', payloadNotIncluded: { reason: 'too big', payloadType: 'ApprovalFlowCompleted' } };
    expect(await run(pushed, { stored: false })).toBe('written');
    expect(statusOf()).toBe('rejected');
  });
  test('a Message not yet readable right after the push is retried (review I-2)', async () => {
    const fresh = { ...completed('Rejected'), id: 'msg-new', createdAt: new Date().toISOString() };
    expect(await run(fresh, { stored: false })).toBe('retry');
  });
  test('an old Message that cannot be read back is acknowledged with an error (review I-2)', async () => {
    const old = { ...completed('Rejected'), id: 'msg-old', createdAt: '2026-01-01T00:00:00.000Z' };
    expect(await run(old, { stored: false })).toBe('ignored');
  });
  test('a failing Messages API is retried', async () => {
    platform.failWith.getMessage = new PlatformError(503, 'unavailable');
    expect(await run(created)).toBe('retry');
  });
});

test('a recreated order type is re-resolved instead of dropping the status (review M7)', async () => {
  expect(await run(created)).toBe('written');
  platform.types['bcc-order'] = 'type-order-new';
  platform.orders = [{ id: 'o-1', version: 9, custom: { type: { id: 'type-order-new' }, fields: {} } }];
  expect(await run(completed('Approved'))).toBe('written');
});

test('other Message types are ignored without any platform call', async () => {
  expect(await run({ notificationType: 'Message', id: 'msg-a', type: 'ApprovalFlowApproved' })).toBe('ignored');
  expect(platform.calls).toEqual([]);
});

describe('[BCC-APPR-8] coverage follows rule changes', () => {
  const settings = (requesterRoles: string[]) => ({
    defaultMode: 'approval', costObjectRequired: false, costObjectLevel: 'order', features: { projects: true },
    approval: { ruleKey: 'bcc-budget-unit-a', ruleId: 'rule-1', requesterRoles, checkedAt: '2026-10-01T00:00:00.000Z' },
  });
  const ruleMessage = (patch: Record<string, unknown>) => ({
    notificationType: 'Message', id: 'msg-r1', createdAt: '2026-10-30T10:00:00.000Z', resource: { typeId: 'approval-rule', id: 'rule-1' }, ...patch,
  });
  const recordOf = () => platform.settings.find((r) => r.key === 'unit-a')!;
  beforeEach(() => {
    platform.settings = [{ key: 'unit-a', version: 4, value: settings(['buyer', 'site-buyer']) }];
  });
  test('a deactivated rule clears the coverage of its unit', async () => {
    expect(await run(ruleMessage({ type: 'ApprovalRuleStatusSet', status: 'Inactive', oldStatus: 'Active' }))).toBe('written');
    expect((recordOf().value as ReturnType<typeof settings>).approval.requesterRoles).toEqual([]);
    expect(platform.settingsWrites[0]?.version).toBe(4);
  });
  test('removed requesters are no longer covered', async () => {
    await run(ruleMessage({ type: 'ApprovalRuleRequestersSet', requesters: [{ associateRole: { typeId: 'associate-role', key: 'buyer' } }], oldRequesters: [] }));
    expect((recordOf().value as ReturnType<typeof settings>).approval.requesterRoles).toEqual(['buyer']);
  });
  test('an unchanged coverage writes nothing', async () => {
    expect(await run(ruleMessage({ type: 'ApprovalRulePredicateSet', predicate: 'custom.bccBudgetExceeded = true', oldPredicate: 'x' }))).toBe('ignored');
    expect(platform.settingsWrites).toEqual([]);
  });
  test('a conflicting settings write is retried', async () => {
    platform.failWith.saveSettings = new PlatformError(409, 'conflict');
    expect(await run(ruleMessage({ type: 'ApprovalRuleStatusSet', status: 'Inactive', oldStatus: 'Active' }))).toBe('retry');
  });
});
