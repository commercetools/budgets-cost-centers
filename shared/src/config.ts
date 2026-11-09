// Environment configuration of the Connect apps, validated once at startup. [BCC-DEPLOY-6] [BCC-PROJ-3] [BCC-CART-13]
export type AppName = 'service' | 'ledger' | 'seed';

export type AppConfig = {
  projectKey: string;
  authUrl: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  extensionSecret?: string;
  typeKeys: { order: string; lineItem: string; shoppingList: string; quote: string };
  projectRetentionDays: number;
  cacheSeconds: number;
};

type Env = Record<string, string | undefined>;

// Carts are removed after 1 to 365250 days: https://docs.commercetools.com/api/general-concepts#automatic-cleanup
const MAX_RETENTION_DAYS = 365250;
const MIN_SECRET_LENGTH = 32;
const MAX_CACHE_SECONDS = 3600;

export function readConfig(env: Env, app: AppName): AppConfig {
  const errors: string[] = [];
  const required = (key: string): string => {
    const v = env[key]?.trim();
    if (!v) errors.push(`${key} is required`);
    return v ?? '';
  };

  const projectKey = required('CTP_PROJECT_KEY');
  let authUrl = env.CTP_AUTH_URL?.trim();
  let apiUrl = env.CTP_API_URL?.trim();
  const region = env.CTP_REGION?.trim();
  if (!authUrl || !apiUrl) {
    if (region) {
      authUrl = `https://auth.${region}.commercetools.com`;
      apiUrl = `https://api.${region}.commercetools.com`;
    } else errors.push('CTP_REGION or CTP_AUTH_URL and CTP_API_URL are required');
  }
  const clientId = required('CTP_CLIENT_ID');
  const clientSecret = required('CTP_CLIENT_SECRET');
  const scope = required('CTP_SCOPE');

  let extensionSecret: string | undefined;
  if (app === 'service') {
    extensionSecret = required('BCC_EXTENSION_SECRET');
    if (extensionSecret && extensionSecret.length < MIN_SECRET_LENGTH) {
      errors.push(`BCC_EXTENSION_SECRET must have at least ${MIN_SECRET_LENGTH} characters`);
    }
  }

  const retentionRaw = env.BCC_PROJECT_RETENTION_DAYS?.trim() || '365';
  const projectRetentionDays = Number(retentionRaw);
  if (!Number.isInteger(projectRetentionDays) || projectRetentionDays < 1 || projectRetentionDays > MAX_RETENTION_DAYS) {
    errors.push(`BCC_PROJECT_RETENTION_DAYS must be a whole number from 1 to ${MAX_RETENTION_DAYS}`);
  }

  const cacheRaw = env.BCC_CACHE_SECONDS?.trim() || '60';
  const cacheSeconds = Number(cacheRaw);
  if (!Number.isInteger(cacheSeconds) || cacheSeconds < 0 || cacheSeconds > MAX_CACHE_SECONDS) {
    errors.push(`BCC_CACHE_SECONDS must be a whole number from 0 to ${MAX_CACHE_SECONDS}`);
  }

  if (errors.length) throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  return {
    projectKey,
    authUrl: authUrl as string,
    apiUrl: apiUrl as string,
    clientId,
    clientSecret,
    scope,
    ...(extensionSecret !== undefined ? { extensionSecret } : {}),
    typeKeys: {
      order: env.BCC_ORDER_TYPE_KEY?.trim() || 'bcc-order',
      lineItem: env.BCC_LINE_ITEM_TYPE_KEY?.trim() || 'bcc-line-item',
      shoppingList: env.BCC_SHOPPING_LIST_TYPE_KEY?.trim() || 'bcc-shopping-list',
      quote: env.BCC_QUOTE_TYPE_KEY?.trim() || 'bcc-quote',
    },
    projectRetentionDays,
    cacheSeconds,
  };
}
