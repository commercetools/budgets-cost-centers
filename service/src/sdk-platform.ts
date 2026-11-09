// ServicePlatform on the commercetools SDK. [BCC-SPEND-1] [BCC-CART-4] [BCC-QUOTE-1] [BCC-QUOTE-2]
import type { AssociateRoleAssignment, BusinessUnit, InheritedAssociateRoleAssignment } from '@commercetools/platform-sdk';
import { CONTAINERS, type OrderLike } from 'budgets-cost-centers-core';
import type { ApiRoot } from 'budgets-cost-centers-shared';
import type { AssociateLike, BusinessUnitLike, CartLike, ServicePlatform, StoredRecord } from './platform';

const PAGE = 500;
const q = (v: string) => JSON.stringify(v);

const statusOf = (e: unknown): number | undefined => {
  const x = e as { statusCode?: number; status?: number; body?: { statusCode?: number } };
  return x?.statusCode ?? x?.status ?? x?.body?.statusCode;
};

// 404 means "absent"; anything else is a real failure the caller must see.
export async function orUndefined<T>(call: () => Promise<{ body: T }>): Promise<T | undefined> {
  try {
    return (await call()).body;
  } catch (e) {
    if (statusOf(e) === 404) return undefined;
    throw e;
  }
}

// Pages by id instead of offset, so large result sets stay cheap.
async function pageAll<T extends { id: string }>(fetchPage: (where: string[]) => Promise<T[]>, where: string): Promise<T[]> {
  const all: T[] = [];
  for (let last: string | undefined; ; ) {
    const page = await fetchPage(last ? [where, `id > ${q(last)}`] : [where]);
    all.push(...page);
    if (page.length < PAGE) return all;
    last = page[page.length - 1]?.id;
  }
}

const toAssociates = (list: Array<{ customer: { id: string }; associateRoleAssignments: Array<AssociateRoleAssignment | InheritedAssociateRoleAssignment> }> | undefined): AssociateLike[] =>
  (list ?? []).map((a) => ({
    customer: { id: a.customer.id },
    associateRoleAssignments: a.associateRoleAssignments.map((r) => ({ associateRole: { key: r.associateRole.key } })),
  }));

// The SDK type is an open string union; only the two documented values are kept.
const ruleModeOf = (m: string | undefined): BusinessUnitLike['approvalRuleMode'] =>
  m === 'Explicit' || m === 'ExplicitAndFromParent' ? m : undefined;

const toUnit = (bu: BusinessUnit): BusinessUnitLike => ({
  key: bu.key,
  ...('parentUnit' in bu && bu.parentUnit ? { parentUnit: { key: bu.parentUnit.key } } : {}),
  ...(ruleModeOf(bu.approvalRuleMode) ? { approvalRuleMode: ruleModeOf(bu.approvalRuleMode) } : {}),
  associates: toAssociates(bu.associates),
  ...(bu.inheritedAssociates ? { inheritedAssociates: toAssociates(bu.inheritedAssociates) } : {}),
});

// Consumption needs a handful of fields per order; full orders with line items would not fit the time budget at
// realistic volumes. Validated against the GraphQL schema with the commercetools Knowledge MCP. [BCC-CART-10]
const ORDERS_QUERY = `query BccOrders($where: String, $sort: [String!], $limit: Int) {
  orders(where: $where, sort: $sort, limit: $limit) {
    results {
      id
      createdAt
      orderState
      customerId
      businessUnit { key }
      totalPrice { currencyCode centAmount }
      taxedPrice { totalNet { currencyCode centAmount } }
      custom { customFieldsRaw(includeNames: ["bccCostObject", "bccApprovalStatus"]) { name value } }
    }
  }
}`;

type OrderProjection = {
  id: string;
  createdAt: string;
  orderState: string;
  customerId?: string | null;
  businessUnit?: { key: string } | null;
  totalPrice: { currencyCode: string; centAmount: number };
  taxedPrice?: { totalNet: { currencyCode: string; centAmount: number } } | null;
  custom?: { customFieldsRaw: Array<{ name: string; value: unknown }> } | null;
};

const toOrder = (o: OrderProjection): OrderLike => ({
  id: o.id,
  createdAt: o.createdAt,
  orderState: o.orderState,
  totalPrice: { currencyCode: o.totalPrice.currencyCode, centAmount: o.totalPrice.centAmount },
  ...(o.customerId ? { customerId: o.customerId } : {}),
  ...(o.businessUnit ? { businessUnit: { key: o.businessUnit.key } } : {}),
  ...(o.taxedPrice ? { taxedPrice: { totalNet: { currencyCode: o.taxedPrice.totalNet.currencyCode, centAmount: o.taxedPrice.totalNet.centAmount } } } : {}),
  ...(o.custom ? { custom: { fields: Object.fromEntries(o.custom.customFieldsRaw.map((f) => [f.name, f.value])) } } : {}),
});

async function queryOrderProjections(apiRoot: ApiRoot, where: string): Promise<OrderLike[]> {
  const page = async (w: string[]): Promise<OrderLike[]> => {
    const variables = { where: w.length > 1 ? w.map((x, i) => (i === 0 ? `(${x})` : x)).join(' and ') : w[0], sort: ['id asc'], limit: PAGE };
    const { body } = await apiRoot.graphql().post({ body: { query: ORDERS_QUERY, variables } }).execute();
    const result = body as { data?: { orders?: { results: OrderProjection[] } }; errors?: Array<{ message: string }> };
    if (result.errors?.length || !result.data?.orders) {
      throw new Error(`GraphQL order query failed: ${result.errors?.map((e) => e.message).join('; ') ?? 'no data'}`);
    }
    return result.data.orders.results.map(toOrder);
  };
  return pageAll(page, where);
}

export function sdkPlatform(apiRoot: ApiRoot): ServicePlatform {
  // Query CustomObjects in Container; the project-wide query is deprecated.
  // https://docs.commercetools.com/api/projects/custom-objects
  const customObjects = async (container: string, where: string): Promise<StoredRecord[]> => {
    const results = await pageAll(
      async (w) =>
        (
          await apiRoot
            .customObjects()
            .withContainer({ container })
            .get({ queryArgs: { where: w, limit: PAGE, sort: 'id asc', withTotal: false } })
            .execute()
        ).body.results,
      where,
    );
    return results.map((r) => ({ key: r.key, value: r.value }));
  };
  return {
    getBusinessUnit: async (key) => {
      const bu = await orUndefined(() => apiRoot.businessUnits().withKey({ key }).get().execute());
      return bu && toUnit(bu);
    },
    getCustomObjects: (container, keys) =>
      keys.length ? customObjects(container, `key in (${keys.map(q).join(', ')})`) : Promise.resolve([]),
    queryBudgets: (ownerKeys) =>
      customObjects(CONTAINERS.budgets, `value(ownerBusinessUnitKey in (${ownerKeys.map(q).join(', ')}))`),
    queryOrders: (where) => queryOrderProjections(apiRoot, where),
    getCart: (id) => orUndefined(() => apiRoot.carts().withId({ ID: id }).get().execute()) as Promise<CartLike | undefined>,
    getQuote: (id) => orUndefined(() => apiRoot.quotes().withId({ ID: id }).get().execute()),
    typeIdByKey: async (key) => (await orUndefined(() => apiRoot.types().withKey({ key }).get().execute()))?.id,
  };
}
