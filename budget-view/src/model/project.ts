// Project overview: shopping lists, active carts, quote requests, quotes and orders carrying the project key, the
// project's budgets, and the project fields. [BCC-PROJ-1] [BCC-PROJ-2] [BCC-PROJ-4] [BCC-VIEW-6] [BCC-SPEND-2]
import {
  amountOf,
  type Budget,
  type CostObject,
  type Money,
  type ProjectStatus,
} from '../core';

export type ProjectResource =
  | 'shopping-list'
  | 'cart'
  | 'quote-request'
  | 'quote'
  | 'order';

const q = (v: string) => JSON.stringify(v);

// Only active carts are phases; ordered carts appear as their orders.
export const projectWhere = (key: string, resource: ProjectResource): string =>
  `custom(fields(bccCostObject=${q(key)}))${
    resource === 'cart' ? ' and cartState="Active"' : ''
  }`;

type Priced = {
  id: string;
  key?: string;
  totalPrice: Money;
  taxedPrice?: { totalNet: Money };
  lineItems?: unknown[];
};

export type ProjectSources = {
  shoppingLists: Array<{
    id: string;
    key?: string;
    name?: Record<string, string>;
    lineItems?: unknown[];
  }>;
  carts: Priced[];
  quoteRequests: Array<Priced & { quoteRequestState?: string }>;
  quotes: Array<Priced & { quoteState?: string }>;
  orders: Array<Priced & { orderNumber?: string; orderState?: string }>;
};

export type ProjectItem = {
  kind: ProjectResource;
  id: string;
  label: string;
  state?: string;
  lineItemCount: number;
  // Net, like consumption [BCC-SPEND-2]. Shopping lists have no price.
  total?: Money;
};

const byLabel = (a: ProjectItem, b: ProjectItem) =>
  a.label.localeCompare(b.label, 'en');

const priced = (
  kind: ProjectResource,
  x: Priced,
  label: string,
  state?: string
): ProjectItem => ({
  kind,
  id: x.id,
  label,
  ...(state ? { state } : {}),
  lineItemCount: x.lineItems?.length ?? 0,
  total: amountOf(x),
});

export function projectItems(s: ProjectSources): ProjectItem[] {
  const name = (n?: Record<string, string>) =>
    n ? n.en ?? Object.values(n)[0] : undefined;
  return [
    ...s.shoppingLists
      .map(
        (l): ProjectItem => ({
          kind: 'shopping-list',
          id: l.id,
          label: name(l.name) ?? l.key ?? l.id,
          lineItemCount: l.lineItems?.length ?? 0,
        })
      )
      .sort(byLabel),
    ...s.carts.map((c) => priced('cart', c, c.key ?? c.id)).sort(byLabel),
    ...s.quoteRequests
      .map((r) =>
        priced('quote-request', r, r.key ?? r.id, r.quoteRequestState)
      )
      .sort(byLabel),
    ...s.quotes
      .map((r) => priced('quote', r, r.key ?? r.id, r.quoteState))
      .sort(byLabel),
    ...s.orders
      .map((o) => priced('order', o, o.orderNumber ?? o.id, o.orderState))
      .sort(byLabel),
  ];
}

export const projectBudgets = <R extends { key: string; value: Budget }>(
  costObjectKey: string,
  budgets: R[]
): R[] =>
  budgets.filter(
    (b) =>
      b.value.active &&
      b.value.scope.kind === 'cost-object' &&
      b.value.scope.ref === costObjectKey
  );

export type ProjectFields = {
  status: ProjectStatus;
  siteAddress: string;
  erpProjectNumber: string;
};

export const projectFieldsOf = (co: CostObject): ProjectFields => ({
  status: co.project?.status ?? 'planned',
  siteAddress: co.project?.siteAddress ?? '',
  erpProjectNumber: co.project?.erpProjectNumber ?? '',
});

export function applyProjectFields(
  co: CostObject,
  f: ProjectFields
): CostObject {
  const site = f.siteAddress.trim();
  const erp = f.erpProjectNumber.trim();
  return {
    ...co,
    project: {
      status: f.status,
      ...(site ? { siteAddress: site } : {}),
      ...(erp ? { erpProjectNumber: erp } : {}),
    },
  };
}
