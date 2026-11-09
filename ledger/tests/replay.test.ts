// [BCC-APPR-5] [BCC-APPR-6] [BCC-APPR-8]
import { decodeEnvelope } from '../src/envelope';
import { HANDLED_TYPES } from '../src/handle';
import { replayWhere, toEnvelope } from '../src/replay';

test('toEnvelope round-trips through decodeEnvelope', () => {
  const message = {
    id: 'msg-1',
    type: 'ApprovalFlowCompleted',
    status: 'Rejected',
    order: { typeId: 'order', id: 'o-1' },
    createdAt: '2026-10-30T10:00:00.000Z',
  };
  expect(decodeEnvelope(toEnvelope(message))).toEqual({ ok: true, message });
});
test('non-ASCII text survives the round trip', () => {
  const message = { type: 'ApprovalFlowCreated', note: 'Kostenstelle Müller' };
  expect(decodeEnvelope(toEnvelope(message))).toEqual({ ok: true, message });
});

// [BCC-APPR-8] A rule changed while the ledger was down must not be lost (found in the sandbox run).
test('the replay query covers every Message type the ledger handles, rule changes included', () => {
  const where = replayWhere('2026-10-30T00:00:00.000Z');
  for (const type of HANDLED_TYPES) expect(where).toContain(`"${type}"`);
  expect(where).toContain('"ApprovalRuleStatusSet"');
  expect(where).toContain('createdAt >= "2026-10-30T00:00:00.000Z"');
});
