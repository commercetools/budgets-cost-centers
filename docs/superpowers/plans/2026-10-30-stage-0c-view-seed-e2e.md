# Stage 0C: `budget-view`, Seed, E2E and Labs Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Stage 0: the Merchant Center Custom View on the Business Unit page, an idempotent fictional seed,
the live end-to-end proof of the buyer, approver and admin flows, and the Labs repository files with a package check.

**Architecture:** `budget-view/` is a Custom View (`CustomPanel`, locator `customers.business_unit_details.general`)
built with the application-shell and Nimbus. Everything the view computes lives in pure view-model functions
(`budget-view/src/model/`) on top of `core`, tested without React; components only render and dispatch. All platform
calls go through the Merchant Center proxy in the user's session. `seed/` is a Node script on the shared SDK client.
E2E tests live in `e2e/` and run only with the secrets file present.

**Tech Stack:** `@commercetools-frontend/application-shell` and `mc-scripts` 27, `@commercetools/nimbus` 3, React 19,
`@commercetools-frontend/jest-preset-mc-app`, Playwright, Node ≥ 22.23.4 (required by the MC packages).

**Spec:** `openspec/specs/{budget-view,seed,labs-package,projects,approval,deployment,consumption}/spec.md`,
`docs/design.md` §6, §10, §11, §13.

## Global Constraints

- All 0A and 0B constraints hold (English, `bcc` prefix, ID citations, `_intern/` never staged, `develop`, no push).
- View scopes exactly as `[BCC-DEPLOY-8]`: view `view_key_value_documents view_orders view_quotes
  view_quote_requests view_shopping_lists view_business_units view_associate_roles view_customers
  view_approval_rules`; manage `manage_key_value_documents manage_approval_rules`.
- Config placeholders: `customViewId: '${env:CUSTOM_VIEW_ID}'`, `url: '${env:APPLICATION_URL}'`,
  `cloudIdentifier: '${env:CLOUD_IDENTIFIER}'`; `connect.yaml` entry `budget-view` of type
  `merchant-center-custom-view` with `CUSTOM_VIEW_ID` and `CLOUD_IDENTIFIER` (default `gcp-eu`), no endpoint.
- UI text only from `budget-view/src/i18n/data/en.json` (`[BCC-VIEW-10]`); Nimbus components only, wrapped in
  `NimbusProvider`; Nimbus JSDOM polyfills per its testing setup page.
- Every write sends the version it read (`[BCC-VIEW-8]`); records are deactivated, never deleted.
- Seed data is fictional, names end with "(fictional)", keys start with `bcc-demo-` (`[BCC-SEED-1]`).
- Remote-state steps (Custom View registration, Connect deployment, tunnel) are human steps; the plan never runs
  them.

## Review Focus

1. A division view: inherited cost objects read-only, the division's own settings record written in full so it does
   not silently drop the parent's `costObjectRequired` (backlog carry-over). Test in Task 4.
2. A stale coverage record: `approval.checkedAt` shown, re-check offered, a deactivated rule detected. Test in Task 6.
3. Version conflict on save keeps the user's input. Test in Task 3.
4. A view-only user sees no edit, deactivate or setup control. Test in Task 4 and Task 5.
5. The seed refuses a project key other than the configured sandbox. Test in Task 7.

---

### Task 1: Labs files and package check

**Files:** Create `README.md`, `SUPPORT.md`, `LICENSE`, `FEATURES.md`, `tools/package-check.mjs`,
`tools/package-check.test.mjs`; modify root `package.json` (`check` script, `test` runs it).

**Interfaces:** Produces `checkPackage(root: string, opts: { denyListPath?: string; staged?: string[] }): string[]`
(problems, empty when clean).

- [ ] Tests (`[BCC-PKG-1]`, `[BCC-PKG-2]`, `[BCC-PKG-4]`): missing file → problem naming it; README not starting with
  the banner → problem; a "Limits" section missing any of the ten points of `[BCC-PKG-2]` → problem naming the point;
  a staged path under `_intern/` → problem; a tracked file containing a deny-list name (case-insensitive, word
  boundary) → problem with file and line; deny list read from `_intern/deny-list.txt` by default, absent file →
  check skipped with a notice, never a published list.
- [ ] Implement, run `node --test tools/package-check.test.mjs`, write the four files, run `node tools/package-check.mjs`
  → no problems. Commit.

### Task 2: `budget-view` scaffold

**Files:** `budget-view/{package.json,custom-view-config.mjs,jest.config.js,tsconfig.json,src/…}` from the official
custom-view starter (`npx @commercetools-frontend/create-mc-app@27 --template starter-typescript --application-type custom-view`,
or by hand after it if the npm policy blocks), `connect.yaml` entry, `service/tests/connect-yaml.test.ts` extended.

- [ ] Tests: `custom-view-config.mjs` has `type: 'CustomPanel'`, locator `customers.business_unit_details.general`,
  `typeSettings.size: 'LARGE'`, `oAuthScopes` exactly as Global Constraints (`[BCC-DEPLOY-8]`, `[BCC-VIEW-1]`);
  `connect.yaml` lists `budget-view` with no endpoint; the panel renders the unit key it receives
  (`renderCustomView` with `hostUrl` of a unit page).
- [ ] Implement; `npm --prefix budget-view test` and `npm --prefix budget-view run build` pass. Commit.

### Task 3: Data access through the Merchant Center proxy

**Files:** `budget-view/src/data/{records.ts,units.ts,orders.ts}` + tests.

**Interfaces:** `useRecords(container, where)` → `{ records: Array<{ key; version; value }>, loading, error, reload }`;
`saveRecord(dispatch, container, key, value, version?)` → `{ ok: true; version } | { ok: false; conflict: true } |
{ ok: false; message }`; `useUnitChain(unitKey)` → `UnitNode[]`; `useOrders(where)` (paged by id like 0B).

- [ ] Tests: save sends `{ container, key, value, version }`; 409 → `conflict` (`[BCC-VIEW-8]`); values failing `core`
  validation are rejected before any request; reads validate with `core` and surface corrupt records as errors.
- [ ] Implement with `actions-global` and `MC_API_PROXY_TARGETS.COMMERCETOOLS_PLATFORM`. Commit.

### Task 4: Cost objects and settings

**Files:** `budget-view/src/model/{cost-objects.ts,settings.ts}`, `budget-view/src/components/{cost-objects,settings}/…`.

- [ ] Model tests: own rows editable, inherited rows read-only with owner (`[BCC-VIEW-2]`); new cost object key
  `recordKey(unit, code)`; settings form writes a full record merged from the effective settings (Review Focus 1,
  `[BCC-VIEW-5]`, `[BCC-SET-4]` default must be visible).
- [ ] Component tests: add a site `SITE-7` → saved as `unit-a~SITE-7`; deactivate sends `active: false`; view-only
  user sees no add, edit or deactivate control (`[BCC-VIEW-9]`). Commit.

### Task 5: Budgets, consumption, project overview, CSV

**Files:** `budget-view/src/model/{budgets.ts,consumption.ts,project.ts,export.ts}` and components.

- [ ] Model tests: budget form for all four scope kinds, defaults `mode` from settings and `warnAtPercent` 80
  (`[BCC-VIEW-3]`, `[BCC-BUDGET-5]`); bar percent and state ok/warn/exceeded, other-currency hint (`[BCC-VIEW-4]`);
  project overview lists shopping lists, carts, quote requests, quotes and orders carrying the key with totals
  (`[BCC-PROJ-1]`, `[BCC-VIEW-6]`); CSV from `spendReport`/`toCsv` with the nine columns and a header
  (`[BCC-VIEW-7]`, `[BCC-SPEND-4]`).
- [ ] Component tests: 850 of 1,000 EUR → 85 % in warn; project status change to `closed` saves
  (`[BCC-PROJ-4]`); export triggers a download named `budgets-<unit>-<period>.csv`. Commit.

### Task 6: Approval Rule check and setup

**Files:** `budget-view/src/model/approval.ts`, `budget-view/src/data/approval-rules.ts`, components.

- [ ] Model tests (`[BCC-APPR-3]`): active rules whose predicate contains `bccBudgetExceeded = true`; roles with
  `CreateMyOrdersFromMyCarts` or `CreateOrdersFromOthersCarts` missing from requesters → warning; coverage record
  `{ ruleKey, requesterRoles, checkedAt }`; `checkedAt` older than the last rule change or a deactivated rule →
  stale (Review Focus 2).
- [ ] Data/component tests (`[BCC-APPR-4]`): associate picker offers only associates holding `CreateApprovalRules`;
  setup posts to `/as-associate/<id>/in-business-unit/key=<unit>/approval-rules` with predicate
  `custom.bccBudgetExceeded = true`, the chosen requesters and approver tiers, then writes the coverage; the screen
  names the associate it acts for. Commit.

### Task 7: Seed and local runner

**Files:** `seed/{package.json,tsconfig.json,src/data.ts,src/apply.ts,src/index.ts,tests/…}`, `tools/run-local.mjs`.

- [ ] Tests: data is fictional and prefixed (`[BCC-SEED-1]`); content covers two units, one division, roles with and
  without order permissions, associates, all three cost-object types, a project with two phase carts and a
  shopping list, budgets in all three modes a seeded buyer can exceed, one role limit, settings, a budget Approval Rule
  (`[BCC-SEED-3]`); second run against an `msw` project that already holds everything → zero writes
  (`[BCC-SEED-2]`); `--project` missing or different from `CTP_PROJECT_KEY` → exit 1 before any request
  (`[BCC-SEED-4]`).
- [ ] `run-local.mjs <app>` maps `BCC_<APP>_CLIENT_ID/_SECRET` and the app's scopes to `CTP_*` from
  `~/_dev/Projects/.secrets/budgets-cost-centers.env` and starts the app. Commit.

### Task 8: Live checks (needs the human steps)

**Files:** `e2e/{playwright.config.ts,flows.e2e.ts,view.e2e.ts,latency.e2e.ts,sandbox-checks.e2e.ts}`.

- [ ] Sandbox verifications from the backlog as read-only checks.
- [ ] Flows: buyer under budget → order; warn → order with status `warn`; approval → Approval Flow, approver approves
  → `bccApprovalStatus: approved` via replay (`[BCC-APPR-1]`, `[BCC-APPR-5]`); block → order rejected with the budget
  message (`[BCC-CART-9]`); closed project → cart update fails.
- [ ] View click path with Playwright in the Merchant Center (user logs in): add site, add role limit, see the warn bar,
  export CSV, set up the approval rule.
- [ ] Latency: 200 recorded cart updates, p95 < 300 ms (`[BCC-CART-10]`).
- [ ] `node tools/trace.mjs --strict` passes. Commit.

### Task 9: Close Stage 0

- [ ] Final whole-branch review, spec check against the use cases, backlog and design updated. Commit.
