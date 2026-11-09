// [BCC-CART-13]
import { withCache } from '../src/cached-platform';
import { FakePlatform } from './fake-platform';

function setup(ttlMs = 60000, maxEntries = 1000) {
  const p = new FakePlatform();
  p.units = [{ key: 'unit-a', associates: [] }];
  p.objects = [{ container: 'bcc-settings', key: 'unit-a', value: { x: 1 } }];
  let t = 0;
  const cached = withCache(p, { ttlMs, maxEntries, now: () => t });
  return { p, cached, advance: (ms: number) => (t += ms) };
}
const count = (p: FakePlatform, method: string) => p.calls.filter((c) => c.method === method).length;

test('a second read inside the window comes from the cache [BCC-CART-13]', async () => {
  const { p, cached } = setup();
  await cached.getBusinessUnit('unit-a');
  await cached.getBusinessUnit('unit-a');
  await cached.getCustomObjects('bcc-settings', ['unit-a']);
  await cached.getCustomObjects('bcc-settings', ['unit-a']);
  await cached.queryBudgets(['unit-a']);
  await cached.queryBudgets(['unit-a']);
  expect([count(p, 'getBusinessUnit'), count(p, 'getCustomObjects'), count(p, 'queryBudgets')]).toEqual([1, 1, 1]);
});
test('different arguments are different entries [BCC-CART-13]', async () => {
  const { p, cached } = setup();
  await cached.getCustomObjects('bcc-settings', ['unit-a']);
  await cached.getCustomObjects('bcc-cost-objects', ['unit-a']);
  await cached.queryBudgets(['unit-a']);
  await cached.queryBudgets(['unit-b']);
  expect([count(p, 'getCustomObjects'), count(p, 'queryBudgets')]).toEqual([2, 2]);
});
test('the data is read again after the window [BCC-CART-13]', async () => {
  const { p, cached, advance } = setup(60000);
  await cached.getBusinessUnit('unit-a');
  advance(59999);
  await cached.getBusinessUnit('unit-a');
  expect(count(p, 'getBusinessUnit')).toBe(1);
  advance(2);
  await cached.getBusinessUnit('unit-a');
  expect(count(p, 'getBusinessUnit')).toBe(2);
});
test('orders, carts, quotes and type lookups are never cached [BCC-CART-13]', async () => {
  const { p, cached } = setup();
  p.types = { 'bcc-order': 't1' };
  for (let i = 0; i < 2; i++) {
    await cached.queryOrders('x');
    await cached.getCart('c');
    await cached.getQuote('q');
    await cached.typeIdByKey('bcc-order');
  }
  expect([count(p, 'queryOrders'), count(p, 'getCart'), count(p, 'getQuote'), count(p, 'typeIdByKey')]).toEqual([2, 2, 2, 2]);
});
test('identical reads in flight share one request [BCC-CART-13]', async () => {
  const { p, cached } = setup();
  await Promise.all([cached.queryBudgets(['unit-a']), cached.queryBudgets(['unit-a'])]);
  expect(count(p, 'queryBudgets')).toBe(1);
});
test('a failed read is not cached [BCC-CART-13]', async () => {
  const { p, cached } = setup();
  p.failWith.getCustomObjects = new Error('503');
  await expect(cached.getCustomObjects('bcc-settings', ['unit-a'])).rejects.toThrow('503');
  delete p.failWith.getCustomObjects;
  expect(await cached.getCustomObjects('bcc-settings', ['unit-a'])).toHaveLength(1);
  expect(count(p, 'getCustomObjects')).toBe(2);
});
test('an absent Business Unit is not cached [BCC-CART-13]', async () => {
  const { p, cached } = setup();
  expect(await cached.getBusinessUnit('unit-z')).toBeUndefined();
  p.units.push({ key: 'unit-z', associates: [] });
  expect((await cached.getBusinessUnit('unit-z'))?.key).toBe('unit-z');
});
test('the cache holds at most the configured entries and drops the oldest [BCC-CART-13]', async () => {
  const { p, cached } = setup(60000, 2);
  await cached.queryBudgets(['a']);
  await cached.queryBudgets(['b']);
  await cached.queryBudgets(['c']);
  await cached.queryBudgets(['b']);
  await cached.queryBudgets(['a']);
  expect(count(p, 'queryBudgets')).toBe(4);
});
