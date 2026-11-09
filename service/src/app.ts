// Extension endpoint: header auth, dispatch per resource type, Extension response format.
// [BCC-CART-1] [BCC-CART-9] [BCC-CART-13] [BCC-QUOTE-1]
// https://docs.commercetools.com/api/projects/api-extensions
import { timingSafeEqual } from 'node:crypto';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { AppConfig } from 'budgets-cost-centers-shared';
import { log } from 'budgets-cost-centers-shared';
import { type CartLike, type ServicePlatform } from './platform';
import { withCache } from './cached-platform';
import { checkCart, type ExtensionResult, type ServiceDeps } from './cart-check';
import { guardOrder, type OrderDraftLike } from './order-guard';
import { handleQuoteRequest, type QuoteRequestLike } from './quote-request';

// Internal time budget, below the 2 s Extension timeout.
export const DEADLINE_MS = 1500;
// Extension input carries the whole cart; large B2B carts exceed the 1 MB default of body parsers.
const BODY_LIMIT = '10mb';

export type AppDeps = { platform: ServicePlatform; config: AppConfig; now?: () => string; deadlineMs?: number };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function isAuthorized(header: string | undefined, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function send(res: Response, result: ExtensionResult): void {
  if (result.status === 400) {
    res.status(400).json({ errors: [{ code: 'InvalidInput', message: result.message }] });
  } else if (result.actions.length) {
    res.status(200).json({ actions: result.actions });
  } else {
    res.status(200).end();
  }
}

export function createApp(deps: AppDeps): Express {
  const service: ServiceDeps = {
    platform: deps.platform,
    config: deps.config,
    now: deps.now ?? (() => new Date().toISOString()),
    deadlineMs: deps.deadlineMs ?? DEADLINE_MS,
  };
  // Only the cart check reads master data through the cache; the order guard and quotes stay live. [BCC-CART-13]
  const cartService: ServiceDeps = deps.config.cacheSeconds > 0
    ? { ...service, platform: withCache(deps.platform, { ttlMs: deps.config.cacheSeconds * 1000 }) }
    : service;
  const secret = deps.config.extensionSecret ?? '';
  const app = express();
  app.disable('x-powered-by');

  const router = express.Router();
  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  // Authentication runs before the body is parsed, so unauthenticated callers cost nothing.
  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    res.locals.correlationId = req.get('X-Correlation-ID');
    if (isAuthorized(req.get('Authorization'), secret)) return next();
    log('warn', 'Extension call without the expected Authorization header.', { correlationId: res.locals.correlationId });
    res.status(401).end();
  };
  router.post('/', authenticate, express.json({ limit: BODY_LIMIT }), async (req: Request, res: Response) => {
    const resource = isRecord(req.body) ? req.body.resource : undefined;
    if (!isRecord(resource) || typeof resource.typeId !== 'string' || !isRecord(resource.obj)) {
      res.status(400).json({ errors: [{ code: 'InvalidInput', message: 'Malformed Extension input.' }] });
      return;
    }
    const obj = resource.obj;
    res.locals.resourceId = resource.id;
    switch (resource.typeId) {
      case 'cart':
        send(res, await checkCart(obj as CartLike, cartService));
        return;
      case 'order':
        send(res, req.body.action === 'Create' ? await guardOrder(obj as OrderDraftLike, service) : { status: 200, actions: [] });
        return;
      case 'quote-request':
        send(res, await handleQuoteRequest(obj as QuoteRequestLike, service));
        return;
      default:
        res.status(200).end();
    }
  });
  app.use('/service', router);

  // No stack traces or platform messages in responses.
  app.use((error: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (error.type === 'entity.too.large') {
      log('error', 'Extension input above the body limit.', { correlationId: res.locals.correlationId });
      res.status(400).json({ errors: [{ code: 'InvalidInput', message: 'The cart is too large for the budget check.' }] });
      return;
    }
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ errors: [{ code: 'InvalidInput', message: 'Malformed Extension input.' }] });
      return;
    }
    log('error', 'Unhandled error in the Extension.', { correlationId: res.locals.correlationId, resourceId: res.locals.resourceId, reason: error.message });
    res.status(500).json({ errors: [{ code: 'General', message: 'Internal error' }] });
  });
  return app;
}
