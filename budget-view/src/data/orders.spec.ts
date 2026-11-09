// Orders for consumption: a GraphQL projection through the Merchant Center API, paged by id like the service and read
// once per predicate. [BCC-SPEND-1]
import { graphql } from 'msw';
import {
  hooks,
  waitFor,
} from '@commercetools-frontend/application-shell/test-utils';
import { PROJECT, startServer } from '../test-utils/platform-mock';
import { OrdersReaderProvider, useOrders } from './orders';

const server = startServer();

const order = (i: number) => ({
  id: `order-${String(i).padStart(4, '0')}`,
  createdAt: '2026-11-03T10:00:00.000Z',
  orderState: 'Open',
  customerId: 'customer-1',
  businessUnit: { key: 'unit-a' },
  totalPrice: { currencyCode: 'EUR', centAmount: 1190 },
  taxedPrice: { totalNet: { currencyCode: 'EUR', centAmount: 1000 } },
  custom: {
    customFieldsRaw: [{ name: 'bccCostObject', value: 'unit-a~SITE-7' }],
  },
});

type Vars = { where: string; sort: string[]; limit: number };

const answer = (requests: Vars[], results: (v: Vars) => unknown[]) =>
  server.use(
    graphql.query('BccViewOrders', (req, res, ctx) => {
      const v = req.variables as Vars;
      requests.push(v);
      return res(ctx.data({ orders: { results: results(v) } }));
    })
  );

describe('useOrders', () => {
  it('finding 4: reads a GraphQL projection paged by id and returns orders for core', async () => {
    const requests: Vars[] = [];
    answer(requests, (v) =>
      v.where.includes('id >')
        ? [order(500)]
        : Array.from({ length: 500 }, (_, i) => order(i))
    );
    const where = 'businessUnit(key = "unit-a")';
    const { result } = hooks.renderHook(() => useOrders([where]), {
      project: { key: PROJECT },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeUndefined();
    expect(result.current.orders).toHaveLength(501);
    expect(requests).toEqual([
      { where, sort: ['id asc'], limit: 500 },
      {
        where: `(${where}) and id > "order-0499"`,
        sort: ['id asc'],
        limit: 500,
      },
    ]);
    expect(result.current.orders[500]).toEqual({
      id: 'order-0500',
      createdAt: '2026-11-03T10:00:00.000Z',
      orderState: 'Open',
      customerId: 'customer-1',
      businessUnit: { key: 'unit-a' },
      totalPrice: { currencyCode: 'EUR', centAmount: 1190 },
      taxedPrice: { totalNet: { currencyCode: 'EUR', centAmount: 1000 } },
      custom: { fields: { bccCostObject: 'unit-a~SITE-7' } },
    });
  });

  it('finding 4: reads each predicate once per panel and merges chunks by order id', async () => {
    const requests: Vars[] = [];
    answer(requests, (v) =>
      v.where === 'a' ? [order(1), order(2)] : [order(2), order(3)]
    );
    const { result } = hooks.renderHook(
      () => ({ first: useOrders(['a', 'b']), second: useOrders(['a']) }),
      { project: { key: PROJECT }, wrapper: OrdersReaderProvider }
    );
    await waitFor(() => {
      expect(result.current.first.loading).toBe(false);
      expect(result.current.second.loading).toBe(false);
    });
    expect(result.current.first.orders.map((o) => o.id)).toEqual([
      'order-0001',
      'order-0002',
      'order-0003',
    ]);
    expect(result.current.second.orders).toHaveLength(2);
    expect(requests.map((r) => r.where)).toEqual(['a', 'b']);
  });

  it('reads nothing without a predicate', async () => {
    const { result } = hooks.renderHook(() => useOrders(undefined), {
      project: { key: PROJECT },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orders).toEqual([]);
  });
});
