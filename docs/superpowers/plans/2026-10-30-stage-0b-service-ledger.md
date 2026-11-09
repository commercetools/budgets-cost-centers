# Stage 0B: `service`, `ledger` and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two Connect apps: `service` (API Extension on cart Create/Update, order Create, quote-request
Create) and `ledger` (Subscription handler for Approval Flow Messages), with their `postDeploy`/`preUndeploy` scripts
and `connect.yaml`, all wired to `core` and tested without a project.

**Architecture:** Each app is one folder named like its `connect.yaml` entry, in the layout of the official Connect
TypeScript starter template (`connect-application-kit`). Shared Node code (config, SDK client, logger, scope check)
lives in `shared/src`. Apps compile `core/src` and `shared/src` from source (`rootDir: ".."`), so no package build
order exists. All platform I/O goes through a small `Platform` port per app; domain flows are tested against an
in-memory fake, the SDK adapter and lifecycle scripts against `msw`, the HTTP layer with `supertest`.

**Tech Stack:** Node 22, TypeScript 5 strict, Express 5, `@commercetools/platform-sdk@^9`, `@commercetools/ts-client@^5`,
Jest 30 + ts-jest, supertest 7, msw 2.

**Spec:** `openspec/specs/{cart-check,quotes,projects,approval,deployment}/spec.md`, `docs/design.md` §3, §4.2, §5.

## Global Constraints

- All 0A constraints hold: English, `bcc` prefix, `[BCC-…]` citations in every source and test file, money in
  integer cents, UTC ISO times, `_intern/` never staged, branch `develop`, never push, commit trailer
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pinned clients: `@commercetools/platform-sdk@^9`, `@commercetools/ts-client@^5`; never `sdk-client-v2`.
- Extension responses: `200` with `{ actions }` (at most 100) or no body; `400` with
  `{ errors: [{ code: 'InvalidInput', message }] }`; never a stack trace or platform error text in a response.
- Extension auth: destination `authentication: { type: 'AuthorizationHeader', headerValue: 'Bearer <secret>' }`;
  the handler compares `Authorization` in constant time and answers `401` otherwise.
- Internal time budget of the cart check: 1,500 ms (`[BCC-CART-8]`); the Extension timeout stays at the 2 s default.
- Endpoints: `service` mounts its router at `/service` (`POST /service`, `GET /service/health`); `ledger` at `/ledger`.
- Per-app API Clients from `securedConfiguration`; no `inheritAs.apiClient` (`[BCC-DEPLOY-6]`). Allowed scopes:
  `service`: `view_orders view_quotes view_business_units view_key_value_documents manage_types manage_extensions`;
  `ledger`: `manage_orders view_types manage_subscriptions` (plus `view_messages` only for the local replay client,
  never checked by `postDeploy` of a deployment).
- Config keys: `CTP_PROJECT_KEY`, `CTP_REGION` (or `CTP_AUTH_URL` + `CTP_API_URL`), `CTP_CLIENT_ID`,
  `CTP_CLIENT_SECRET`, `CTP_SCOPE`, `BCC_ORDER_TYPE_KEY` (default `bcc-order`), `BCC_LINE_ITEM_TYPE_KEY`
  (`bcc-line-item`), `BCC_SHOPPING_LIST_TYPE_KEY` (`bcc-shopping-list`), `BCC_QUOTE_TYPE_KEY` (`bcc-quote`),
  `BCC_PROJECT_RETENTION_DAYS` (`365`), `BCC_EXTENSION_SECRET` (service only).
- Platform facts used (verified 2026-10-30): `view_orders` covers carts
  ([Scopes](https://docs.commercetools.com/api/scopes)); `BusinessUnit.inheritedAssociates` carries inherited role
  assignments ([Associates overview](https://docs.commercetools.com/api/associates-overview)); `QuoteRequest.cart`,
  `Order.cart`, `Order.quote` are references; `ApprovalFlowCreated.approvalFlow.order`,
  `ApprovalFlowCompleted.{status,order}`; Custom Type `resourceTypeId: 'quote'` covers quote requests, staged quotes and
  quotes; subscription destination from `CONNECT_SUBSCRIPTION_DESTINATION` (`GoogleCloudPubSub` or `SNS`); Extension
  destination URL from `CONNECT_SERVICE_URL`.

## Review Focus

1. A platform call that hangs: the cart answer still arrives within 1,500 ms plus overhead as `unchecked`, and the
   order guard never waits longer than the Extension timeout. Test in Task 4 (`deadline`) and Task 5.
2. A corrupt budget or settings record (wrong shape, key owner differing from value owner): the cart becomes
   `unchecked` (fail-safe), never `ok`. Test in Task 4.
3. A cart whose Custom Type is foreign, or an order whose type is foreign in the ledger: rejected (service) or acked
   and logged (ledger), never overwritten. Tests in Task 4 and Task 8.
4. Duplicate and out-of-order Approval Flow Messages, a deleted order, a version conflict: no double write, no lost
   final status, retry only for transient failures. Test in Task 8.
5. `postDeploy` run twice, or against a customer type with a conflicting field: idempotent, or fails naming the
   field. Test in Task 7.

---

### Task 1: Shared code, app scaffolds and `connect.yaml`

**Files:**
- Create: `shared/src/config.ts`, `shared/src/client.ts`, `shared/src/logger.ts`, `shared/src/scopes.ts`
- Create: `service/{package.json,tsconfig.json,jest.config.cjs,.env.example,.gitignore}`,
  `ledger/{package.json,tsconfig.json,jest.config.cjs,.env.example,.gitignore}`, `connect.yaml`
- Modify: root `package.json` (`test` runs core, service, ledger, trace tests, trace)
- Test: `service/tests/scopes.test.ts`, `service/tests/connect-yaml.test.ts`, `service/tests/config.test.ts`

**Interfaces:**
- Produces: `readConfig(env: NodeJS.ProcessEnv, app: 'service' | 'ledger'): AppConfig` (throws `Error` listing every
  missing or invalid key); `AppConfig = { projectKey, authUrl, apiUrl, clientId, clientSecret, scope,
  extensionSecret?, typeKeys: { order, lineItem, shoppingList, quote }, projectRetentionDays: number }`;
  `createApiRoot(config: AppConfig): ByProjectKeyRequestBuilder` (memoised per config object);
  `log(level: 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>): void` (one JSON line on
  stdout/stderr); `SCOPES: { service: readonly string[]; ledger: readonly string[] }`;
  `unexpectedScopes(ctpScope: string, allowed: readonly string[]): string[]` (scope names without `:projectKey`).

- [ ] **Step 1: Write failing tests**
  - `scopes.test.ts`: `unexpectedScopes('manage_types:demo view_orders:demo manage_project:demo', SCOPES.service)`
    → `['manage_project']`; the exact service list → `[]`; empty string → `[]`.
  - `connect-yaml.test.ts` (`[BCC-DEPLOY-6]`): parse `connect.yaml` (dependency `yaml`), assert no
    `inheritAs.apiClient`, `deployAs` names `['service', 'ledger']`, `service.endpoint === '/service'`,
    `ledger.endpoint === '/ledger'`, each app lists `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPE` under
    `securedConfiguration`, `BCC_EXTENSION_SECRET` secured in `service` only, no secret key under
    `standardConfiguration`.
  - `config.test.ts`: `CTP_REGION=europe-west1.gcp` derives `https://auth.europe-west1.gcp.commercetools.com` and
    `https://api.europe-west1.gcp.commercetools.com`; explicit `CTP_AUTH_URL`/`CTP_API_URL` win; defaults for type
    keys and retention; missing `BCC_EXTENSION_SECRET` throws for `service` only; retention `0` or `400000` throws
    (`[BCC-PROJ-3]`: 1 to 365250).
- [ ] **Step 2: Run** `npm --prefix service test` → FAIL (modules missing).
- [ ] **Step 3: Implement** the shared modules, the two scaffolds (`tsconfig`: `rootDir ".."`, `outDir build`,
  `include ["src", "../shared/src", "../core/src"]`, strict, `noUncheckedIndexedAccess`; `start` =
  `node build/service/src/index.js`; scripts `connector:post-deploy` / `connector:pre-undeploy` pointing at
  `build/<app>/src/connector/*.js`; `postDeploy: npm install && npm run build && npm run connector:post-deploy`) and
  `connect.yaml` per the Global Constraints.
- [ ] **Step 4: Run** `npm --prefix service test` → PASS; `npm --prefix service run build` exits 0.
- [ ] **Step 5: Commit** "Scaffold service and ledger apps with per-app API Clients".

### Task 2: Cost-object resolution and validation

**Files:**
- Create: `service/src/cost-object-check.ts`
- Test: `service/tests/cost-object-check.test.ts`

**Interfaces:**
- Consumes: `CostObject`, `validateCostObject`, `isAllowedFor`, `isUsableAt`, `visibleCostObjects`, `parseRecordKey`,
  `UnitNode`, `Settings` from `core`.
- Produces: `costObjectProblem(input: { key: string; record: unknown | undefined; unitKey: string; units: UnitNode[];
  customerId?: string; at: string }): { ok: true; costObject: CostObject } | { ok: false; message: string }`;
  `resolveCostObjectKey(input: { cartValue?: string; settings: Settings; defaultRecord: unknown | undefined; unitKey;
  units; customerId?; at }): { key?: string; defaulted: boolean }`.

- [ ] **Step 1: Write failing tests** (`[BCC-CART-2]`, `[BCC-CART-3]`), exact messages:
  - missing record → `Cost object CC-404 does not exist.`
  - owner outside the chain or linked to another unit → `Cost object CC-1 cannot be used in this business unit.`
  - buyer not in `buyers` → `You are not allowed to order against cost object CC-100.`
  - inactive → `Cost object CC-100 is inactive.`
  - before `validFrom` → `Cost object CC-100 is valid from 2027-01-01.`; after `validTo` →
    `Cost object CC-100 expired on 2026-06-30.`
  - project `closed` → `Project PRJ-1001 is closed and cannot be ordered against.`; `planned` →
    `Project PRJ-1001 is planned and not open for orders yet.`
  - corrupt record (fails `validateCostObject`) → treated as missing.
  - `resolveCostObjectKey`: cart value wins and is not `defaulted`; no cart value + visible usable default →
    `{ key: default, defaulted: true }`; default invisible, unusable or not allowed for the buyer → `{ defaulted:
    false }` without key.
- [ ] **Step 2: Run** `npx jest cost-object-check` (in `service/`) → FAIL.
- [ ] **Step 3: Implement**; the code shown in messages is `parseRecordKey(key)?.code ?? key`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** "Validate the cart cost object with buyer-readable messages".

### Task 3: Platform port, fake and unit context

**Files:**
- Create: `service/src/platform.ts` (port types only), `service/src/unit-context.ts`, `service/tests/fake-platform.ts`
- Test: `service/tests/unit-context.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type RoleAssignment = { associateRole: { key: string } };
  type AssociateLike = { customer: { id: string }; associateRoleAssignments: RoleAssignment[] };
  type BusinessUnitLike = { key: string; parentUnit?: { key: string };
    approvalRuleMode?: 'Explicit' | 'ExplicitAndFromParent'; associates: AssociateLike[];
    inheritedAssociates?: AssociateLike[] };
  type Record_ = { key: string; value: unknown };
  interface ServicePlatform {
    getBusinessUnit(key: string): Promise<BusinessUnitLike | undefined>;
    getCustomObjects(container: string, keys: string[]): Promise<Record_[]>;
    queryBudgets(ownerKeys: string[]): Promise<Record_[]>;
    queryOrders(where: string): Promise<OrderLike[]>;          // all pages
    getCart(id: string): Promise<CartLike | undefined>;
    getQuote(id: string): Promise<{ custom?: CustomLike } | undefined>;
    typeIdByKey(key: string): Promise<string | undefined>;
  }
  type CustomLike = { type: { id: string }; fields: Record<string, unknown> };
  type CartLike = PricedLike & { id: string; customerId?: string; businessUnit?: { key: string };
    custom?: CustomLike; deleteDaysAfterLastModification?: number };
  type UnitContext = { unitKey: string; units: UnitNode[]; settings: Record<string, Settings>;
    effective: Settings; covered: string[]; rolesOf(customerId?: string): string[] };
  loadUnitContext(platform: ServicePlatform, unitKey: string): Promise<UnitContext>;
  ```
  `FakePlatform implements ServicePlatform` with public arrays/maps (`units`, `objects`, `orders`, `carts`, `quotes`,
  `types`) and an optional `delayMs` and `failWith` per method.

- [ ] **Step 1: Write failing tests** (`[BCC-SET-2]`, `[BCC-APPR-2]`, `[BCC-CART-4]`): chain `division-a1 → unit-a`
  loads both units and both settings records; `rolesOf('cust-1')` merges direct and inherited role keys without
  duplicates; an unknown customer has no roles; `covered` follows `coveredRoles`; a settings record failing
  `validateSettings` throws `Error('Invalid settings record unit-a')`; a parent cycle stops after 6 levels; an
  unknown unit throws.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** "Load the unit chain, settings and buyer roles".

### Task 4: Cart check

**Files:**
- Create: `service/src/deadline.ts`, `service/src/consumption-query.ts`, `service/src/cart-check.ts`
- Test: `service/tests/deadline.test.ts`, `service/tests/consumption-query.test.ts`, `service/tests/cart-check.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3; `applicableScopes`, `consumed`, `projected`, `amountOf`, `scopeLevel`, `effectiveMode`,
  `cartOutcome`, `uncheckedOutcome`, `snapshotActions`, `validateBudget`, `parseRecordKey`, `CONTAINERS` from `core`.
- Produces: `withDeadline<T>(p: Promise<T>, ms: number): Promise<T>` (rejects with `DeadlineError`);
  `ordersWhere(scope: ApplicableScope, ctx: CheckContext): string`;
  `type ExtensionResult = { status: 200; actions: UpdateAction[] } | { status: 400; message: string }`;
  `checkCart(cart: CartLike, deps: { platform: ServicePlatform; config: AppConfig; now: () => string;
  deadlineMs: number }): Promise<ExtensionResult>`.

Flow of `checkCart`: no `businessUnit` → 200 `[]`. Resolve the configured order type id (`typeIdByKey`, cached per
process; failure → 200 `[]`, so the guard later rejects the unchecked cart). Inside `withDeadline(…, deadlineMs)`: load
the unit context; resolve and validate the cost object (problem → 400 with its message); load budgets with
`queryBudgets([unitKey, costObjectOwner])`, validate each with `validateBudget` and require the key owner to equal the
value owner (else throw); `applicableScopes`; query orders per scope in parallel; build `ScopeResult[]` with
`effectiveMode(budget, roles, covered)`; `cartOutcome`. Any throw or deadline → `uncheckedOutcome(roles ∩ covered ≠ ∅)`,
with roles known only when the context loaded (else uncovered). Finally `snapshotActions` with `isProject` from the
cost object type and `projectRetentionDays` from config; its `fail` (foreign type) → 400 with that message.

- [ ] **Step 1: Write failing tests**
  - `deadline.test.ts`: resolves when the promise wins; rejects with `DeadlineError` after `ms` when it hangs.
  - `consumption-query.test.ts` (`[BCC-SPEND-1]`): cost-object scope →
    `custom(fields(bccCostObject="unit-a~PRJ-1001")) and createdAt >= "2026-10-01T00:00:00.000Z" and createdAt <= "2026-12-31T23:59:59.999Z"`;
    business-unit → `businessUnit(key="unit-a") and …`; role and associate →
    `businessUnit(key="unit-a") and customerId="cust-1" and …`; values are JSON-escaped.
  - `cart-check.test.ts` with `FakePlatform` (seed: `unit-a`, `division-a1`, project `unit-a~PRJ-1001` with a
    1,000 EUR quarterly budget, orders 700 EUR, cart 150 EUR net):
    - no custom → `setCustomType` with `bcc-order`, status `warn`, scopes JSON sorted by key (`[BCC-CART-7]`,
      `[BCC-CART-11]`, `[BCC-BUDGET-6]`);
    - same cart again with that snapshot → 200 `[]` (`[BCC-CART-7]` "Nothing changed");
    - cart 400 EUR with mode `approval` and covered buyer → `exceeded`, `bccBudgetExceeded: true` (`[BCC-CART-5]`);
      uncovered buyer → `blocked` (`[BCC-APPR-2]`);
    - closed project → 400 `Project PRJ-1001 is closed and cannot be ordered against.` (`[BCC-CART-3]`);
    - default cost object applied and written (`[BCC-CART-2]`); invisible default ignored;
    - unit requires a cost object, none set → status `none`, 200 (`[BCC-CART-6]`);
    - foreign cart type id → 400 naming the type (`[BCC-CART-11]`);
    - `queryOrders` fails → `exceeded` + `{"error":"unchecked"}` for a covered buyer, `blocked` for an uncovered one;
      `queryOrders` hangs past `deadlineMs: 50` → `unchecked` within 200 ms (`[BCC-CART-8]`);
    - corrupt budget record or key owner ≠ value owner → `unchecked` (Review Focus 2);
    - project cart with `deleteDaysAfterLastModification: 90` → `setDeleteDaysAfterLastModification` 365
      (`[BCC-PROJ-3]`);
    - USD cart against the EUR budget → scope listed as `skipped: 'currency'` (`[BCC-BUDGET-7]`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** "Check carts against budgets in the service".

### Task 5: Order guard and quotes

**Files:**
- Create: `service/src/order-guard.ts`, `service/src/quote-request.ts`
- Test: `service/tests/order-guard.test.ts`, `service/tests/quote-request.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 4.
- Produces: `guardOrder(order: OrderDraftLike, deps): Promise<ExtensionResult>` with `OrderDraftLike = { cart?: { id:
  string }; quote?: { id: string }; customerId?: string; businessUnit?: { key: string }; custom?: CustomLike }`;
  `handleQuoteRequest(qr: { cart?: { id: string }; customerId?: string; businessUnit?: { key: string }; custom?:
  CustomLike }, deps): Promise<ExtensionResult>`.

Order guard rules (`[BCC-CART-9]`, `[BCC-QUOTE-2]`): from a quote → copy `bccCostObject` from the quote
(`setCustomType` with the order type when the order has no custom, else `setCustomField`), no budget check. From a cart
→ reject when `bccBudgetStatus` is missing, `blocked`, or `none` while the effective settings require a cost object;
then re-validate the cost object with `costObjectProblem`. Platform failure during the guard → 400
`The budget could not be checked. Please try again.` (fail-closed: the guard is the only enforcement of `block`).

- [ ] **Step 1: Write failing tests**, exact messages:
  - blocked by `unit-a~Q4-PRJ-1001` with mode `block` → `This order exceeds the budget Q4-PRJ-1001 and cannot be placed.`;
    blocked with scopes `{"error":"unchecked"}` → `The budget could not be checked and no approval applies to this buyer, so the order cannot be placed.`;
  - missing status → `The budget of this cart has not been checked yet. Update the cart and try again.`;
  - `none` with required → `This business unit requires a cost object. Choose one on the cart before ordering.`;
  - `warn` → 200 `[]`; `ok` on a project closed since the last cart update → the closed-project message;
  - order from a quote with `bccCostObject` → `setCustomType` with `bcc-order` and that field; quote without it → 200 `[]`;
  - quote request without its own value → value from the cart (`setCustomType` with `bcc-quote`); its own value kept;
    invalid cost object → 400 with the Task 2 message (`[BCC-QUOTE-1]`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** "Guard order creation and carry cost objects through quotes".

### Task 6: `service` HTTP app and SDK adapter

**Files:**
- Create: `service/src/app.ts`, `service/src/index.ts`, `service/src/sdk-platform.ts`
- Test: `service/tests/app.test.ts`, `service/tests/sdk-platform.test.ts`

**Interfaces:**
- Produces: `createApp(deps: { platform: ServicePlatform; config: AppConfig; now?: () => string; deadlineMs?: number }):
  Express`; `sdkPlatform(apiRoot: ByProjectKeyRequestBuilder): ServicePlatform`.

- [ ] **Step 1: Write failing tests**
  - `app.test.ts` (supertest, `[BCC-CART-1]`): missing, wrong, and other-length `Authorization` → 401 with no
    platform call; `GET /service/health` → 200; cart input → the Task 4 result as `{ actions }`; 400 result →
    `{ errors: [{ code: 'InvalidInput', message }] }`; unknown `resource.typeId` → 200 no body; a thrown error → 500
    with body `{ errors: [{ code: 'General', message: 'Internal error' }] }` and no stack; correlation id from
    `X-Correlation-ID` appears in the log line.
  - `sdk-platform.test.ts` (msw, `onUnhandledRequest: 'error'`): `queryOrders` pages with `limit=500`,
    `sort=id asc`, `withTotal=false` and `where` + `id > "<last>"` until a page has fewer than 500; `queryBudgets`
    sends `container="bcc-budgets" and value(ownerBusinessUnitKey in ("unit-a", "unit-b"))`; `getBusinessUnit` maps
    404 to `undefined`; `typeIdByKey` maps 404 to `undefined`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (`app.disable('x-powered-by')`, JSON body limit 1 MB).
  **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** "Serve the Extension endpoint with header auth".

### Task 7: `service` lifecycle scripts

**Files:**
- Create: `service/src/connector/types.ts`, `service/src/connector/extension.ts`,
  `service/src/connector/post-deploy.ts`, `service/src/connector/pre-undeploy.ts`
- Test: `service/tests/connector.test.ts`

**Interfaces:**
- Produces: `TYPE_DRAFTS(config): TypeDraft[]` (four drafts per `[BCC-DEPLOY-2]`);
  `ensureType(apiRoot, draft): Promise<'created' | 'updated' | 'unchanged'>`;
  `ensureExtension(apiRoot, url: string, secret: string): Promise<'created' | 'updated'>`;
  `removeExtension(apiRoot): Promise<void>`; `postDeploy(env: NodeJS.ProcessEnv): Promise<void>`.

- [ ] **Step 1: Write failing tests** (msw):
  - `[BCC-DEPLOY-1]`: type absent → POST create; type present with `poReference` → only `addFieldDefinition` for the
    missing `bcc*` fields; second run → no POST (`unchanged`); `bccBudgetStatus` existing as String → throws
    `Field bccBudgetStatus exists on type bcc-order with another type.`
  - `[BCC-DEPLOY-3]`: extension absent → create with key `bcc-service`, `AuthorizationHeader` auth, triggers cart
    `Create`/`Update` and order `Create` with condition `businessUnit is defined`, quote-request `Create`; present →
    `changeDestination` + `changeTriggers` on its version, never delete.
  - `[BCC-DEPLOY-6]`: `postDeploy` with `CTP_SCOPE` containing `manage_project:demo` throws naming `manage_project`
    before any request.
  - `[BCC-DEPLOY-5]`: `removeExtension` deletes by key with version; absent → no-op; no type is deleted.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** "Register types and the Extension idempotently".

### Task 8: `ledger` app

**Files:**
- Create: `ledger/src/{platform.ts,envelope.ts,handle.ts,sdk-platform.ts,app.ts,index.ts}`,
  `ledger/src/connector/{subscription.ts,post-deploy.ts,pre-undeploy.ts}`, `ledger/src/replay.ts`
- Test: `ledger/tests/{envelope,handle,app,connector,replay}.test.ts`

**Interfaces:**
- Consumes: `toApprovalMessage`, `nextApprovalStatus` from `core`; Task 1 shared code.
- Produces: `decodeEnvelope(body: unknown): { ok: true; message: unknown } | { ok: false; reason: string }`;
  `interface LedgerPlatform { getOrder(id): Promise<{ id; version; custom?: CustomLike } | undefined>;
  updateOrder(id, version, actions): Promise<void>; typeIdByKey(key): Promise<string | undefined> }`;
  `handleMessage(message: unknown, deps: { platform: LedgerPlatform; config: AppConfig }): Promise<'written' |
  'ignored' | 'retry'>`; `createApp(deps): Express`; `ensureSubscription(apiRoot, env)`; `toEnvelope(message): {
  message: { data: string } }`.

- [ ] **Step 1: Write failing tests**
  - envelope: base64 JSON decodes; missing `message.data`, bad base64 or bad JSON → `ok: false`.
  - handle (`[BCC-APPR-5]`, `[BCC-APPR-6]`): `ApprovalFlowCreated` → `setCustomField bccApprovalStatus pending`;
    `ApprovalFlowCompleted Rejected` → `rejected`; Created after Completed → `ignored`; same message twice → second
    `ignored`; order without custom → `setCustomType` with `bcc-order` and the field; foreign order type → `ignored`
    and a `warn` log `Order o-1 has another Custom Type; approval status not written.`; order 404 → `ignored`;
    `getOrder` 503 → `retry`; `updateOrder` 409 → `retry`.
  - app: `retry` → 500; everything else, including malformed envelopes and `ResourceCreated` test messages, → 204.
  - connector (`[BCC-DEPLOY-4]`, `[BCC-DEPLOY-5]`, `[BCC-DEPLOY-6]`): absent → create key `bcc-ledger` with
    `messages: [{ resourceTypeId: 'approval-flow', types: ['ApprovalFlowCreated', 'ApprovalFlowCompleted'] }]` and a
    `GoogleCloudPubSub` destination from `CONNECT_GCP_TOPIC_NAME`/`CONNECT_GCP_PROJECT_ID`, or `SNS` with
    `CONNECT_AWS_TOPIC_ARN`; unknown destination type throws; present → `changeDestination` + `setMessages`;
    removal deletes by key; extra scope throws.
  - replay: `toEnvelope(m)` round-trips through `decodeEnvelope`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** `replay.ts` CLI: `node build/ledger/src/replay.js --since <iso>
  --to http://localhost:8081/ledger`, reads Messages of both types (needs `view_messages` and Message persistence) and
  posts each envelope. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** "Record approval outcomes on orders in the ledger".

### Task 9: Docs, trace and suite

**Files:**
- Modify: `docs/design.md` (§3 per-app clients, §5.2 already updated), `docs/backlog.md` (done, next, human steps:
  per-app clients stay, replay client gets `view_messages`), `docs/traceability.md` (regenerate)
- Create: `service/README.md`, `ledger/README.md` (fail-closed and fail-safe stance, scopes, config table, replay
  runbook)

- [ ] **Step 1: Run** `npm test` (root) → core, service, ledger, trace tests pass; `node tools/trace.mjs --write`
  exits 0; `npx openspec validate --specs --strict` passes.
- [ ] **Step 2: Commit** "Close Stage 0B locally: service, ledger, deployment".

Live checks (`[BCC-CART-10]` latency, sandbox verifications, e2e) need the human steps and are the first tasks of
plan 0C.
