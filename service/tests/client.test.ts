// [BCC-DEPLOY-6] [BCC-DEPLOY-9]
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createApiRoot, readConfig, runtimeScopes, SCOPES } from 'budgets-cost-centers-shared';

test('runtime drops the scopes only lifecycle scripts need (review M8)', () =>
  expect(runtimeScopes('view_orders:demo manage_types:demo manage_extensions:demo view_types:demo manage_subscriptions:demo manage_orders:demo')).toEqual([
    'view_orders:demo', 'view_types:demo', 'manage_orders:demo',
  ]));
test('the service list lets the runtime read types without manage_types', () => expect(SCOPES.service).toContain('view_types'));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

test('a runtime client asks the token only for the runtime scopes and aborts slow calls (review M8, M10)', async () => {
  let tokenScope = '';
  server.use(
    http.post('https://auth.test/oauth/token', async ({ request }) => {
      tokenScope = new URLSearchParams(await request.text()).get('scope') ?? '';
      return HttpResponse.json({ access_token: 't', expires_in: 172800, token_type: 'Bearer', scope: tokenScope });
    }),
    http.get('https://api.test/demo', async () => {
      await new Promise((r) => setTimeout(r, 500));
      return HttpResponse.json({ key: 'demo' });
    }),
  );
  const config = readConfig(
    { CTP_PROJECT_KEY: 'demo', CTP_AUTH_URL: 'https://auth.test', CTP_API_URL: 'https://api.test', CTP_CLIENT_ID: 'i', CTP_CLIENT_SECRET: 's',
      CTP_SCOPE: 'view_orders:demo manage_types:demo', BCC_EXTENSION_SECRET: 'x'.repeat(32) },
    'service',
  );
  const api = createApiRoot(config, { runtime: true, timeoutMs: 100 });
  const started = Date.now();
  await expect(api.get().execute()).rejects.toBeDefined();
  expect(Date.now() - started).toBeLessThan(400);
  expect(tokenScope).toBe('view_orders:demo');
});

test('a client with only lifecycle scopes never asks for an empty scope list (review minor 8)', () =>
  expect(() => runtimeScopes('manage_types:demo manage_extensions:demo')).toThrow(/no runtime scope/));
