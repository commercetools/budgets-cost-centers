// In-memory ServicePlatform for domain tests. [BCC-CART-4]
import type { OrderLike } from 'budgets-cost-centers-core';
import type { BusinessUnitLike, CartLike, QuoteLike, ServicePlatform, StoredRecord } from '../src/platform';

type Method = keyof ServicePlatform;

export class FakePlatform implements ServicePlatform {
  units: BusinessUnitLike[] = [];
  objects: Array<StoredRecord & { container: string }> = [];
  orders: OrderLike[] = [];
  carts: CartLike[] = [];
  quotes: Array<QuoteLike & { id: string }> = [];
  types: Record<string, string> = { 'bcc-order': 'type-order', 'bcc-quote': 'type-quote' };
  calls: Array<{ method: Method; arg: unknown }> = [];
  failWith: Partial<Record<Method, Error>> = {};
  hang: Partial<Record<Method, boolean>> = {};

  private async run<T>(method: Method, arg: unknown, value: () => T): Promise<T> {
    this.calls.push({ method, arg });
    if (this.hang[method]) await new Promise(() => undefined);
    const error = this.failWith[method];
    if (error) throw error;
    return value();
  }

  getBusinessUnit(key: string) {
    return this.run('getBusinessUnit', key, () => this.units.find((u) => u.key === key));
  }
  getCustomObjects(container: string, keys: string[]) {
    return this.run('getCustomObjects', { container, keys }, () =>
      this.objects.filter((o) => o.container === container && keys.includes(o.key)).map(({ key, value }) => ({ key, value })),
    );
  }
  queryBudgets(ownerKeys: string[]) {
    return this.run('queryBudgets', ownerKeys, () =>
      this.objects
        .filter((o) => o.container === 'bcc-budgets' && ownerKeys.includes((o.value as { ownerBusinessUnitKey?: string })?.ownerBusinessUnitKey ?? ''))
        .map(({ key, value }) => ({ key, value })),
    );
  }
  // The fake ignores the predicate and returns every order; core filters by scope again.
  queryOrders(where: string) {
    return this.run('queryOrders', where, () => [...this.orders]);
  }
  getCart(id: string) {
    return this.run('getCart', id, () => this.carts.find((c) => c.id === id));
  }
  getQuote(id: string) {
    return this.run('getQuote', id, () => this.quotes.find((q) => q.id === id));
  }
  typeIdByKey(key: string) {
    return this.run('typeIdByKey', key, () => this.types[key]);
  }
}
