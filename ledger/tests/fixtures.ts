// Test configuration, fake platform and msw helpers for the ledger. [BCC-APPR-5] [BCC-APPR-6]
import { http, HttpResponse } from 'msw';
import { readConfig } from 'budgets-cost-centers-shared';
import { PlatformError, type LedgerOrder, type LedgerPlatform, type OrderAction } from '../src/platform';

export const ENV = {
  CTP_PROJECT_KEY: 'demo',
  CTP_AUTH_URL: 'https://auth.test',
  CTP_API_URL: 'https://api.test',
  CTP_CLIENT_ID: 'id',
  CTP_CLIENT_SECRET: 'secret',
  CTP_SCOPE: 'manage_orders:demo view_types:demo view_messages:demo manage_key_value_documents:demo manage_subscriptions:demo',
};

export const config = () => readConfig(ENV, 'ledger');

export const API = 'https://api.test/demo';

export const tokenHandler = http.post('https://auth.test/oauth/token', () =>
  HttpResponse.json({ access_token: 'token', expires_in: 172800, token_type: 'Bearer', scope: ENV.CTP_SCOPE }),
);

export const ctError = (statusCode: number, message = 'error') =>
  HttpResponse.json({ statusCode, message, errors: [{ code: 'General', message }] }, { status: statusCode });

type Method = keyof LedgerPlatform;

export class FakeLedgerPlatform implements LedgerPlatform {
  orders: LedgerOrder[] = [];
  // Messages as the Messages API stores them, by id.
  messages: Record<string, unknown> = {};
  settings: Array<{ key: string; version: number; value: unknown }> = [];
  settingsWrites: Array<{ key: string; version: number; value: unknown }> = [];
  types: Record<string, string> = { 'bcc-order': 'type-order' };
  updates: Array<{ id: string; version: number; actions: OrderAction[] }> = [];
  calls: Method[] = [];
  failWith: Partial<Record<Method, Error>> = {};

  private async run<T>(method: Method, value: () => T): Promise<T> {
    this.calls.push(method);
    const error = this.failWith[method];
    if (error) throw error;
    return value();
  }

  findSettingsByRuleId(ruleId: string) {
    return this.run('findSettingsByRuleId', () =>
      this.settings.filter((r) => (r.value as { approval?: { ruleId?: string } }).approval?.ruleId === ruleId).map((r) => ({ ...r })),
    );
  }
  saveSettings(key: string, value: unknown, version: number) {
    return this.run('saveSettings', () => {
      const r = this.settings.find((x) => x.key === key);
      if (!r || r.version !== version) throw new PlatformError(409, 'conflict');
      this.settingsWrites.push({ key, version, value });
      r.value = value;
      r.version += 1;
    });
  }
  getMessage(id: string) {
    return this.run('getMessage', () => this.messages[id]);
  }
  getOrder(id: string) {
    return this.run('getOrder', () => this.orders.find((o) => o.id === id));
  }
  typeIdByKey(key: string) {
    return this.run('typeIdByKey', () => this.types[key]);
  }
  // Applies the actions like the platform would, so a second delivery sees the written value.
  updateOrder(id: string, version: number, actions: OrderAction[]) {
    return this.run('updateOrder', () => {
      const order = this.orders.find((o) => o.id === id);
      if (!order) throw new PlatformError(404, 'not found');
      if (order.version !== version) throw new PlatformError(409, 'conflict');
      this.updates.push({ id, version, actions });
      for (const a of actions) {
        if (a.action === 'setCustomType') {
          order.custom = { type: { id: this.types[a.type.key] ?? 'unknown' }, fields: { ...a.fields } };
        } else if (order.custom) {
          order.custom.fields = { ...order.custom.fields, [a.name]: a.value };
        }
      }
      order.version += 1;
    });
  }
}

// Stores a pushed Message the way the Messages API would return it. [BCC-APPR-7]
export function store(platform: FakeLedgerPlatform, message: Record<string, unknown>): void {
  const { notificationType: _n, ...stored } = message;
  platform.messages[String(message.id)] = stored;
}
