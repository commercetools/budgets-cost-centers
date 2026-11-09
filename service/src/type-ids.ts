// Custom Type ids by key, cached per platform once found. [BCC-CART-11]
import type { ServicePlatform } from './platform';

type TypePlatform = Pick<ServicePlatform, 'typeIdByKey'>;

const cache = new WeakMap<object, Map<string, string>>();

export async function typeIdOf(platform: TypePlatform, key: string, opts: { refresh?: boolean } = {}): Promise<string | undefined> {
  let ids = cache.get(platform);
  if (!ids) cache.set(platform, (ids = new Map()));
  const known = opts.refresh ? undefined : ids.get(key);
  if (known) return known;
  const id = await platform.typeIdByKey(key);
  if (id) ids.set(key, id);
  else ids.delete(key);
  return id;
}

// The configured type's id; when a resource carries another id, the type may have been recreated, so the cache
// is refreshed once before the resource is treated as foreign.
export async function typeIdFor(platform: TypePlatform, key: string, seenTypeId?: string): Promise<string | undefined> {
  const id = await typeIdOf(platform, key);
  return id && seenTypeId && seenTypeId !== id ? typeIdOf(platform, key, { refresh: true }) : id;
}
