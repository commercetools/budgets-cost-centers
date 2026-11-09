// Orders for consumption: a GraphQL projection through the Merchant Center API, paged by id like the service, read once
// per predicate and panel. [BCC-SPEND-1] [BCC-VIEW-4] [BCC-VIEW-7]
// https://docs.commercetools.com/merchant-center-customizations/development/data-fetching#graphql-http-client
// https://docs.commercetools.com/api/projects/orders (GraphQL `orders` query)
// The fields are those of service/src/sdk-platform.ts ORDERS_QUERY; the document is validated against the public schema.
import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { type ApolloClient, gql, useApolloClient } from '@apollo/client';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import type { OrderLike } from '../core';
import { type DataError, PAGE, q, requestError, useProjectKey } from './client';

export const ORDERS_QUERY = gql`
  query BccViewOrders($where: String, $sort: [String!], $limit: Int) {
    orders(where: $where, sort: $sort, limit: $limit) {
      results {
        id
        createdAt
        orderState
        customerId
        businessUnit {
          key
        }
        totalPrice {
          currencyCode
          centAmount
        }
        taxedPrice {
          totalNet {
            currencyCode
            centAmount
          }
        }
        custom {
          customFieldsRaw(
            includeNames: ["bccCostObject", "bccApprovalStatus"]
          ) {
            name
            value
          }
        }
      }
    }
  }
`;

type Money = { currencyCode: string; centAmount: number };
type OrderProjection = {
  id: string;
  createdAt: string;
  orderState: string;
  customerId?: string | null;
  businessUnit?: { key: string } | null;
  totalPrice: Money;
  taxedPrice?: { totalNet: Money } | null;
  custom?: {
    customFieldsRaw?: Array<{ name: string; value: unknown }> | null;
  } | null;
};

const money = (m: Money) => ({
  currencyCode: m.currencyCode,
  centAmount: m.centAmount,
});

// Only the fields core's consumption needs are kept.
export const toOrderLike = (o: OrderProjection): OrderLike => ({
  id: o.id,
  createdAt: o.createdAt,
  orderState: o.orderState,
  ...(o.customerId ? { customerId: o.customerId } : {}),
  ...(o.businessUnit ? { businessUnit: { key: o.businessUnit.key } } : {}),
  totalPrice: money(o.totalPrice),
  ...(o.taxedPrice
    ? { taxedPrice: { totalNet: money(o.taxedPrice.totalNet) } }
    : {}),
  ...(o.custom
    ? {
        custom: {
          fields: Object.fromEntries(
            (o.custom.customFieldsRaw ?? []).map((f) => [f.name, f.value])
          ),
        },
      }
    : {}),
});

type Client = Pick<ApolloClient<unknown>, 'query'>;

// Pages by id instead of offset, so large result sets stay cheap.
export async function fetchOrders(
  client: Client,
  projectKey: string,
  where: string
): Promise<OrderLike[]> {
  const all: OrderLike[] = [];
  for (let last: string | undefined; ; ) {
    const { data } = await client.query<{
      orders: { results: OrderProjection[] };
    }>({
      query: ORDERS_QUERY,
      variables: {
        where: last ? `(${where}) and id > ${q(last)}` : where,
        sort: ['id asc'],
        limit: PAGE,
      },
      context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM, projectKey },
      fetchPolicy: 'no-cache',
    });
    const results = data.orders.results;
    all.push(...results.map(toOrderLike));
    if (results.length < PAGE) return all;
    last = results[results.length - 1]?.id;
  }
}

// Reads each predicate once; a list of predicates (chunks of one query) is merged by order id.
export type OrdersReader = { read: (wheres: string[]) => Promise<OrderLike[]> };

export function createOrdersReader(
  client: Client,
  projectKey: string
): OrdersReader {
  const cache = new Map<string, Promise<OrderLike[]>>();
  const one = (where: string) => {
    let p = cache.get(where);
    if (!p) {
      p = fetchOrders(client, projectKey, where);
      cache.set(where, p);
      // A failed read is tried again next time.
      p.catch(() => cache.delete(where));
    }
    return p;
  };
  return {
    read: async (wheres) => {
      const byId = new Map<string, OrderLike>();
      for (const orders of await Promise.all(wheres.map(one)))
        for (const o of orders) byId.set(o.id, o);
      return [...byId.values()];
    },
  };
}

const ReaderContext = createContext<OrdersReader | undefined>(undefined);

function useNewReader(): OrdersReader {
  const client = useApolloClient();
  const projectKey = useProjectKey() ?? '';
  return useMemo(
    () => createOrdersReader(client, projectKey),
    [client, projectKey]
  );
}

// One reader per panel, shared by the budget rows, the project overview and the export.
export const OrdersReaderProvider = ({ children }: { children: ReactNode }) =>
  createElement(ReaderContext.Provider, { value: useNewReader() }, children);

export function useOrdersReader(): OrdersReader {
  const shared = useContext(ReaderContext);
  const own = useNewReader();
  return shared ?? own;
}

export type OrdersState = {
  orders: OrderLike[];
  loading: boolean;
  error?: DataError;
};

// `wheres` are Order query predicates whose results are merged; without any nothing is read, so the view never scans
// all orders.
export function useOrders(wheres: string[] | undefined): OrdersState {
  const reader = useOrdersReader();
  const key = wheres?.join('\n');
  const [state, setState] = useState<OrdersState>({
    orders: [],
    loading: Boolean(key),
  });

  useEffect(() => {
    if (!key) {
      setState({ orders: [], loading: false });
      return undefined;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    reader.read(key.split('\n')).then(
      (orders) => active && setState({ orders, loading: false }),
      (e: unknown) =>
        active &&
        setState({ orders: [], loading: false, error: requestError(e) })
    );
    return () => {
      active = false;
    };
  }, [reader, key]);

  return state;
}
