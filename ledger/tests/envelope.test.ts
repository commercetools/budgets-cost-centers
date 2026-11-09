// [BCC-APPR-6]
import { decodeEnvelope } from '../src/envelope';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

test('base64 JSON decodes', () =>
  expect(decodeEnvelope({ message: { data: b64('{"type":"ApprovalFlowCreated"}'), messageId: 'm-1' } })).toEqual({
    ok: true,
    message: { type: 'ApprovalFlowCreated' },
  }));
test('a missing body is malformed', () => expect(decodeEnvelope(undefined)).toMatchObject({ ok: false }));
test('missing message.data is malformed', () => expect(decodeEnvelope({ message: {} })).toMatchObject({ ok: false }));
test('non-string data is malformed', () => expect(decodeEnvelope({ message: { data: 42 } })).toMatchObject({ ok: false }));
test('bad base64 is malformed', () =>
  expect(decodeEnvelope({ message: { data: '!!not base64!!' } })).toEqual({ ok: false, reason: 'message.data is not base64' }));
test('bad JSON is malformed', () =>
  expect(decodeEnvelope({ message: { data: b64('{not json') } })).toEqual({ ok: false, reason: 'message.data is not JSON' }));
