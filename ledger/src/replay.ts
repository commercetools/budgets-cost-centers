// Replays persisted Approval Flow and Approval Rule Messages into a running ledger, for gaps after downtime. [BCC-APPR-5] [BCC-APPR-6] [BCC-APPR-8]
// Usage: node build/replay.js --since <ISO time> --to <ledger URL>
// Needs the ledger API Client (its scopes in shared/src/scopes.ts) and Message persistence enabled:
// https://docs.commercetools.com/api/projects/messages#enable-querying-messages-via-the-api
import type { Message } from '@commercetools/platform-sdk';
import { createApiRoot } from 'budgets-cost-centers-shared';
import { readConfig } from 'budgets-cost-centers-shared';
import { HANDLED_TYPES } from './handle';

export type Envelope = { message: { data: string } };

export const toEnvelope = (message: unknown): Envelope => ({
  message: { data: Buffer.from(JSON.stringify(message), 'utf8').toString('base64') },
});

const PAGE = 500;

function argsOf(argv: string[]): { since: string; to: string } {
  const value = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const since = value('--since');
  const to = value('--to');
  if (!since || Number.isNaN(Date.parse(since)) || !to) {
    throw new Error('Usage: replay --since <ISO time> --to <ledger URL>');
  }
  return { since: new Date(since).toISOString(), to };
}

// Every type the ledger handles, so rule changes during downtime are replayed too. [BCC-APPR-8]
export const replayWhere = (since: string): string =>
  `type in (${HANDLED_TYPES.map((t) => JSON.stringify(t)).join(', ')}) and createdAt >= "${since}"`;

// Pages by id, so the order of delivery is not chronological; the handler does not depend on it.
async function* messagesSince(since: string): AsyncGenerator<Message> {
  const apiRoot = createApiRoot(readConfig(process.env, 'ledger'));
  const base = replayWhere(since);
  let last: string | undefined;
  for (;;) {
    const where = last ? [base, `id > "${last}"`] : [base];
    const { body } = await apiRoot
      .messages()
      .get({ queryArgs: { where, sort: 'id asc', limit: PAGE, withTotal: false } })
      .execute();
    yield* body.results;
    if (body.results.length < PAGE) return;
    last = body.results[body.results.length - 1]?.id;
  }
}

export async function replay(argv: string[]): Promise<{ sent: number; failed: number }> {
  const { since, to } = argsOf(argv);
  let sent = 0;
  let failed = 0;
  for await (const message of messagesSince(since)) {
    const res = await fetch(to, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toEnvelope(message)),
    });
    if (res.ok) sent += 1;
    else {
      failed += 1;
      process.stderr.write(`Message ${message.id} answered ${res.status}.\n`);
    }
  }
  return { sent, failed };
}

if (require.main === module) {
  replay(process.argv.slice(2))
    .then(({ sent, failed }) => {
      process.stdout.write(`Replayed ${sent} messages, ${failed} failed.\n`);
      if (failed > 0) process.exitCode = 1;
    })
    .catch((error: unknown) => {
      process.stderr.write(`Replay failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
