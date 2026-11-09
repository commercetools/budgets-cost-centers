// [BCC-DEPLOY-4] [BCC-DEPLOY-5] [BCC-DEPLOY-6]
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createApiRoot } from 'budgets-cost-centers-shared';
import { postDeploy } from '../src/connector/post-deploy';
import { preUndeploy } from '../src/connector/pre-undeploy';
import { ensureSubscription, removeSubscription } from '../src/connector/subscription';
import { API, config, ctError, ENV, tokenHandler } from './fixtures';

const server = setupServer(tokenHandler);
const requests: string[] = [];
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`);
  });
});
beforeEach(() => {
  requests.length = 0;
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const GCP = { CONNECT_GCP_TOPIC_NAME: 'bcc-topic', CONNECT_GCP_PROJECT_ID: 'gcp-project' };
const MESSAGES = [
  { resourceTypeId: 'approval-flow', types: ['ApprovalFlowCreated', 'ApprovalFlowCompleted'] },
  { resourceTypeId: 'approval-rule', types: ['ApprovalRuleStatusSet', 'ApprovalRuleRequestersSet', 'ApprovalRulePredicateSet'] },
];
const existing = { id: 'sub-1', key: 'bcc-ledger', version: 4, messages: [], changes: [], events: [] };

const absent = () => http.get(`${API}/subscriptions/key=bcc-ledger`, () => ctError(404));
const captureCreate = (sink: { body?: unknown }) =>
  http.post(`${API}/subscriptions`, async ({ request }) => {
    sink.body = await request.json();
    return HttpResponse.json({ ...existing, version: 1 }, { status: 201 });
  });

describe('[BCC-DEPLOY-4] subscription registration', () => {
  test('absent: creates bcc-ledger on the Pub/Sub destination when the destination type is unset', async () => {
    const sink: { body?: unknown } = {};
    server.use(absent(), captureCreate(sink));
    expect(await ensureSubscription(createApiRoot(config()), GCP)).toBe('created');
    expect(sink.body).toEqual({
      key: 'bcc-ledger',
      destination: { type: 'GoogleCloudPubSub', topic: 'bcc-topic', projectId: 'gcp-project' },
      messages: MESSAGES,
    });
  });
  test('explicit GoogleCloudPubSub uses the same destination', async () => {
    const sink: { body?: unknown } = {};
    server.use(absent(), captureCreate(sink));
    await ensureSubscription(createApiRoot(config()), { ...GCP, CONNECT_SUBSCRIPTION_DESTINATION: 'GoogleCloudPubSub' });
    expect((sink.body as { destination: unknown }).destination).toEqual({
      type: 'GoogleCloudPubSub',
      topic: 'bcc-topic',
      projectId: 'gcp-project',
    });
  });
  test('SNS uses the topic ARN with IAM authentication', async () => {
    const sink: { body?: unknown } = {};
    server.use(absent(), captureCreate(sink));
    const arn = 'arn:aws:sns:eu-central-1:123456789012:bcc';
    await ensureSubscription(createApiRoot(config()), { CONNECT_SUBSCRIPTION_DESTINATION: 'SNS', CONNECT_AWS_TOPIC_ARN: arn });
    expect((sink.body as { destination: unknown }).destination).toEqual({ type: 'SNS', topicArn: arn, authenticationMode: 'IAM' });
  });
  test('an unknown destination type throws before any request', async () => {
    await expect(ensureSubscription(createApiRoot(config()), { CONNECT_SUBSCRIPTION_DESTINATION: 'AzureServiceBus' })).rejects.toThrow(
      'Unknown subscription destination type: AzureServiceBus',
    );
    expect(requests).toEqual([]);
  });
  test('a missing Pub/Sub topic throws naming the variable', async () => {
    await expect(ensureSubscription(createApiRoot(config()), { CONNECT_GCP_PROJECT_ID: 'gcp-project' })).rejects.toThrow(
      'CONNECT_GCP_TOPIC_NAME',
    );
    expect(requests).toEqual([]);
  });
  test('present: changeDestination and setMessages on its version, never delete', async () => {
    let body: unknown;
    server.use(
      http.get(`${API}/subscriptions/key=bcc-ledger`, () => HttpResponse.json(existing)),
      http.post(`${API}/subscriptions/key=bcc-ledger`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...existing, version: 5 });
      }),
    );
    expect(await ensureSubscription(createApiRoot(config()), GCP)).toBe('updated');
    expect(body).toEqual({
      version: 4,
      actions: [
        { action: 'changeDestination', destination: { type: 'GoogleCloudPubSub', topic: 'bcc-topic', projectId: 'gcp-project' } },
        { action: 'setMessages', messages: MESSAGES },
      ],
    });
    expect(requests.filter((r) => r.startsWith('DELETE'))).toEqual([]);
  });
  test('postDeploy reads the environment and registers the subscription', async () => {
    const sink: { body?: unknown } = {};
    server.use(absent(), captureCreate(sink));
    await postDeploy({ ...ENV, ...GCP });
    expect((sink.body as { key: string }).key).toBe('bcc-ledger');
  });
});

describe('[BCC-DEPLOY-5] undeploy', () => {
  test('removal deletes by key with the version', async () => {
    let deleted: string | undefined;
    server.use(
      http.get(`${API}/subscriptions/key=bcc-ledger`, () => HttpResponse.json({ ...existing, version: 2 })),
      http.delete(`${API}/subscriptions/key=bcc-ledger`, ({ request }) => {
        deleted = new URL(request.url).searchParams.get('version') ?? undefined;
        return HttpResponse.json({ ...existing, version: 2 });
      }),
    );
    expect(await removeSubscription(createApiRoot(config()))).toBe('deleted');
    expect(deleted).toBe('2');
  });
  test('absent: no-op', async () => {
    server.use(absent());
    expect(await removeSubscription(createApiRoot(config()))).toBe('absent');
    expect(requests.filter((r) => r.startsWith('DELETE'))).toEqual([]);
  });
  test('preUndeploy removes only the subscription', async () => {
    server.use(
      http.get(`${API}/subscriptions/key=bcc-ledger`, () => HttpResponse.json(existing)),
      http.delete(`${API}/subscriptions/key=bcc-ledger`, () => HttpResponse.json(existing)),
    );
    await preUndeploy(ENV);
    expect(requests.filter((r) => r.startsWith('DELETE'))).toEqual(['DELETE /demo/subscriptions/key=bcc-ledger']);
  });
});

describe('[BCC-DEPLOY-6] least privilege', () => {
  test('a missing scope throws naming it before any request (review minor 7)', async () => {
    await expect(postDeploy({ ...ENV, ...GCP, CTP_SCOPE: 'manage_orders:demo manage_subscriptions:demo' })).rejects.toThrow(/missing.*view_types/);
  });
  test('an extra scope throws naming it before any request', async () => {
    await expect(postDeploy({ ...ENV, ...GCP, CTP_SCOPE: `${ENV.CTP_SCOPE} manage_project:demo manage_products:demo` })).rejects.toThrow(
      /manage_project, manage_products/,
    );
    expect(requests).toEqual([]);
  });
});
