// Master data reads kept for a short time; orders and everything else stay live. [BCC-CART-13]
import type { ServicePlatform } from './platform';

export type CacheOptions = { ttlMs: number; maxEntries?: number; now?: () => number };

export function withCache(platform: ServicePlatform, options: CacheOptions): ServicePlatform {
  const { ttlMs, maxEntries = 1000, now = Date.now } = options;
  const entries = new Map<string, { expires: number; value: Promise<unknown> }>();

  // Identical reads share one promise; failures and absent values are dropped so the next call reads again.
  const cached = <T>(key: string, read: () => Promise<T>, keep: (value: T) => boolean = () => true): Promise<T> => {
    const hit = entries.get(key);
    if (hit && hit.expires > now()) return hit.value as Promise<T>;
    entries.delete(key);
    const value = read();
    entries.set(key, { expires: now() + ttlMs, value });
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
    value.then(
      (v) => {
        if (!keep(v) && entries.get(key)?.value === value) entries.delete(key);
      },
      () => {
        if (entries.get(key)?.value === value) entries.delete(key);
      },
    );
    return value;
  };

  return {
    getBusinessUnit: (key) => cached(`bu:${key}`, () => platform.getBusinessUnit(key), (v) => v !== undefined),
    getCustomObjects: (container, keys) => cached(`co:${container}:${JSON.stringify(keys)}`, () => platform.getCustomObjects(container, keys)),
    queryBudgets: (ownerKeys) => cached(`bd:${JSON.stringify(ownerKeys)}`, () => platform.queryBudgets(ownerKeys)),
    queryOrders: (where) => platform.queryOrders(where),
    getCart: (id) => platform.getCart(id),
    getQuote: (id) => platform.getQuote(id),
    typeIdByKey: (key) => platform.typeIdByKey(key),
  };
}
