// Pub/Sub push envelope: { message: { data: <base64 JSON> } }. Connect delivers event apps this way. [BCC-APPR-6]
// https://cloud.google.com/pubsub/docs/push#receive_push
import { isRecord } from 'budgets-cost-centers-core';

export type Decoded = { ok: true; message: unknown } | { ok: false; reason: string };

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function decodeEnvelope(body: unknown): Decoded {
  const data = isRecord(body) && isRecord(body.message) ? body.message.data : undefined;
  if (typeof data !== 'string' || data === '') return { ok: false, reason: 'message.data is missing' };
  if (data.length % 4 !== 0 || !BASE64.test(data)) return { ok: false, reason: 'message.data is not base64' };
  try {
    return { ok: true, message: JSON.parse(Buffer.from(data, 'base64').toString('utf8')) };
  } catch {
    return { ok: false, reason: 'message.data is not JSON' };
  }
}

// The Pub/Sub message id, for log correlation only.
export const messageIdOf = (body: unknown): string | undefined =>
  isRecord(body) && isRecord(body.message) && typeof body.message.messageId === 'string' ? body.message.messageId : undefined;
