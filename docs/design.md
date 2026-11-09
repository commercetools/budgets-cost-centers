# Budgets, Cost Centers & Projects for commercetools: design

Status: Stage 0 built and deployed on a Connect preview (2026-11-01), for a commercetools Labs project. All names, codes and amounts in examples are invented.

## 1. Intent

B2B buyers delegate purchasing to many people and control the spend with **cost objects** (cost centers,
projects, sites), **budgets** per cost object and period, and **spend limits** per role. commercetools models the
buyer organisation (Business Unit hierarchy), roles (Associate Roles) and approvals (Approval Rules and Flows)
natively, but has no budget, no cost center and no project object. Its own learning content names "budget management
and credit-limit enforcement" as something that crosses an integration boundary
([How B2B extends B2C](https://docs.commercetools.com/learning-model-b2b-commerce/model-buyer-organizations/b2b-commerce-what-changes#the-architects-decision-framework)),
and recommends a Custom Field such as "a cost-center reference on a Line Item"
([The B2B Cart](https://docs.commercetools.com/learning-model-b2b-commerce/implement-b2b-purchase-flows/the-b2b-cart#modeling-b2b-specific-data)).

The gap is specific. An Approval Rule predicate is an Order Predicate: it sees one order, never a sum over time
([Why procurement governance matters](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/why-procurement-governance-matters)).
So neither "project budget for Q4" nor "a buyer may spend 2,000 EUR per month" can be expressed natively.

This package closes that gap the platform-native way: cost objects, budgets and limits live in the project, a service
keeps every cart stamped with its budget status, and a **native Approval Rule** with the predicate
`custom.bccBudgetExceeded = true` routes over-budget orders into the platform's own approval flow. There is no second
workflow engine.

It must work with **any frontend** (enforcement is server-side, inside commercetools API calls), be installable with
Connect plus a one-time Custom View registration, and later be useful to an AI agent (MCP).

## 2. Goals, non-goals, anti-goals

**Goals (v1)**
- Cost-object master per Business Unit, inherited down the hierarchy, with types `cost-center`, `project`, `site`.
- Projects as a business object: status, validity, site address, ERP project number, and an overview that bundles the
  project's shopping lists, carts, quotes and orders with spend against budget (§5.5).
- Budget per cost object or per Business Unit and period, with a mode `approval` (default), `warn` or `block`; the
  mode can be overridden per Associate Role.
- Spend limit per Associate Role (optionally per associate) and period, independent of cost objects.
- Consumption computed from orders: an order counts from creation, pending approval included; cancelled orders and
  orders with a rejected approval do not count.
- Cart, order, shopping list and quote carry the cost object (order level) and the cart and order carry a budget
  snapshot.
- Merchant Center: maintain cost objects, budgets and limits on a Business Unit, see consumption, set up or check the
  Approval Rule, export spend as CSV.
- Reference seed for a sandbox project, with invented data.

**Later, in the same package**
- Project prices (a price Channel per project), bill-of-quantities import into a project list.
- Cost object per line item (the field is reserved in v1, §4.2).
- Ledger with event-based consumption, budget report across units, MCP read tools, storefront kit.

**Non-goals**
- Credit limit and payment terms. That is seller-side account finance.
- Approval engine. Native Approval Rules do this.
- Returns, refunds and credit notes. After order capture an OMS or ERP typically owns cancellations and returns
  ([Plan integrations](https://docs.commercetools.com/guides/implementation-guide/plan-integrations#order)); the README
  states this limit.
- Splitting one line across several cost objects.
- Free-text job references without a master record (a "commission" typed by the installer). That is a reference field:
  use the native `purchaseOrderNumber` or a storefront field. If such a reference needs a budget, validity or a block,
  create it as a cost object of type `site` or `project` with the reference as `externalId`.
- Punchout (cXML/OCI) and ERP as master of budgets. Later.

**Anti-goals: it fails if**
- it only works in one demo storefront;
- it breaks a project that already has its own cart, order or Business Unit Custom Type (§4.2);
- a cart update gets noticeably slower (§5.1);
- it invents approval logic next to the platform's;
- a buyer can get around a budget because no Approval Rule covers their role (§5.3).

## 3. Package layout (Connect, like the existing Labs projects)

One repository, one `connect.yaml`, applications named after their folders:

| Folder | Connect type | Stage | Purpose |
| --- | --- | --- | --- |
| `core` | none (library) | 0 | Pure domain logic: scopes, periods, inheritance, status, consumption, validation of Custom Object values |
| `budget-view` | `merchant-center-custom-view` | 0 | Custom View on the Business Unit detail page |
| `service` | `service` | 0 | API Extension endpoint: cart Create/Update (snapshot), order Create (guard; cost-object reference for orders from quotes), quote request Create (cost-object reference) |
| `ledger` | `event` | 0 | Stage 0: approval status on the order from Approval Flow messages (§5.3). Later: event-based consumption, order-Create recheck support |
| `budget-report` | `merchant-center-custom-application` | later | Cross-unit report and export |
| `mcp` | `service` | later | MCP server with read tools |
| `storefront-kit` | none (library) | later | Headless helpers and React snippets |

`postDeploy` creates or extends the Custom Types (§4.2), registers the Extension (`service`) and the Subscription
(`ledger`); `preUndeploy` removes the Extension and the Subscription and leaves data and types in place. Each app brings
its own API Client with least-privilege scopes in its `securedConfiguration`; `inheritAs.apiClient` is not used,
because it creates one client for the whole Connector ([Automatically generate API Client
credentials](https://docs.commercetools.com/connect/modify-connector)). `core` and `shared` are Connect common modules:
`service` and `ledger` install them as `file:` dependencies with `--include=dev` and build them first
([Share code across Connect applications](https://docs.commercetools.com/connect/common-modules)). The Custom View
must build from its own folder (verified 2026-10-30: a `file:../core` dependency fails the Connect build step, a
self-contained view passes), so it carries a generated copy of `core/src` in `budget-view/src/core`, kept identical by
`tools/sync-view-core.mjs` and checked by `tools/connect-build-check.mjs`. Connect builds the view with the default
classic JSX runtime, using neither the environment of its `build` script nor its `connect.yaml` values for the build
(verified 2026-11-01), so every JSX file imports `React` and tests compile JSX the same way. Repository conventions as in the existing Labs projects: README with
the "commercetools-labs reference code, MIT, not supported" banner, `SUPPORT.md`, `LICENSE`, `FEATURES.md` with file
pointers, specs per feature. The package only uses generally available platform features.

## 4. Data model

Rule: **native first; own entities as Custom Objects; Custom Fields only on transactions**, and there only the
reference and the snapshot. A transaction needs the values on itself because Approval Rule predicates see only the
order, the platform copies cart fields to the order, and carts and orders are queried by their own fields. Data that
stands on its own and is referenced from elsewhere is a Custom Object, as the B2B learning content recommends. A
resource holds only one Custom Type and Business Units in customer projects often have one already, so this package
stores nothing on Business Units.

### 4.1 Own entities: Custom Objects

One Custom Object per record, so documents stay small and parallel edits do not collide. Values have no platform
schema; `core/` validates every value on read and write. Keys are immutable; records are deactivated, never deleted.
Cost-object keys are `<ownerBusinessUnitKey>~<code>`: codes are unique per owner unit, because codes come from the
buyers' own systems and two companies may both use `CC-100`; carts and orders store the full key (`cost-objects`
spec).

**`bcc-cost-objects`**, one per cost object:
`{ code, name, type: 'cost-center' | 'project' | 'site', ownerBusinessUnitKey, active, validFrom?, validTo?,
externalId?, buyers?: customerId[] (empty = all associates of the unit), linkedBusinessUnitKey?,
project?: { status: 'planned' | 'active' | 'closed', siteAddress?, erpProjectNumber? } }`

**`bcc-budgets`**, one per budget or limit:
`{ scope: { kind: 'cost-object' | 'business-unit' | 'role' | 'associate', ref }, ownerBusinessUnitKey,
amount: Money, period: { kind: 'month' | 'quarter' | 'year' | 'range', from, to }, mode: 'approval' | 'warn' | 'block',
modeByRole?: { [associateRoleKey]: mode }, warnAtPercent: 80, active }`

A `role` scope is a spend limit per person for every associate holding that role in the unit; an `associate` scope
replaces the role limits for one person. Budgets are never inherited implicitly: a parent budget is its own scope.
Periods `month`, `quarter` and `year` repeat as calendar periods between `from` and `to`, which must lie on period
boundaries; `range` applies once. Period
boundaries are UTC in v1. Several role overrides of the mode: the strictest wins.

**`bcc-settings`**, one per Business Unit:
`{ defaultMode, costObjectRequired: boolean, defaultCostObject?, costObjectLevel: 'order' | 'line',
features: { projects: boolean }, approval: { ruleKey?, requesterRoles: string[], checkedAt? } }`. `costObjectLevel`
is `order` in v1. A unit without settings uses those of its nearest ancestor, else the defaults. `approval` is the
coverage record the view writes after checking or setting up the rule; the service reads it instead of Approval Rules.

Inheritance: a division sees its own cost objects plus those of its ancestors (walk `parentUnit`); inactive ones
are listed read-only and cannot be ordered against. A division's own settings record is written in full from its
effective settings, except the approval coverage, which belongs to the division's own rule check. A cost
object linked to a division (`linkedBusinessUnitKey`) is offered only there.

A project can be modelled two ways, with the same budget logic: as a cost-object record only (lightweight, any number),
or linked to a division when it needs its own associates, prices or assortment. Divisions are limited to 4000 per
top-level unit and 5 levels ([Limits](https://docs.commercetools.com/api/limits)), so a division per construction site
does not scale for an installer with many sites; the plain record does.

### 4.2 References and snapshot: composable Custom Types

A cart, an order, a line item, a shopping list and a quote each hold **one** Custom Type, and a customer project often
has one already. The type keys are configuration; if a type exists, `postDeploy` adds this package's fields as optional
fields, otherwise it creates the type. All field names carry the prefix `bcc`.

- Cart and order (resourceTypeId `order`): `bccCostObject` (String, the cost-object key), `bccBudgetStatus` (Enum
  `ok`, `warn`, `exceeded`, `blocked`, `none`), `bccBudgetExceeded` (Boolean, the Approval Rule predicate field),
  `bccBudgetScopes` (String, compact JSON of the scopes checked with amount, used and remaining), `bccCheckedAt`,
  `bccApprovalStatus` (Enum `pending`, `approved`, `rejected`; set on the order only, by `ledger`, §5.3).
- Line item (resourceTypeId `line-item`, also used by shopping-list line items): `bccCostObject`, reserved, ignored
  while `costObjectLevel` is `order`.
- Shopping list and quote (resourceTypeId `quote`, shared by quote request, staged quote and quote):
  `bccCostObject`.

The cost object is referenced by key, not by a Reference field: the key is readable in predicates
(`custom.bccCostObject = "PRJ-1001"`), passes through ERP and installer software, and is easy to query.

Inheritance across resources (verified in the Type resource reference): cart fields are copied to the order; quote
request fields are copied to the staged quote and the quote. A quote request does **not** inherit the cart's fields
([Quote Requests](https://docs.commercetools.com/api/projects/quote-requests)), so the cost object must be set when the
quote request is created. Whether an order created from a quote gets the quote's fields is not documented (§12 item 7); the service copies the
cost object.

## 5. Behaviour

### 5.1 Cart: keep the snapshot current (API Extension, cart Create/Update)

On every cart create and update with a Business Unit: resolve the cost object (cart value, else the unit's
default), validate it (exists, active, inside its validity, allowed for this buyer, visible to this unit), find the
scopes that apply (cost object, unit, the buyer's roles, the buyer), compute consumption per scope, compute the status
and the effective mode, and return `setCustomField` actions only when a value changed.

- Invalid cost object, closed project or expired validity: return a validation error with a buyer-readable message.
- Budget outcomes never fail a cart update, so the buyer can always remove items; `block` is enforced at order
  creation (§5.2).
- The configured order type cannot be resolved: the cart update fails, because answering without actions would keep a
  stale snapshot that the order guard trusts.
- Consumption cannot be computed (platform error, internal time budget of 1.5 s): the cart is marked `exceeded` with
  scopes `unchecked`, so the order goes to approval instead of passing unchecked or blocking all carts; for a buyer
  no Approval Rule covers it is marked `blocked`.
- Unit requires a cost object and none is set: status `none`; the order is rejected at creation time (§5.2).
- Several scopes apply: each is checked; the strictest outcome wins (`block` over `approval` over `warn`).

Consumption in v1 is computed live: the sum of the unit's orders in the period with the same currency as the budget,
excluding cancelled orders and orders with `bccApprovalStatus = rejected`. Amounts are net: `taxedPrice.totalNet`,
else `totalPrice`. Orders in another currency are not counted and the
view shows a hint.

Performance: the platform waits for the Extension and any failure fails the call. Consumption reads a GraphQL
projection of the orders (a few fields each), and the running service holds a read-only token. Target p95 under 300 ms in Stage 0,
under 100 ms once the ledger cache exists. A trigger condition keeps carts without a Business Unit from calling out
(§12 item 10; accepted by the platform, verified 2026-11-01). Measured on a Connect preview deployment (2026-11-01):
200 cart updates with the Extension, p50 161 ms, p95 233 ms, measured as whole update calls by
`tools/e2e/latency.e2e.mjs` `[BCC-CART-10]`.
v0.1.1 reads the cost object and the unit's budgets in parallel with the unit chain `[BCC-CART-12]`; v0.2 keeps master data
in a 60 s cache in the cart check only `[BCC-CART-13]`. Orders stay live, so consumption is never stale; a rule or settings
change reaches the cart check after at most the cache time, and the order guard does not recompute coverage, so a
role removed from an Approval Rule can still pass for up to that time (documented limit). Measured 2026-11-02 on the preview:
v0.1.1 p50 131 ms, p95 172 ms; v0.2.0 p50 110 ms, p95 137 ms (200 updates each; see `docs/backlog.md`).

### 5.2 Order creation

The order inherits the cart's snapshot. An order-Create guard in the service reads that snapshot and rejects orders
with status `blocked`, `none` or without a snapshot (the cart must be checked again), and orders without a cost object
while the unit's current settings require one. It re-validates the cost object, so a project closed or expired after
the last cart update cannot be ordered against, but it does not recompute consumption. In Stage 0 the
cart snapshot is the only budget check, which leaves a race: two carts
checked against the same remaining budget can both be ordered. The README states this; the order-Create recheck
follows with the ledger.

Quotes: the quote request does not inherit the cart's custom fields, and for the order from a quote it is not
documented (§12 item 7). The service copies
`bccCostObject` from the cart on quote request Create and from the quote on order Create from a quote, so quotes and
their orders appear in the project overview and count as consumption. Budget approval on orders from quotes is not
guaranteed in v1 (the flag would be set on order Create, §12); the README states this.

### 5.3 Approval

- `approval` and exceeded: `bccBudgetExceeded = true`; the native Approval Rule (`custom.bccBudgetExceeded = true`)
  holds the order. Only a rule with exactly this predicate counts as coverage; a rule with further conditions would let
  non-matching over-budget orders through. Routing per approver tier is configured in the rule's approvers.
- `block` and exceeded: status `blocked`; the order-Create guard rejects the order (§5.2).
- `warn` and exceeded: the order goes through with status `warn`.
- Fail-safe: an Approval Rule only applies to the roles in its `requesters`. If the buyer holds no role covered by an
  active rule with the budget predicate, `approval` is treated as `block`. The view warns when roles with order
  permissions are missing from the rule. The coverage record follows rule changes made anywhere: `ledger` receives the
  Approval Rule status, requester and predicate Messages and narrows or clears the coverage of the unit.

Approval status on the order: `ledger` reads every pushed Message back from the Messages API and acts on the stored
Message only, so a forged push changes nothing and oversized Messages are handled in full; this needs Messages
querying enabled in the Project. `ledger` subscribes to `ApprovalFlowCreated` (sets `bccApprovalStatus = pending` on
`approvalFlow.order`) and `ApprovalFlowCompleted` (sets `approved` or `rejected` from `status` on `order`). Both
Messages carry the order, so no associate is needed. A final status is never overwritten by `pending`, so the order
of delivery does not matter. This is a Custom Field, not an order state.

No own order states: they would need their own approval UI, permissions and notifications, which is a second workflow
engine. Systems after the order can still map approval outcomes to order states through Approval Flow messages.

### 5.4 Approval Rule setup

`postDeploy` does not create rules on customer units. The view checks each unit for an active rule with the budget
predicate and the coverage of requester roles, and offers "Set up budget approval". Approval Rules are only available
through the `as-associate` endpoints ([Approval Rules](https://docs.commercetools.com/api/projects/approval-rules)), so
the view creates the rule on behalf of an associate of the unit chosen by the user; only associates holding
`CreateApprovalRules` (and `UpdateApprovalRules` for changes) are offered. This impersonation is stated in the spec and
the README.

### 5.5 Projects

A project is a cost object of type `project` with the business-object fields of §4.1. The project overview lists, per
project, the shopping lists (project material lists), active carts (phases), quote requests and quotes, and orders that
carry its key, plus budget, consumption and remaining amount. Orders on a closed project or outside its validity are
rejected (§5.1).

Edge cases:
- Carts are removed by the cleanup task after `lastModifiedAt + deleteDaysAfterLastModification`
  ([Limits](https://docs.commercetools.com/api/limits)); carts with a project reference get an explicit retention.
  The durable project list is a shopping list.
- An ordered cart is frozen; reordering a phase uses the shopping list or a replicated cart.
- Quote requests need the cost object set at creation (§4.2).

### 5.6 Edge cases (all cost objects)

- Key rename or delete: keys are immutable, the name is editable, records are deactivated.
- A cost object referenced by open carts is deactivated: those carts fail validation on their next update.
- Concurrent edits in the view: optimistic concurrency on the Custom Object version, reload on conflict.
- Customer project already has a cart or order type: fields are added to the configured type (§4.2).
- Recurring orders: the platform creates the recurring cart through the cart Create Extension, so it carries the cost
  object and a snapshot from that moment; generated orders pass the order guard with it and are not re-checked
  (verified 2026-11-01 with "order now"). A blocked snapshot fails the occurrence. Approval Rules evaluate the cart
  customer's roles, also when another associate places the order (verified 2026-11-01). Imported orders are not
  checked, because Order Import does not call Extensions (verified 2026-11-01). The README states all three.

## 6. Merchant Center (`budget-view`)

Custom View on the Business Unit detail page (locator `customers.business_unit_details.general`,
[Custom View config](https://docs.commercetools.com/merchant-center-customizations/tooling-and-configuration/custom-view-config#locators)):
cost objects (add, edit, deactivate, type, buyers, project fields), budgets and role limits per period with mode and
role overrides, consumption bar (ok / warn / exceeded), project overview (§5.5), Approval Rule check and setup (§5.4),
CSV export of spend per cost object in the browser (columns: unit, cost object, type, externalId, period, budget,
consumed, remaining, order count). UI text in English with message files for i18n; Nimbus design system.

Self-service for the buyer admin is the storefront's job; the Merchant Center is the seller's view.

## 7. MCP server (later, read-only)

Tools: `get_budget_status(businessUnitKey, costObject?)`, `list_cost_objects(businessUnitKey)`,
`spend_report(businessUnitKey?, from, to)`, `explain_cart_budget(cartId)`. Example: the shopping agent says "this order
exceeds the Q4 budget of project PRJ-1001 (Riverside Depot) by €240, it will go to your unit's approver". Auth: an API
client limited to reading Custom Objects, carts and orders.

## 8. Storefront kit (later)

Framework-light helpers (`getCostObjects`, `budgetStatusOf(cart)`, `createQuoteRequestWithCostObject`) and React
snippets: cost-object picker, remaining-budget bar in cart and checkout, project overview, buyer-admin page "Budgets &
cost centers".

## 9. Capability coverage

| Capability | v1 | Later |
| --- | --- | --- |
| Cost-object master per unit, inherited, typed | ✔ | ERP import |
| Projects with status, validity, overview of lists, carts, quotes, orders | ✔ | project prices, bill-of-quantities import |
| Buyers allowed per cost object, default per unit | ✔ | default per buyer |
| Cost object on order | ✔ | per line (field reserved) |
| Budget per cost object or unit and period | ✔ | rollover, parent pool |
| Spend limit per role or associate and period | ✔ | |
| Block / warn / approval, overridable per role | ✔ | |
| Native approval on exceed, fail-safe for uncovered roles | ✔ | |
| Consumption from orders, cancelled and rejected excluded | ✔ | ledger, returns from OMS/ERP |
| Spend CSV per unit | ✔ | cross-unit report, scheduled export |
| Approver notifications | | via a Subscription on Approval Flow messages |
| Threshold notifications | | ✔ |
| Budget per assortment (category) per period | | ✔ (scope filter) |
| Punchout with cost object | | ✔ |
| MCP read tools | | ✔ |

## 10. Testing

- `core/`: scope resolution, inheritance, period math, status and mode resolution, consumption filter, value
  validation. Unit tests, no network, written first.
- `service`: contract tests with recorded Extension payloads (cart create and update), latency test.
- `budget-view`: component tests; the real click path with Playwright against `mc-scripts start`; e2e tests.
- End to end against a sandbox project with the seed: two units, a division, cost objects of all three types (one
  project with phase carts and a list), budgets in all three modes, a role limit, an Approval Rule; then buyer flows
  per mode through the API and the view with Playwright.

## 11. Seed

`seed/` creates invented data, labelled as fictional, idempotent by key, optional. It is the base of the e2e
tests and lets a reader try the view without their own data.

## 12. Checks

Answered:
1. Custom View on the Business Unit page: yes, locators `customers.business_unit_details.general` and `.orders`
   ([Custom View config](https://docs.commercetools.com/merchant-center-customizations/tooling-and-configuration/custom-view-config#locators)).
2. Approval Rules: only through `as-associate` endpoints; scopes `manage_approval_rules`, `view_approval_rules`
   ([Approval Rules](https://docs.commercetools.com/api/projects/approval-rules),
   [Predicates and requesters](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-rules-predicates-and-requesters)).
3. The platform sends no approval notifications
   ([Approval Flows in action](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-flows-in-action)).
4. Cart fields are copied to the order; quote request fields to staged quote and quote; cart fields are not copied to
   the quote request (Type resource reference; [Quote Requests](https://docs.commercetools.com/api/projects/quote-requests)).
5. Custom Fields can reference `key-value-document`, `business-unit`, `associate-role` (Type resource reference).
6. Divisions: at most 4000 per top-level unit, 5 levels; documents ideally under 100 KB, at most 2 MB
   ([Limits](https://docs.commercetools.com/api/limits)).

7. Orders from quotes: `OrderFromQuoteDraft` has no `custom` field and no copy from the quote is documented. Cart to
   quote request is not copied either. Extensions support `quote-request` and run on every create call, so the service
   sets `bccCostObject` on quote request Create (from the cart) and on order Create from a quote (from the quote)
   ([API Extensions](https://docs.commercetools.com/api/projects/api-extensions); Type and draft references).
8. Recurring orders: order-Create Extensions run for every generated order; copying the original cart's custom fields
   to the recurring cart is not documented, but the recurring cart is created through the cart Create Extension and
   carries the fields (verified 2026-11-01)
   ([Recurring Orders](https://docs.commercetools.com/api/recurring-orders-overview)). Rejecting at order Create can
   trigger refunds with Checkout payments, so validation stays on the cart. Treated as a stated limit in v1.
9. Order Import and the Import API: not documented whether Extensions run; an Order Import with a Business Unit and no
   snapshot was created without a call (verified 2026-11-01). Stated limit.
10. Trigger condition: Query Predicate syntax, `businessUnit is defined` skips carts without a unit; `has changed`
    narrows updates; filtering by update action is not possible
    ([Query predicates](https://docs.commercetools.com/api/predicates/query)).
11. Approval: `custom.<name>` is a valid Order Predicate identifier. An Approval Rule applies only to orders created by
    an associate holding a requester role. A rejected flow sets `ApprovalFlow.status = Rejected` and emits
    `ApprovalFlowRejected`; the order gets no approval field and `orderState` does not change
    ([Approval Flows](https://docs.commercetools.com/api/projects/approval-flows)). Not documented: whether the rule
    sees values set by an order-Create Extension; so the flag is set on the cart.
12. Managing Approval Rules needs an associate of the unit with `CreateApprovalRules` / `UpdateApprovalRules` and the
    scope `manage_approval_rules`; there is no project-level endpoint
    ([Associates overview](https://docs.commercetools.com/api/associates-overview)).
13. Custom Objects: container and key match `^[-_~.a-zA-Z0-9]+$`, key length 1 to 256, value up to the 16 MB document
    limit, 100 KB recommended ([Custom Objects](https://docs.commercetools.com/api/projects/custom-objects),
    [Limits](https://docs.commercetools.com/api/limits)). Cost-object codes are restricted to the same characters.
14. Retention: `deleteDaysAfterLastModification` 1 to 365250 for carts (project default 90) and shopping lists
    (default 360) ([General concepts](https://docs.commercetools.com/api/general-concepts)).
15. GA: no beta label on any feature used (Business Units, Associate Roles, Approval Rules and Flows, Custom Objects,
    Custom Types, API Extensions, Subscriptions, Messages, Custom Views, Connect `service`, `event` and
    `merchant-center-custom-view`). Only single
    fields elsewhere are beta. Evidence is the absence of beta labels; confidence medium.
16. Connect: `merchant-center-custom-view` is a valid `applicationType`; a sibling folder is a supported dependency via
    `file:../core` plus a build script that builds it first for `service`, `event` and `job` apps, not for a Custom
    View, which builds from its own folder (verified in a Connect preview, 2026-10-30); npm workspaces are not
    documented; Node 22 or 24
    ([Common modules](https://docs.commercetools.com/connect/common-modules),
    [Development](https://docs.commercetools.com/connect/development)).
17. Custom View scopes: any `view_*` / `manage_*` scope is accepted by the config schema; all scopes needed exist.
    Calls to `as-associate` through the Merchant Center proxy are plausible but not documented; verified in the
    sandbox during Stage 0.
18. Query by custom field: `custom(fields(bccCostObject="..."))`; carts and shopping lists list `custom` as queryable,
    orders, quotes and quote requests do not list it (verified in the sandbox). New predicate patterns can take up to
    two weeks to be indexed; queries use a time range. Order Search covers only three months and has no
    `businessUnit`, so it is not used.

19. Approval status for consumption: the order carries none. Approval Flows are readable only through `as-associate`
    endpoints ([Approval Flows](https://docs.commercetools.com/api/projects/approval-flows)), and persisted Messages
    are kept 15 days by default ([General concepts](https://docs.commercetools.com/api/general-concepts#automatic-cleanup)),
    too short for quarter or year budgets. `ApprovalFlowCreatedMessage` carries the flow with its `order`;
    `ApprovalFlowCompletedMessage` carries `status` and `order`
    ([Approval Flow Messages](https://docs.commercetools.com/api/projects/messages/approval-rule-approval-flow-messages)).
    Decision: the event app `ledger` writes `bccApprovalStatus` on the order from these two Messages, from Stage 0 on;
    the ledger bookkeeping joins the same app later.

## 13. Build order

**Stage 0:** `core/` with tests, `service` with the cart Extension and the snapshot fields, `ledger` with the approval
status, `budget-view` with cost
objects, projects and overview, budgets and role limits, consumption, Approval Rule setup and CSV, the seed, and the
Labs files. The README states the limits: live consumption without ledger, the cart-level race (§5.2), returns out of
scope.

Then: order-Create recheck and ledger bookkeeping; budget report; project prices and bill-of-quantities import; line-level cost
objects; storefront kit; MCP.
