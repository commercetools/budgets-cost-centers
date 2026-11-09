// HTTP endpoint of the ledger event app: acknowledges with 204, asks for redelivery with 500. [BCC-APPR-6]
// Connect redelivers on any status other than 102, 200, 201, 202, 204:
// https://docs.commercetools.com/connect/deployment-behavior-and-environments
import express, { type ErrorRequestHandler, type Express } from 'express';
import type { AppConfig } from 'budgets-cost-centers-shared';
import { log } from 'budgets-cost-centers-shared';
import { decodeEnvelope, messageIdOf } from './envelope';
import { handleMessage } from './handle';
import type { LedgerPlatform } from './platform';

export type AppDeps = { platform: LedgerPlatform; config: AppConfig };

// Pub/Sub push messages are at most 10 MB.
const BODY_LIMIT = '10mb';

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.post('/', async (req, res) => {
    const messageId = messageIdOf(req.body);
    const decoded = decodeEnvelope(req.body);
    if (!decoded.ok) {
      log('warn', `Malformed envelope acknowledged: ${decoded.reason}.`, { messageId });
      res.status(204).end();
      return;
    }
    let outcome;
    try {
      outcome = await handleMessage(decoded.message, { ...deps, fields: { messageId } });
    } catch (error) {
      log('error', 'Message handling failed; retrying.', { messageId, error: error instanceof Error ? error.message : String(error) });
      outcome = 'retry' as const;
    }
    log('info', `Message ${outcome}.`, { messageId, outcome });
    res.status(outcome === 'retry' ? 500 : 204).end();
  });

  app.use('/ledger', express.json({ limit: BODY_LIMIT }), router);

  // A body that is not JSON never becomes valid on redelivery, so it is acknowledged.
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    const type = (error as { type?: string }).type;
    if (type === 'entity.parse.failed') {
      log('warn', 'Malformed envelope acknowledged: body is not JSON.');
      res.status(204).end();
      return;
    }
    log('error', 'Request failed.', { type });
    res.status(500).end();
  };
  app.use(onError);
  return app;
}
