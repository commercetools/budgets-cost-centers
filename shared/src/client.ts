// commercetools API client, built once per configuration. [BCC-DEPLOY-6] [BCC-DEPLOY-9]
import { ClientBuilder } from '@commercetools/ts-client';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';
import type { AppConfig } from './config';
import { runtimeScopes } from './scopes';

export type ApiRoot = ReturnType<ReturnType<typeof createApiBuilderFromCtpClient>['withProjectKey']>;

// runtime: request a token without the lifecycle-only scopes. timeoutMs: abort calls that hang, so abandoned
// requests do not pile up behind an internal deadline.
export type ClientOptions = { runtime?: boolean; timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 10000;
const roots = new WeakMap<AppConfig, Map<string, ApiRoot>>();

export function createApiRoot(config: AppConfig, opts: ClientOptions = {}): ApiRoot {
  const id = `${opts.runtime ? 'runtime' : 'full'}:${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}`;
  let byOptions = roots.get(config);
  if (!byOptions) roots.set(config, (byOptions = new Map()));
  const cached = byOptions.get(id);
  if (cached) return cached;
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const client = new ClientBuilder()
    .withProjectKey(config.projectKey)
    .withClientCredentialsFlow({
      host: config.authUrl,
      projectKey: config.projectKey,
      credentials: { clientId: config.clientId, clientSecret: config.clientSecret },
      scopes: opts.runtime ? runtimeScopes(config.scope) : config.scope.split(/\s+/).filter(Boolean),
      httpClient: fetch,
    })
    .withHttpMiddleware({ host: config.apiUrl, httpClient: fetch, timeout })
    .build();
  const root = createApiBuilderFromCtpClient(client).withProjectKey({ projectKey: config.projectKey });
  byOptions.set(id, root);
  return root;
}
