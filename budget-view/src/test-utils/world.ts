// A small fictional project behind the Merchant Center proxy for component tests: units, records, roles,
// customers, orders, project resources and Approval Rules. Writes are recorded and applied. [BCC-VIEW-8]
import { graphql, rest } from 'msw';
import type { SetupServer } from 'msw/node';
import { API } from './platform-mock';

type Rec = { key: string; version: number; value: unknown };
type Rule = Record<string, unknown> & { id: string };

export type World = {
  units: Array<Record<string, unknown> & { id: string; key: string }>;
  records?: Record<string, Rec[]>;
  roles?: Array<{ key: string; name?: string; permissions: string[] }>;
  customers?: Array<{
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }>;
  orders?: unknown[];
  carts?: unknown[];
  shoppingLists?: unknown[];
  quoteRequests?: unknown[];
  quotes?: unknown[];
  rules?: Rule[];
  // Keys whose next write answers 409.
  conflictOn?: string[];
};

// Narrows the order fixtures by the customer IDs of a `customerId in (...)` predicate, so chunked reads can be told
// apart; other predicates return every order and core filters them, as on the platform.
const orderFilter = (o: Record<string, unknown>, where: unknown): boolean => {
  const m = /customerId in \(([^)]*)\)/.exec(String(where));
  if (!m) return true;
  return m[1]!
    .split(',')
    .map((x) => JSON.parse(x.trim()) as string)
    .includes(o.customerId as string);
};

export type Calls = {
  writes: Array<{
    container: string;
    key: string;
    value: unknown;
    version?: number;
  }>;
  ruleCreates: Array<{
    associateId: string;
    unitKey: string;
    body: Record<string, unknown>;
  }>;
  ruleReads: Array<{ associateId: string; unitKey: string }>;
  // The `where` of each GraphQL order read.
  orderWhere: string[];
  // Paths of every GET, to count reads.
  reads: string[];
};

// REST order fixtures as the GraphQL projection returns them.
const projection = (o: Record<string, unknown>) => {
  const custom = o.custom as { fields: Record<string, unknown> } | undefined;
  const money = (m: unknown) => {
    const x = m as { currencyCode: string; centAmount: number };
    return { currencyCode: x.currencyCode, centAmount: x.centAmount };
  };
  const taxed = o.taxedPrice as { totalNet: unknown } | undefined;
  return {
    id: o.id,
    createdAt: o.createdAt,
    orderState: o.orderState,
    customerId: o.customerId ?? null,
    businessUnit: o.businessUnit
      ? { key: (o.businessUnit as { key: string }).key }
      : null,
    totalPrice: money(o.totalPrice),
    taxedPrice: taxed ? { totalNet: money(taxed.totalNet) } : null,
    custom: custom
      ? {
          customFieldsRaw: Object.entries(custom.fields).map(
            ([name, value]) => ({ name, value })
          ),
        }
      : null,
  };
};

const page = (results: unknown[]) => ({ results });

export function mockWorld(server: SetupServer, world: World): Calls {
  const calls: Calls = {
    writes: [],
    ruleCreates: [],
    ruleReads: [],
    orderWhere: [],
    reads: [],
  };
  const records = world.records ?? {};
  const conflicts = new Set(world.conflictOn ?? []);
  const rules = world.rules ?? [];
  const list = (path: string, items: unknown[] | undefined) =>
    rest.get(`${API}/${path}`, (_req, res, ctx) =>
      res(ctx.json(page(items ?? [])))
    );

  server.use(
    rest.get(`${API}/*`, (req) => {
      calls.reads.push(req.url.pathname.replace(/^.*\/proxy\/ctp\/[^/]+/, ''));
      return undefined;
    }),
    rest.get(`${API}/business-units`, (req, res, ctx) => {
      const where = req.url.searchParams.getAll('where').join(' and ');
      const parent = /parentUnit\(key\s*=\s*"([^"]+)"\)/.exec(where)?.[1];
      return res(
        ctx.json(
          page(
            world.units.filter(
              (u) =>
                parent !== undefined &&
                (u.parentUnit as { key?: string } | undefined)?.key === parent
            )
          )
        )
      );
    }),
    rest.get(`${API}/business-units/key=:key`, (req, res, ctx) => {
      const u = world.units.find((x) => x.key === req.params.key);
      return u
        ? res(ctx.json(u))
        : res(
            ctx.status(404),
            ctx.json({ statusCode: 404, message: 'Not found' })
          );
    }),
    rest.get(`${API}/business-units/:id`, (req, res, ctx) => {
      const u = world.units.find((x) => x.id === req.params.id);
      return u
        ? res(ctx.json(u))
        : res(
            ctx.status(404),
            ctx.json({ statusCode: 404, message: 'Not found' })
          );
    }),
    rest.get(`${API}/custom-objects/:container/:key`, (req, res, ctx) => {
      const r = (records[req.params.container as string] ?? []).find(
        (x) => x.key === req.params.key
      );
      return r
        ? res(ctx.json({ id: r.key, container: req.params.container, ...r }))
        : res(
            ctx.status(404),
            ctx.json({ statusCode: 404, message: 'Not found' })
          );
    }),
    rest.get(`${API}/custom-objects/:container`, (req, res, ctx) =>
      res(
        ctx.json(
          page(
            (records[req.params.container as string] ?? []).map((r) => ({
              id: r.key,
              container: req.params.container,
              ...r,
            }))
          )
        )
      )
    ),
    rest.post(`${API}/custom-objects`, async (req, res, ctx) => {
      const body = (await req.json()) as Calls['writes'][number];
      calls.writes.push(body);
      if (conflicts.delete(body.key))
        return res(
          ctx.status(409),
          ctx.json({
            statusCode: 409,
            message: 'Object has a different version than expected.',
            errors: [{ code: 'ConcurrentModification', message: 'Conflict.' }],
          })
        );
      const list = (records[body.container] ??= []);
      const existing = list.find((r) => r.key === body.key);
      const version = (existing?.version ?? 0) + 1;
      if (existing) Object.assign(existing, { value: body.value, version });
      else list.push({ key: body.key, value: body.value, version });
      return res(ctx.json({ id: body.key, ...body, version }));
    }),
    list(
      'associate-roles',
      world.roles?.map((r, i) => ({ id: `role-${i}`, ...r }))
    ),
    list('customers', world.customers),
    graphql.query('BccViewOrders', (req, res, ctx) => {
      calls.orderWhere.push((req.variables as { where: string }).where);
      return res(
        ctx.data({
          orders: {
            results: ((world.orders ?? []) as Array<Record<string, unknown>>)
              .filter(
                (o) => !orderFilter || orderFilter(o, req.variables.where)
              )
              .map(projection),
          },
        })
      );
    }),
    // Project overview lists orders over REST; consumption reads them over GraphQL.
    list('orders', world.orders),
    list('carts', world.carts),
    list('shopping-lists', world.shoppingLists),
    list('quote-requests', world.quoteRequests),
    list('quotes', world.quotes),
    rest.get(
      `${API}/as-associate/:associateId/in-business-unit/key=:unitKey/approval-rules`,
      (req, res, ctx) => {
        calls.ruleReads.push({
          associateId: req.params.associateId as string,
          unitKey: req.params.unitKey as string,
        });
        return res(ctx.json(page(rules)));
      }
    ),
    rest.post(
      `${API}/as-associate/:associateId/in-business-unit/key=:unitKey/approval-rules`,
      async (req, res, ctx) => {
        const body = (await req.json()) as Record<string, unknown>;
        calls.ruleCreates.push({
          associateId: req.params.associateId as string,
          unitKey: req.params.unitKey as string,
          body,
        });
        const created = {
          id: `rule-${rules.length + 1}`,
          version: 1,
          // The real time of the create, as the platform sets it.
          lastModifiedAt: new Date().toISOString(),
          ...body,
        };
        rules.push(created);
        return res(ctx.status(201), ctx.json(created));
      }
    )
  );
  return calls;
}

// Unit A with division A1 and three associates of fictional customers.
export const UNIT_A = {
  id: 'u-a',
  key: 'unit-a',
  name: 'Unit A (fictional)',
  unitType: 'Company',
  approvalRuleMode: 'Explicit',
  associates: [
    {
      customer: { typeId: 'customer', id: 'c-1' },
      associateRoleAssignments: [
        {
          associateRole: { typeId: 'associate-role', key: 'buyer' },
          inheritance: 'Enabled',
        },
      ],
    },
    {
      customer: { typeId: 'customer', id: 'c-2' },
      associateRoleAssignments: [
        {
          associateRole: { typeId: 'associate-role', key: 'site-buyer' },
          inheritance: 'Enabled',
        },
      ],
    },
    {
      customer: { typeId: 'customer', id: 'c-3' },
      associateRoleAssignments: [
        {
          associateRole: { typeId: 'associate-role', key: 'admin' },
          inheritance: 'Enabled',
        },
        {
          associateRole: { typeId: 'associate-role', key: 'approver' },
          inheritance: 'Enabled',
        },
      ],
    },
  ],
};

export const DIVISION_A1 = {
  id: 'u-a1',
  key: 'division-a1',
  name: 'Division A1 (fictional)',
  unitType: 'Division',
  parentUnit: { typeId: 'business-unit', key: 'unit-a' },
  approvalRuleMode: 'Explicit',
  associates: [],
};

export const ROLES = [
  {
    key: 'admin',
    name: 'Admin',
    permissions: ['CreateApprovalRules', 'UpdateApprovalRules'],
  },
  { key: 'approver', name: 'Approver', permissions: ['UpdateApprovalFlows'] },
  {
    key: 'buyer',
    name: 'Buyer',
    permissions: ['CreateMyCarts', 'CreateMyOrdersFromMyCarts'],
  },
  {
    key: 'site-buyer',
    name: 'Site buyer',
    permissions: ['CreateOrdersFromOthersCarts'],
  },
];

export const CUSTOMERS = [
  { id: 'c-1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lane' },
  { id: 'c-2', email: 'bo@example.com', firstName: 'Bo', lastName: 'Reed' },
  { id: 'c-3', email: 'cy@example.com', firstName: 'Cy', lastName: 'Moss' },
];

export const unitSummary = (u: typeof UNIT_A | typeof DIVISION_A1) => ({
  id: u.id,
  key: u.key,
  name: u.name,
  unitType: u.unitType,
  ...('parentUnit' in u ? { parentKey: u.parentUnit.key } : {}),
  approvalRuleMode: u.approvalRuleMode as 'Explicit',
});

export const VIEW_ONLY = [
  { name: 'canView', value: true },
  { name: 'canManage', value: false },
];
export const MANAGER = [
  { name: 'canView', value: true },
  { name: 'canManage', value: true },
];
