// The API Extension, registered get-then-update and authenticated by header. [BCC-DEPLOY-3] [BCC-DEPLOY-5] [BCC-CART-1]
import type { ExtensionDestination, ExtensionTrigger } from '@commercetools/platform-sdk';
import type { ApiRoot } from 'budgets-cost-centers-shared';
import { orUndefined } from '../sdk-platform';

export const EXTENSION_KEY = 'bcc-service';

// Carts without a Business Unit never call out: https://docs.commercetools.com/api/projects/api-extensions
const TRIGGERS: ExtensionTrigger[] = [
  { resourceTypeId: 'cart', actions: ['Create', 'Update'], condition: 'businessUnit is defined' },
  { resourceTypeId: 'order', actions: ['Create'], condition: 'businessUnit is defined' },
  { resourceTypeId: 'quote-request', actions: ['Create'] },
];

const destination = (url: string, secret: string): ExtensionDestination => ({
  type: 'HTTP',
  url,
  authentication: { type: 'AuthorizationHeader', headerValue: `Bearer ${secret}` },
});

export async function ensureExtension(apiRoot: ApiRoot, url: string, secret: string): Promise<'created' | 'updated'> {
  const existing = await orUndefined(() => apiRoot.extensions().withKey({ key: EXTENSION_KEY }).get().execute());
  if (!existing) {
    await apiRoot.extensions().post({ body: { key: EXTENSION_KEY, destination: destination(url, secret), triggers: TRIGGERS } }).execute();
    return 'created';
  }
  await apiRoot
    .extensions()
    .withKey({ key: EXTENSION_KEY })
    .post({
      body: {
        version: existing.version,
        actions: [
          { action: 'changeDestination', destination: destination(url, secret) },
          { action: 'changeTriggers', triggers: TRIGGERS },
        ],
      },
    })
    .execute();
  return 'updated';
}

export async function removeExtension(apiRoot: ApiRoot): Promise<void> {
  const existing = await orUndefined(() => apiRoot.extensions().withKey({ key: EXTENSION_KEY }).get().execute());
  if (existing) await apiRoot.extensions().withKey({ key: EXTENSION_KEY }).delete({ queryArgs: { version: existing.version } }).execute();
}
