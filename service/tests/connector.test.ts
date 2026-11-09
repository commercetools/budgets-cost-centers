// [BCC-DEPLOY-1] [BCC-DEPLOY-2] [BCC-PROJ-2] [BCC-DEPLOY-3] [BCC-DEPLOY-5] [BCC-DEPLOY-6]
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createApiRoot } from 'budgets-cost-centers-shared';
import { readConfig } from 'budgets-cost-centers-shared';
import { ensureExtension, removeExtension } from '../src/connector/extension';
import { postDeploy } from '../src/connector/post-deploy';
import { ensureType, TYPE_DRAFTS } from '../src/connector/types';

const env = {
  CTP_PROJECT_KEY: 'demo', CTP_AUTH_URL: 'https://auth.test', CTP_API_URL: 'https://api.test', CTP_CLIENT_ID: 'i',
  CTP_CLIENT_SECRET: 's', CTP_SCOPE: 'view_orders:demo view_quotes:demo view_business_units:demo view_key_value_documents:demo view_types:demo manage_types:demo manage_extensions:demo', BCC_EXTENSION_SECRET: 'x'.repeat(32),
};
const config = readConfig(env, 'service');
const api = () => createApiRoot(config);
const notFound = () => HttpResponse.json({ statusCode: 404, message: 'nf', errors: [{ code: 'ResourceNotFound', message: 'nf' }] }, { status: 404 });
const posts: Array<{ url: string; body: any }> = [];
const server = setupServer(
  http.post('https://auth.test/oauth/token', () => HttpResponse.json({ access_token: 't', expires_in: 172800, token_type: 'Bearer', scope: '' })),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => (posts.length = 0));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const record = (status = 200, reply: object = {}) => async ({ request }: { request: Request }) => {
  posts.push({ url: request.url, body: await request.json() });
  return HttpResponse.json(reply, { status });
};
const orderDraft = () => TYPE_DRAFTS(config).find((d) => d.key === 'bcc-order')!;

describe('types', () => {
  test('the order type holds the six fields with their types', () => {
    expect(orderDraft().resourceTypeIds).toEqual(['order']);
    expect(orderDraft().fieldDefinitions!.map((f) => [f.name, f.type.name])).toEqual([
      ['bccCostObject', 'String'], ['bccBudgetStatus', 'Enum'], ['bccBudgetExceeded', 'Boolean'],
      ['bccBudgetScopes', 'String'], ['bccCheckedAt', 'DateTime'], ['bccApprovalStatus', 'Enum'],
    ]);
    expect(TYPE_DRAFTS(config).map((d) => [d.key, d.resourceTypeIds])).toEqual([
      ['bcc-order', ['order']], ['bcc-line-item', ['line-item']], ['bcc-shopping-list', ['shopping-list']], ['bcc-quote', ['quote']],
    ]);
  });
  test('an absent type is created', async () => {
    server.use(http.get('https://api.test/demo/types/key=bcc-order', notFound), http.post('https://api.test/demo/types', record(201, { id: 'x' })));
    expect(await ensureType(api(), orderDraft())).toBe('created');
    expect(posts[0]!.body.key).toBe('bcc-order');
  });
  test('an existing customer type only gets the missing fields', async () => {
    server.use(
      http.get('https://api.test/demo/types/key=bcc-order', () =>
        HttpResponse.json({ id: 't', version: 3, key: 'bcc-order', resourceTypeIds: ['order'], fieldDefinitions: [
          { name: 'poReference', type: { name: 'String' }, required: false, label: { en: 'PO' }, inputHint: 'SingleLine' },
          { name: 'bccCostObject', type: { name: 'String' }, required: false, label: { en: 'Cost object' }, inputHint: 'SingleLine' },
        ] })),
      http.post('https://api.test/demo/types/key=bcc-order', record(200, { id: 't' })),
    );
    expect(await ensureType(api(), orderDraft())).toBe('updated');
    expect(posts[0]!.body.version).toBe(3);
    expect(posts[0]!.body.actions.map((a: any) => [a.action, a.fieldDefinition.name])).toEqual([
      ['addFieldDefinition', 'bccBudgetStatus'], ['addFieldDefinition', 'bccBudgetExceeded'], ['addFieldDefinition', 'bccBudgetScopes'],
      ['addFieldDefinition', 'bccCheckedAt'], ['addFieldDefinition', 'bccApprovalStatus'],
    ]);
  });
  test('a complete type is unchanged', async () => {
    server.use(http.get('https://api.test/demo/types/key=bcc-order', () => HttpResponse.json({ id: 't', version: 1, ...orderDraft() })));
    expect(await ensureType(api(), orderDraft())).toBe('unchanged');
    expect(posts).toEqual([]);
  });
  test('missing Enum values are added (review I5)', async () => {
    const full = orderDraft();
    const fields = full.fieldDefinitions!.map((f) =>
      f.name === 'bccBudgetStatus' ? { ...f, type: { name: 'Enum', values: [{ key: 'ok', label: 'OK' }, { key: 'warn', label: 'Warning' }, { key: 'exceeded', label: 'Exceeded' }] } } : f,
    );
    server.use(
      http.get('https://api.test/demo/types/key=bcc-order', () => HttpResponse.json({ id: 't', version: 2, ...full, fieldDefinitions: fields })),
      http.post('https://api.test/demo/types/key=bcc-order', record(200, { id: 't' })),
    );
    expect(await ensureType(api(), orderDraft())).toBe('updated');
    expect(posts[0]!.body.actions).toEqual([
      { action: 'addEnumValue', fieldName: 'bccBudgetStatus', value: { key: 'blocked', label: 'Blocked' } },
      { action: 'addEnumValue', fieldName: 'bccBudgetStatus', value: { key: 'none', label: 'No cost object' } },
    ]);
  });
  test('a conflicting field fails naming it', async () => {
    server.use(
      http.get('https://api.test/demo/types/key=bcc-order', () =>
        HttpResponse.json({ id: 't', version: 1, key: 'bcc-order', resourceTypeIds: ['order'], fieldDefinitions: [
          { name: 'bccBudgetStatus', type: { name: 'String' }, required: false, label: { en: 'x' } },
        ] })),
    );
    await expect(ensureType(api(), orderDraft())).rejects.toThrow('Field bccBudgetStatus exists on type bcc-order with another type.');
  });
  test('a type for another resource fails', async () => {
    server.use(http.get('https://api.test/demo/types/key=bcc-order', () =>
      HttpResponse.json({ id: 't', version: 1, key: 'bcc-order', resourceTypeIds: ['customer'], fieldDefinitions: [] })));
    await expect(ensureType(api(), orderDraft())).rejects.toThrow('Type bcc-order does not apply to order.');
  });
});

describe('extension', () => {
  const triggers = [
    { resourceTypeId: 'cart', actions: ['Create', 'Update'], condition: 'businessUnit is defined' },
    { resourceTypeId: 'order', actions: ['Create'], condition: 'businessUnit is defined' },
    { resourceTypeId: 'quote-request', actions: ['Create'] },
  ];
  test('an absent Extension is created with header auth and three triggers', async () => {
    server.use(http.get('https://api.test/demo/extensions/key=bcc-service', notFound), http.post('https://api.test/demo/extensions', record(201)));
    expect(await ensureExtension(api(), 'https://svc.test/service', 'x'.repeat(32))).toBe('created');
    expect(posts[0]!.body).toEqual({
      key: 'bcc-service',
      destination: { type: 'HTTP', url: 'https://svc.test/service', authentication: { type: 'AuthorizationHeader', headerValue: `Bearer ${'x'.repeat(32)}` } },
      triggers,
    });
  });
  test('an existing Extension is updated in place', async () => {
    server.use(
      http.get('https://api.test/demo/extensions/key=bcc-service', () => HttpResponse.json({ id: 'e', version: 4, key: 'bcc-service' })),
      http.post('https://api.test/demo/extensions/key=bcc-service', record(200)),
    );
    expect(await ensureExtension(api(), 'https://svc.test/service', 'x'.repeat(32))).toBe('updated');
    expect(posts[0]!.body.version).toBe(4);
    expect(posts[0]!.body.actions.map((a: any) => a.action)).toEqual(['changeDestination', 'changeTriggers']);
  });
  test('removal deletes by key and version, absent is a no-op', async () => {
    const deleted: string[] = [];
    server.use(
      http.get('https://api.test/demo/extensions/key=bcc-service', () => HttpResponse.json({ id: 'e', version: 4, key: 'bcc-service' })),
      http.delete('https://api.test/demo/extensions/key=bcc-service', ({ request }) => {
        deleted.push(new URL(request.url).searchParams.get('version')!);
        return HttpResponse.json({});
      }),
    );
    await removeExtension(api());
    expect(deleted).toEqual(['4']);
    server.use(http.get('https://api.test/demo/extensions/key=bcc-service', notFound));
    await removeExtension(api());
    expect(deleted).toEqual(['4']);
  });
});

test('postDeploy refuses extra scopes before any request', async () => {
  await expect(postDeploy({ ...env, CTP_SCOPE: 'manage_types:demo manage_project:demo', CONNECT_SERVICE_URL: 'https://svc.test' })).rejects.toThrow(/manage_project/);
});
test('postDeploy needs the service URL', async () => {
  await expect(postDeploy(env)).rejects.toThrow(/CONNECT_SERVICE_URL/);
});
test('postDeploy refuses missing scopes before any request (review minor 7)', async () => {
  await expect(postDeploy({ ...env, CTP_SCOPE: 'manage_types:demo manage_extensions:demo', CONNECT_SERVICE_URL: 'https://svc.test' })).rejects.toThrow(/missing.*view_orders/);
});
