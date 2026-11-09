// Subscription bcc-ledger for the two Approval Flow Messages. [BCC-DEPLOY-4] [BCC-DEPLOY-5]
// Registered on the destination Connect provides: https://docs.commercetools.com/connect/automation-scripts
import type { Destination, MessageSubscription } from '@commercetools/platform-sdk';
import type { ApiRoot } from 'budgets-cost-centers-shared';
import { toPlatformError } from '../sdk-platform';

export const SUBSCRIPTION_KEY = 'bcc-ledger';
export const MESSAGES: MessageSubscription[] = [
  { resourceTypeId: 'approval-flow', types: ['ApprovalFlowCreated', 'ApprovalFlowCompleted'] },
  // Rule changes narrow or clear the coverage records. [BCC-APPR-8]
  { resourceTypeId: 'approval-rule', types: ['ApprovalRuleStatusSet', 'ApprovalRuleRequestersSet', 'ApprovalRulePredicateSet'] },
];

type Env = Record<string, string | undefined>;

export function destinationFrom(env: Env): Destination {
  const required = (key: string): string => {
    const v = env[key]?.trim();
    if (!v) throw new Error(`${key} is required for the subscription destination`);
    return v;
  };
  const type = env.CONNECT_SUBSCRIPTION_DESTINATION?.trim();
  if (!type || type === 'GoogleCloudPubSub') {
    return { type: 'GoogleCloudPubSub', topic: required('CONNECT_GCP_TOPIC_NAME'), projectId: required('CONNECT_GCP_PROJECT_ID') };
  }
  if (type === 'SNS') return { type: 'SNS', topicArn: required('CONNECT_AWS_TOPIC_ARN'), authenticationMode: 'IAM' };
  throw new Error(`Unknown subscription destination type: ${type}`);
}

async function currentVersion(apiRoot: ApiRoot): Promise<number | undefined> {
  try {
    return (await apiRoot.subscriptions().withKey({ key: SUBSCRIPTION_KEY }).get().execute()).body.version;
  } catch (error) {
    const e = toPlatformError(error);
    if (e.status === 404) return undefined;
    throw e;
  }
}

// Updates in place when present, so no Message is lost between a delete and a create.
export async function ensureSubscription(apiRoot: ApiRoot, env: Env): Promise<'created' | 'updated'> {
  const destination = destinationFrom(env);
  const version = await currentVersion(apiRoot);
  if (version === undefined) {
    await apiRoot.subscriptions().post({ body: { key: SUBSCRIPTION_KEY, destination, messages: MESSAGES } }).execute();
    return 'created';
  }
  await apiRoot
    .subscriptions()
    .withKey({ key: SUBSCRIPTION_KEY })
    .post({
      body: {
        version,
        actions: [
          { action: 'changeDestination', destination },
          { action: 'setMessages', messages: MESSAGES },
        ],
      },
    })
    .execute();
  return 'updated';
}

export async function removeSubscription(apiRoot: ApiRoot): Promise<'deleted' | 'absent'> {
  const version = await currentVersion(apiRoot);
  if (version === undefined) return 'absent';
  await apiRoot.subscriptions().withKey({ key: SUBSCRIPTION_KEY }).delete({ queryArgs: { version } }).execute();
  return 'deleted';
}
