// [BCC-APPR-6]
import request from 'supertest';
import * as logger from '../../shared/src/logger';
import { createApp } from '../src/app';
import { toEnvelope } from '../src/replay';
import { PlatformError } from '../src/platform';
import { config, FakeLedgerPlatform, store } from './fixtures';

const created = { notificationType: 'Message', id: 'msg-1', type: 'ApprovalFlowCreated', approvalFlow: { order: { typeId: 'order', id: 'o-1' } } };

let platform: FakeLedgerPlatform;
const app = () => createApp({ platform, config: config() });

beforeEach(() => {
  platform = new FakeLedgerPlatform();
  platform.orders = [{ id: 'o-1', version: 1, custom: { type: { id: 'type-order' }, fields: {} } }];
  store(platform, created);
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test('health answers 200', () => request(app()).get('/ledger/health').expect(200));
test('a handled message answers 204', async () => {
  await request(app()).post('/ledger').send(toEnvelope(created)).expect(204);
  expect(platform.updates).toHaveLength(1);
});
test('an ignored message answers 204', () =>
  request(app()).post('/ledger').send(toEnvelope({ notificationType: 'Message', type: 'ApprovalFlowApproved' })).expect(204));
test('the subscription test message answers 204', () =>
  request(app())
    .post('/ledger')
    .send(toEnvelope({ notificationType: 'ResourceCreated', resource: { typeId: 'subscription', id: 's-1' } }))
    .expect(204));
test('a malformed envelope answers 204', () => request(app()).post('/ledger').send({ nope: true }).expect(204));
test('bad base64 answers 204', () => request(app()).post('/ledger').send({ message: { data: '%%%' } }).expect(204));
test('a body that is not JSON answers 204', () =>
  request(app()).post('/ledger').set('Content-Type', 'application/json').send('{broken').expect(204));
test('retry answers 500', async () => {
  platform.failWith.getOrder = new PlatformError(503, 'unavailable');
  const res = await request(app()).post('/ledger').send(toEnvelope(created)).expect(500);
  expect(res.text).not.toContain('unavailable');
});
test('the Pub/Sub messageId is logged', async () => {
  await request(app())
    .post('/ledger')
    .send({ message: { ...toEnvelope(created).message, messageId: 'pubsub-7' } })
    .expect(204);
  expect(logger.log).toHaveBeenCalledWith('info', expect.any(String), expect.objectContaining({ messageId: 'pubsub-7' }));
});
