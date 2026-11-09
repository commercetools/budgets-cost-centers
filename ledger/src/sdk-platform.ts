// LedgerPlatform on the commercetools TypeScript SDK. [BCC-APPR-5] [BCC-APPR-6] [BCC-APPR-7] [BCC-APPR-8]
import type { OrderUpdateAction } from '@commercetools/platform-sdk';
import { isRecord } from 'budgets-cost-centers-core';
import type { ApiRoot } from 'budgets-cost-centers-shared';
import { CONTAINERS } from 'budgets-cost-centers-core';
import { type LedgerPlatform, PlatformError } from './platform';

// ts-client errors carry `statusCode`; network failures carry none or 0.
export function toPlatformError(error: unknown): PlatformError {
  if (error instanceof PlatformError) return error;
  const raw = isRecord(error) ? (error.statusCode ?? error.status) : undefined;
  const status = typeof raw === 'number' && raw > 0 ? raw : undefined;
  const message = error instanceof Error ? error.message : isRecord(error) && typeof error.message === 'string' ? error.message : 'Platform call failed';
  return new PlatformError(status, message);
}

async function orUndefinedOn404<T>(call: () => Promise<T>): Promise<T | undefined> {
  try {
    return await call();
  } catch (error) {
    const e = toPlatformError(error);
    if (e.status === 404) return undefined;
    throw e;
  }
}

export function sdkPlatform(apiRoot: ApiRoot): LedgerPlatform {
  return {
    async findSettingsByRuleId(ruleId) {
      try {
        const { body } = await apiRoot
          .customObjects()
          .withContainer({ container: CONTAINERS.settings })
          .get({ queryArgs: { where: `value(approval(ruleId=${JSON.stringify(ruleId)}))`, limit: 500 } })
          .execute();
        return body.results.map((r) => ({ key: r.key, version: r.version, value: r.value }));
      } catch (error) {
        throw toPlatformError(error);
      }
    },
    async saveSettings(key, value, version) {
      try {
        await apiRoot.customObjects().post({ body: { container: CONTAINERS.settings, key, value, version } }).execute();
      } catch (error) {
        throw toPlatformError(error);
      }
    },
    getMessage: (id) => orUndefinedOn404(async () => (await apiRoot.messages().withId({ ID: id }).get().execute()).body),
    async getOrder(id) {
      const order = await orUndefinedOn404(async () => (await apiRoot.orders().withId({ ID: id }).get().execute()).body);
      if (!order) return undefined;
      return {
        id: order.id,
        version: order.version,
        ...(order.custom ? { custom: { type: { id: order.custom.type.id }, fields: { ...order.custom.fields } } } : {}),
      };
    },
    async updateOrder(id, version, actions) {
      try {
        await apiRoot
          .orders()
          .withId({ ID: id })
          .post({ body: { version, actions: actions as OrderUpdateAction[] } })
          .execute();
      } catch (error) {
        throw toPlatformError(error);
      }
    },
    async typeIdByKey(key) {
      const type = await orUndefinedOn404(async () => (await apiRoot.types().withKey({ key }).get().execute()).body);
      return type?.id;
    },
  };
}
