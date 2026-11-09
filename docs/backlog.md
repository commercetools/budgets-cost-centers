# Backlog

Status 2026-11-02: v0.2.0 released on `main` (tags v0.1.0, v0.1.1, v0.2.0), deployed as preview with the 60 s cache.

## Done

- Repository initialised (branch `develop`; `main` is created later by a squash commit).
- `docs/design.md`: scope, data model, behaviour, edge cases, platform checks with documentation links (§12).
- OpenSpec initialised with the commercetools overlay merged into `openspec/config.yaml`.
- Stage 0 capability specs drafted (`openspec/specs/`, 73 requirements) and the trace check (`tools/trace.mjs`).
- Stage 0A: `core/` domain library, 160 unit tests; 36 requirements traced (`docs/traceability.md`). Traced core
  logic still needs its wiring in `service`, `ledger` and the view (0B, 0C).
- Stage 0B (local): `service` (cart check, order guard, quotes, lifecycle) and `ledger` (approval status, verified
  Messages, Subscription, replay tool) with router, adapter and lifecycle tests against fakes and `msw`; per-app API
  Clients with read-only runtime tokens (`[BCC-DEPLOY-6]`, `[BCC-DEPLOY-9]`); `core` and `shared` as Connect common
  modules. Whole-branch review done, all findings fixed. Live checks follow once the human steps are done.
- Stage 0C (local): Labs files and package check; fictional seed and local runner; `budget-view` (cost objects,
  settings, budgets with consumption, project overview, CSV, Approval Rule check and setup). Two whole-branch reviews,
  all findings fixed; coverage follows rule changes through the `ledger` (`[BCC-APPR-8]`). 658 tests, 75 of 77
  requirements traced; `[BCC-CART-10]` (latency) needs the live run. Platform features listed with documentation
  links in `FEATURES.md` and checked for beta labels (`[BCC-DEPLOY-7]`).
- Stage 0 on Connect (2026-10-31 to 2026-11-01): repository pushed (private) to
  github.com/commercetools-demo/budgets-cost-centers; Connect validation (download, verify, build, SCA, SAST) passes
  from `v0.1.0-preview.3`; the Connect build check (`tools/connect-build-check.mjs`, `[BCC-DEPLOY-10]`) covers the
  findings (common modules with dev dependencies, lock files in sync, no critical advisory, self-contained view,
  classic JSX runtime). Preview Deployment `bcc-preview` in the sandbox, Custom View registered and installed.
- Live on the preview Deployment (2026-11-01): the platform calls the Extension; cart update p50 182 ms, p95 220 ms
  over 20 updates; the order guard rejects an over-budget order; the ledger sets `bccApprovalStatus` pending, then
  approved, through Pub/Sub; the cost object travels through quote request, staged quote, quote and order from quote;
  recurring carts get a snapshot through the cart Create Extension and an "order now" order passes the guard; Order
  Import does not call the Extension; the Approval Rule evaluates the cart customer's roles when another associate
  orders the cart. Latency check `tools/e2e/latency.e2e.mjs` (`[BCC-CART-10]`): 200 cart updates, p50 161 ms,
  p95 233 ms, no failure. Click path on the deployed Custom View (`v0.1.0-preview.5`) with Playwright: cost objects,
  budgets with consumption, settings, the Approval Rule check as an associate through the Merchant Center proxy, the
  project overview. 78 requirements, all traced.


## Decided

- One package with cost centers, projects and sites as cost objects; projects also as a business object with an
  overview of lists, carts, quotes and orders.
- Own entities as Custom Objects (`bcc-cost-objects`, `bcc-budgets`, `bcc-settings`); Custom Fields only on
  transactions (reference and snapshot); nothing stored on Business Units.
- Budgets per cost object or unit and period; spend limits per Associate Role or associate and period; mode
  `approval` / `warn` / `block`, overridable per role.
- Approval through a native Approval Rule on `custom.bccBudgetExceeded = true`; fail-safe block when no rule covers the
  buyer's role; no own order states.
- Cost object at order level only; line level reserved; no split of one line.
- Free-text job references are not cost objects.
- Returns and refunds out of scope.
- The view creates the Approval Rule on behalf of an associate of the unit (stated in README).
- CSV export of spend in the view, in the browser.
- Approval status on the order: the event app `ledger` writes `bccApprovalStatus` from `ApprovalFlowCreated` and
  `ApprovalFlowCompleted` Messages, from Stage 0 on; the ledger bookkeeping joins the same app later (design §12,
  item 19). Three Connect apps in Stage 0: `service`, `ledger`, `budget-view`.
- Folders: `core`, `shared`, `service`, `ledger`, `budget-view`, `seed`, `tools`; later `budget-report`, `mcp`,
  `storefront-kit`.
- Specs: OpenSpec (`openspec/specs/<capability>/spec.md`, changes under `openspec/changes/`). Requirement IDs per
  capability, for example `[BCC-COST-1]`, `[BCC-BUDGET-3]`; code and tests cite them, and a trace check keeps that
  true.
- The Custom View builds from its own folder with the classic JSX runtime, as Connect builds it: a generated copy of
  `core/src` in `budget-view/src/core`, React imported in every JSX file (`[BCC-DEPLOY-10]`).

## Next steps

1. Labs publish. The commercetools org does not accept Robert's account (not a member): IT ticket for access, or
   Behnam transfers the `commercetools-demo` repository. Prepared in a local handoff note. Then prepare
   the repository with the `/commercetools-labs-publish` skill and create the local deny list; the Labs team
   switches it public and opens the docs PR.

## Optimizations (by budget)

Measured on the preview Deployment, 200 cart updates each (`npm run e2e:latency`, whole update calls):

| Version | p50 | p95 |
|---|---|---|
| v0.1.0, sequential reads | 161 ms | 233 ms |
| v0.1.1, parallel reads `[BCC-CART-12]` (cache off, `BCC_CACHE_SECONDS=0`) | 131 ms | 172 ms |
| v0.2.0, parallel reads and 60 s cache `[BCC-CART-13]` | 110 ms | 137 ms |

A cart update without the Extension takes p50 66 ms, so the Extension now adds about 45 ms at the median. Live check of
the cache (2026-11-02): a budget changed to 1 cent was not seen on the next update, and was seen after 65 s; the
budget was restored.

Later, by budget:

1. Stage 1: precomputed consumption in the ledger instead of live order queries (the remaining live read); design
   target p95 under 100 ms, independent of order volume. Needs its own design section and a migration of the order
   queries. Today v0.2.0 already meets 137 ms on the seed data; the gain shows with many orders.
2. Production Deployment: no idle sleep, so no timeout on the first call after a pause. A deployment choice, not code.
3. Cache invalidation across panel and service (for example by a Subscription on Custom Object changes) if the 60 s
   limit is not acceptable; today `BCC_CACHE_SECONDS=0` turns the cache off.

## Carry into later stages

- A `sandbox` or `preview` Deployment sleeps when idle; the first cart call after a pause can exceed the 2 s
  Extension timeout (`ExtensionNoResponse`, seen after about 20 idle minutes). Production deployments for real use.
- Rule key `bcc-budget-<unitKey>`: when an inactive rule with that key exists, setup fails with its error; offer to
  reactivate it instead.
- View: the order reader caches per panel session without invalidation; the buyer picker offers associates of direct
  divisions only; the project overview's item table still reads full orders over REST.
- The Connect CLI (`commercetools connect validate`) once the npm policy allows `@commercetools/cli`; the Connect
  validation itself passes.
- Node 22.23.4 or later (or 24) for the Merchant Center packages.

## Human steps

1. Sandbox project in the Merchant Center, region Europe (Google Cloud, Belgium), cloud identifier `gcp-eu`, with
   Business Units and Approval Rules available. Enable Messages querying (Settings > Developer settings): the `ledger`
   verifies every Message through the Messages API (`[BCC-APPR-7]`), and the local replay reads stored Messages.
2. API clients (Settings > Developer settings > Create API client, custom scopes). The first two mirror the Connect
   apps; the third is for local tooling only and never goes into `connect.yaml`.
   - `bcc-service-dev`: `view_orders`, `view_quotes`, `view_business_units`, `view_key_value_documents`,
     `view_types`, `manage_types`, `manage_extensions`.
   - `bcc-ledger-dev`: `manage_orders`, `view_types`, `view_messages`, `manage_key_value_documents`,
     `manage_subscriptions`.
   - `bcc-tooling-dev` (seed and e2e): `manage_business_units`, `manage_customers`, `manage_associate_roles`,
     `manage_key_value_documents`, `manage_orders`, `manage_shopping_lists`, `manage_quote_requests`,
     `manage_staged_quotes`, `manage_quotes`, `manage_approval_rules`, `manage_approval_flows`, `view_types`.
3. Custom View (profile > Manage organizations & teams > organization > Custom Views > Configure Custom Views): add
   and verify the contact email; add the view with name "Budgets & Cost Centers", placeholder URL
   `https://example.com`, view and manage scopes as in `[BCC-DEPLOY-8]`, entry point Business Unit general page,
   extended panel; note the Custom View ID. After the deployment set the URL to the `budget-view` application URL of
   the Deployment, set the view to Ready and install it for the sandbox project only
   ([Create and install a Custom View](https://docs.commercetools.com/guides/create-custom-view)).
4. Secrets file (default `~/_dev/Projects/.secrets/budgets-cost-centers.env`, or the path in `BCC_SECRETS_FILE`; folder
   mode 700, file mode 600) with `CTP_PROJECT_KEY`, `CTP_AUTH_URL`, `CTP_API_URL`, the three client IDs and secrets
   (`BCC_SERVICE_CLIENT_ID`/`_SECRET`, `BCC_LEDGER_CLIENT_ID`/`_SECRET`, `BCC_TOOLING_CLIENT_ID`/`_SECRET`),
   `BCC_EXTENSION_SECRET` (random, 32+ characters), `CUSTOM_VIEW_ID`, `CLOUD_IDENTIFIER=gcp-eu`.
5. Log in yourself when `mc-scripts` or the Playwright browser asks for Merchant Center credentials.
6. A private repository grants read access to the GitHub user `connect-mu`.
7. Create the untracked deny list the local deny list (one name per line) for the package check (`[BCC-PKG-4]`);
   without it the name check is skipped with a notice.

## Sandbox verifications

Verified 2026-11-01 on the preview Deployment unless noted:

- Orders, quotes and quote requests are queryable by custom field (2026-10-30, `sandbox-checks`).
- The deployed Custom View calls `as-associate` endpoints and Custom Object queries through the Merchant Center proxy.
- The order `Create` Extension sees the custom fields inherited from the cart (`[BCC-CART-9]`).
- The order `Create` Extension for an order from a quote returns `setCustomType` / `setCustomField`
  (`[BCC-QUOTE-2]`): the order carries the cost object.
- Custom Object query `container="bcc-budgets" and value(ownerBusinessUnitKey in (...))` works.
- The trigger condition `businessUnit is defined` is accepted for cart and order triggers.
- `CONNECT_SERVICE_URL` contains the endpoint path `/service`.
- The GraphQL order projection with `customFieldsRaw(includeNames: ...)` returns the fields the consumption needs.
- Recurring Orders: the recurring cart is created through the cart Create Extension and carries the snapshot; an
  "order now" order passes the order guard. Order Import does not call the Extension.
- `GET /messages/{id}` returns pushed Approval Flow Messages once Messages querying is on (`[BCC-APPR-7]`).
- The Approval Rule evaluates the cart customer's roles when an associate with `CreateOrdersFromOthersCarts` orders
  another associate's cart.
- The Merchant Center URL of a Business Unit page contains `/business-units/<id>`, which the view reads from
  `hostUrl` (not documented).
- Open: Business Unit keys use only characters a Custom Object key allows (`[BCC-COST-2]`); enforced by validation,
  not by the platform.
