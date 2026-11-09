# Stage 0A: `core` Domain Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `core/`, the pure TypeScript domain library for cost objects, budgets, settings, consumption, budget
evaluation, snapshot actions, approval status and the spend report, fully unit-tested and traced to `BCC-` IDs.

**Architecture:** One npm package in `core/` without network access or SDK calls. Every function takes plain data
(Custom Object values, order and cart shapes, unit hierarchy) and returns plain data. `service`, `ledger` and
`budget-view` (plans 0B and 0C) depend on it through `file:../core` and do all I/O themselves.

**Tech Stack:** Node 22, TypeScript 5 (strict), Jest 29 with ts-jest (the runner of the Connect templates and the
Merchant Center jest preset), no runtime dependencies.

**Spec:** `openspec/specs/*/spec.md` (requirement IDs below), `docs/design.md` §4 and §5.

Stage 0 is split into three plans: **0A `core`** (this plan, no sandbox needed), **0B `service`, `ledger` and
deployment** (scaffolded with the Connect CLI, needs the sandbox and secrets), **0C `budget-view`, seed, e2e and Labs
files** (needs the registered Custom View). 0B and 0C are written after 0A is done, against its real interfaces.

## Global Constraints

- Language English in code, comments, messages and docs; no em-dashes in prose.
- Every name in Custom Types, containers and keys carries the prefix `bcc`; containers `bcc-cost-objects`,
  `bcc-budgets`, `bcc-settings`.
- Every source and test file cites the requirement IDs it implements or proves, as `[BCC-XXX-n]` in a comment;
  `node tools/trace.mjs` must exit 0 after every task (no unknown IDs).
- Money is `{ currencyCode: string, centAmount: number }` (integer cent amounts); never floats for money.
- Times are ISO 8601 strings in UTC; period boundaries are UTC (`[BCC-BUDGET-4]`).
- Codes and budget ids match `^[-_.a-zA-Z0-9]{1,64}$`; Custom Object keys match `^[-_~.a-zA-Z0-9]+$`, length 1 to 256.
- Status enum `ok | warn | exceeded | blocked | none`; mode enum `approval | warn | block`; approval status enum
  `pending | approved | rejected`.
- No commit may contain `_intern/`; check `git diff --cached --name-only | grep '^_intern/'` is empty before each
  commit. Branch `develop`, never push.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Period edges: an order at exactly `from` counts, one at `to + 1 ms` does not; February in a leap year
   (2028-02-29) and the last millisecond of December. Tests in Task 5 and Task 7.
2. A budget with amount 0 ("nothing may be spent"): projected 0 is `ok`, anything above 0 is `exceeded`, never a
   division by zero. Test in Task 8.
3. Corrupt Custom Object values (`null`, a string, a nested field of the wrong type) are rejected with field errors
   instead of throwing. Tests in Task 2, Task 4 and Task 5.
4. A Business Unit key containing `~` or a character a Custom Object key forbids: key building fails with a message,
   and parsing splits at the last `~`. Test in Task 1.
5. Orders in another currency: excluded from consumption, counted separately in the report. Tests in Task 7 and
   Task 11.

---

### Task 1: Package scaffold, validation result type and key scheme

**Files:**
- Create: `package.json` (root), `core/package.json`, `core/tsconfig.json`, `core/jest.config.cjs`, `core/.gitignore`
- Create: `core/src/result.ts`, `core/src/keys.ts`, `core/src/index.ts`
- Test: `core/test/keys.test.ts`

**Interfaces:**
- Produces:
  - `type FieldError = { field: string; message: string }`
  - `type Result<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] }`
  - `CODE_PATTERN: RegExp` (`/^[-_.a-zA-Z0-9]{1,64}$/`), `KEY_PATTERN: RegExp` (`/^[-_~.a-zA-Z0-9]{1,256}$/`)
  - `recordKey(ownerBusinessUnitKey: string, code: string): Result<string>` (used for cost objects and budgets)
  - `parseRecordKey(key: string): { ownerBusinessUnitKey: string; code: string } | null`
  - `CONTAINERS = { costObjects: 'bcc-cost-objects', budgets: 'bcc-budgets', settings: 'bcc-settings' } as const`

- [ ] **Step 1: Write the package files**

Root `package.json`: `"private": true`, `"type": "module"`, scripts `"test": "npm --prefix core test && node --test tools/trace.test.mjs && node tools/trace.mjs"`, `"trace": "node tools/trace.mjs"`, `"trace:strict": "node tools/trace.mjs --strict"`. No workspaces (not documented for Connect, design §12 item 16).
`core/package.json`: name `budgets-cost-centers-core`, `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`, scripts `build` (`tsc -p tsconfig.json`), `test` (`jest`); devDependencies `typescript@^5`, `jest@^29`, `ts-jest@^29`, `@types/jest@^29`. `tsconfig.json`: `strict`, `target ES2022`, `module commonjs`, `declaration`, `outDir dist`, `rootDir src`. `core/.gitignore`: `node_modules/`, `dist/`.

- [ ] **Step 2: Write the failing test**

```ts
// [BCC-COST-2] [BCC-BUDGET-1]
import { recordKey, parseRecordKey } from '../src/keys';

test('builds owner~code', () => {
  expect(recordKey('unit-a', 'PRJ-1001')).toEqual({ ok: true, value: 'unit-a~PRJ-1001' });
});
test('rejects a code with a space or a tilde', () => {
  expect(recordKey('unit-a', 'PRJ 1001')).toMatchObject({ ok: false, errors: [{ field: 'code' }] });
  expect(recordKey('unit-a', 'a~b')).toMatchObject({ ok: false, errors: [{ field: 'code' }] });
});
test('rejects a unit key with a character a Custom Object key forbids, naming the unit key', () => {
  const r = recordKey('unit@a', 'CC-1');
  expect(r).toMatchObject({ ok: false, errors: [{ field: 'ownerBusinessUnitKey' }] });
  expect(JSON.stringify(r)).toContain('unit@a');
});
test('rejects keys longer than 256 characters', () => {
  expect(recordKey('u'.repeat(200), 'c'.repeat(60))).toMatchObject({ ok: false });
});
test('parses at the last tilde', () => {
  expect(parseRecordKey('unit~a~CC-1')).toEqual({ ownerBusinessUnitKey: 'unit~a', code: 'CC-1' });
  expect(parseRecordKey('no-tilde')).toBeNull();
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `cd core && npm install && npx jest test/keys.test.ts`
Expected: FAIL, cannot find module `../src/keys`.

- [ ] **Step 4: Implement `result.ts`, `keys.ts`, `index.ts`** (index re-exports every module of this plan as it is added).

- [ ] **Step 5: Run tests and trace**

Run: `cd core && npx jest && cd .. && node tools/trace.mjs`
Expected: jest PASS; trace exits 0 and lists `BCC-COST-2` and `BCC-BUDGET-1` as `unproven` or `traced`.

- [ ] **Step 6: Commit**

```bash
git add package.json core && ! git diff --cached --name-only | grep -q '^_intern/' && git commit -m "Add core package with key scheme"
```

Every later commit step uses the same guard: `! git diff --cached --name-only | grep -q '^_intern/' && git commit ...`.

### Task 2: Cost-object values

**Files:**
- Create: `core/src/cost-object.ts`
- Test: `core/test/cost-object.test.ts`

**Interfaces:**
- Consumes: `Result`, `FieldError`, `CODE_PATTERN` (Task 1)
- Produces:
  - `type CostObjectType = 'cost-center' | 'project' | 'site'`
  - `type ProjectStatus = 'planned' | 'active' | 'closed'`
  - `type CostObject = { code: string; name: string; type: CostObjectType; ownerBusinessUnitKey: string; active: boolean; validFrom?: string; validTo?: string; externalId?: string; buyers?: string[]; linkedBusinessUnitKey?: string; project?: { status: ProjectStatus; siteAddress?: string; erpProjectNumber?: string } }`
  - `validateCostObject(value: unknown): Result<CostObject>`
  - `validateCostObjectChange(previous: CostObject, next: CostObject): Result<CostObject>`
  - `deactivateCostObject(value: CostObject): CostObject`
  - `isAllowedFor(co: CostObject, customerId: string): boolean`
  - `isUsableAt(co: CostObject, at: string): boolean`

- [ ] **Step 1: Write the failing tests**, citing `[BCC-COST-1] [BCC-COST-3] [BCC-COST-4] [BCC-COST-6] [BCC-COST-7] [BCC-COST-8]`:
  - a valid cost center `{ code: 'CC-100', name: 'Workshop', type: 'cost-center', ownerBusinessUnitKey: 'unit-a', active: true }` gives `ok: true`;
  - missing `name` gives one error with `field: 'name'`;
  - `type: 'department'` gives an error on `type`;
  - `validateCostObject(null)`, `validateCostObject('x')` and `{ ..., buyers: 'cust-1' }` give `ok: false` without throwing;
  - `project` on a `cost-center` gives an error on `project`; a `project` type without `project` gives an error on `project`;
  - `validateCostObjectChange` with a changed `code` or `ownerBusinessUnitKey` gives an error on that field; a changed `name` is ok;
  - `deactivateCostObject` returns the same value with `active: false`;
  - `isAllowedFor`: `buyers` absent or `[]` allows `cust-2`; `buyers: ['cust-1']` rejects `cust-2`;
  - `isUsableAt`: inactive is false; `validTo: '2026-10-28'` at `'2026-10-29T08:00:00Z'` is false; `validTo: '2026-10-29'` at `'2026-10-29T23:59:59Z'` is true (date bounds inclusive, whole day); project with status `planned` or `closed` is false, `active` is true.

- [ ] **Step 2: Run** `cd core && npx jest test/cost-object.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement `cost-object.ts`.** Collect all field errors, do not stop at the first. `validFrom`/`validTo` are `YYYY-MM-DD`; `validTo` covers the whole UTC day.

- [ ] **Step 4: Run** `cd core && npx jest && node ../tools/trace.mjs`. Expected: PASS, trace exit 0.

- [ ] **Step 5: Commit** `git commit -m "Add cost-object validation and usability rules"` (after the `_intern/` check).

### Task 3: Settings values

**Files:**
- Create: `core/src/settings.ts`
- Test: `core/test/settings.test.ts`

**Interfaces:**
- Consumes: `Result` (Task 1)
- Produces:
  - `type Mode = 'approval' | 'warn' | 'block'`
  - `type Settings = { defaultMode: Mode; costObjectRequired: boolean; defaultCostObject?: string; costObjectLevel: 'order'; features: { projects: boolean }; approval: { ruleKey?: string; requesterRoles: string[]; checkedAt?: string } }`
  - `DEFAULT_SETTINGS: Settings` = `{ defaultMode: 'approval', costObjectRequired: false, costObjectLevel: 'order', features: { projects: true }, approval: { requesterRoles: [] } }`
  - `validateSettings(value: unknown, visibleCostObjectKeys: string[]): Result<Settings>`

- [ ] **Step 1: Write the failing tests**, citing `[BCC-SET-1] [BCC-SET-3] [BCC-SET-4]`: a full valid value is ok; `costObjectLevel: 'line'` gives an error on `costObjectLevel` whose message contains `reserved`; `defaultCostObject: 'unit-b~CC-1'` with visible keys `['unit-a~CC-100']` gives an error on `defaultCostObject`; `null` gives `ok: false` without throwing; `defaultMode: 'stop'` gives an error on `defaultMode`.
- [ ] **Step 2: Run** `cd core && npx jest test/settings.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `settings.ts`.**
- [ ] **Step 4: Run** `cd core && npx jest && node ../tools/trace.mjs`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `git commit -m "Add unit settings validation"`.

### Task 4: Hierarchy, visibility and settings resolution

**Files:**
- Create: `core/src/hierarchy.ts`
- Test: `core/test/hierarchy.test.ts`

**Interfaces:**
- Consumes: `CostObject`, `isUsableAt` (Task 2); `Settings`, `DEFAULT_SETTINGS` (Task 3)
- Produces:
  - `type UnitNode = { key: string; parentKey?: string; approvalRuleMode?: 'Explicit' | 'ExplicitAndFromParent' }`
  - `unitChain(unitKey: string, units: UnitNode[]): UnitNode[]` (the unit first, then ancestors up to the top; stops on a cycle)
  - `visibleCostObjects(unitKey: string, units: UnitNode[], costObjects: CostObject[]): CostObject[]`
  - `effectiveSettings(unitKey: string, units: UnitNode[], records: Record<string, Settings>): Settings`
  - `coveredRoles(unitKey: string, units: UnitNode[], records: Record<string, Settings>): string[]`

- [ ] **Step 1: Write the failing tests**, citing `[BCC-COST-5] [BCC-SET-2] [BCC-APPR-2]`, with units `unit-a`, `division-a1` (parent `unit-a`, `approvalRuleMode: 'ExplicitAndFromParent'`), `division-a2` (parent `unit-a`, `Explicit`), `unit-b`:
  - `unitChain('division-a1', units).map(u => u.key)` equals `['division-a1', 'unit-a']`; a cycle `x -> y -> x` returns `['x', 'y']`;
  - `unit-a~CC-100` is visible in `division-a1`; `unit-b~CC-1` is not;
  - `unit-a~PRJ-1001` with `linkedBusinessUnitKey: 'division-a1'` is visible in `division-a1` only, not in `unit-a` or `division-a2`;
  - `effectiveSettings('division-a1', ...)` with only `unit-a` having `costObjectRequired: true` returns `costObjectRequired: true`; with no records returns `DEFAULT_SETTINGS`;
  - `coveredRoles`: `unit-a` covers `['buyer']`, `division-a1` own `['site-buyer']` gives `['site-buyer', 'buyer']`; `division-a2` own `['site-buyer']` gives `['site-buyer']` only.

- [ ] **Step 2: Run** `cd core && npx jest test/hierarchy.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `hierarchy.ts`.** `visibleCostObjects` filters by owner in the chain and by `linkedBusinessUnitKey`; it does not filter by usability (callers decide). `coveredRoles` uses the unit's own effective settings, and adds ancestors' covered roles only while the current unit is `ExplicitAndFromParent`.

- [ ] **Step 4: Run** `cd core && npx jest && node ../tools/trace.mjs`. Expected: PASS, exit 0.

- [ ] **Step 5: Commit** `git commit -m "Add unit hierarchy, cost-object visibility and settings resolution"`.

### Task 5: Budget values and periods

**Files:**
- Create: `core/src/money.ts`, `core/src/budget.ts`, `core/src/period.ts`
- Test: `core/test/budget.test.ts`, `core/test/period.test.ts`

**Interfaces:**
- Consumes: `Result`, `CODE_PATTERN` (Task 1), `Mode` (Task 3)
- Produces:
  - `type Money = { currencyCode: string; centAmount: number }`
  - `type ScopeKind = 'cost-object' | 'business-unit' | 'role' | 'associate'`
  - `type Period = { kind: 'month' | 'quarter' | 'year'; from: string; to?: string } | { kind: 'range'; from: string; to: string }` (dates `YYYY-MM-DD`)
  - `type Budget = { scope: { kind: ScopeKind; ref: string }; ownerBusinessUnitKey: string; amount: Money; period: Period; mode: Mode; modeByRole?: Record<string, Mode>; warnAtPercent: number; active: boolean }`
  - `validateBudget(value: unknown): Result<Budget>` (`warnAtPercent` defaults to 80 when absent)
  - `deactivateBudget(value: Budget): Budget`
  - `type Interval = { from: string; to: string }` (ISO instants, both inclusive)
  - `periodInEffect(period: Period, at: string): Interval | null`

- [ ] **Step 1: Write the failing budget tests**, citing `[BCC-BUDGET-1] [BCC-BUDGET-2] [BCC-BUDGET-7]`: valid project budget with `amount: { currencyCode: 'EUR', centAmount: 1000000 }` is ok and gets `warnAtPercent: 80`; negative `centAmount` gives an error on `amount`; `centAmount: 10.5` gives an error on `amount`; `currencyCode: 'euro'` gives an error on `amount` (must be three upper-case letters); `range` without `to` gives an error on `period`; `modeByRole: { buyer: 'stop' }` gives an error on `modeByRole`; `null` and `'x'` give `ok: false` without throwing; `amount.centAmount: 0` is ok.
- [ ] **Step 2: Write the failing period tests**, citing `[BCC-BUDGET-4]`:

```ts
// [BCC-BUDGET-4]
import { periodInEffect } from '../src/period';
const m = { kind: 'month', from: '2026-01-01' } as const;
test('monthly', () => expect(periodInEffect(m, '2026-03-15T10:00:00Z'))
  .toEqual({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' }));
test('quarter', () => expect(periodInEffect({ kind: 'quarter', from: '2026-01-01' }, '2026-11-02T00:00:00Z'))
  .toEqual({ from: '2026-10-01T00:00:00.000Z', to: '2026-12-31T23:59:59.999Z' }));
test('leap February', () => expect(periodInEffect(m, '2028-02-29T12:00:00Z')?.to).toBe('2028-02-29T23:59:59.999Z'));
test('before start', () => expect(periodInEffect(m, '2025-12-31T23:59:59Z')).toBeNull());
test('after to', () => expect(periodInEffect({ kind: 'month', from: '2026-01-01', to: '2026-06-30' }, '2026-07-01T00:00:00Z')).toBeNull());
test('range', () => expect(periodInEffect({ kind: 'range', from: '2026-01-01', to: '2026-06-30' }, '2026-06-30T23:59:59.999Z'))
  .toEqual({ from: '2026-01-01T00:00:00.000Z', to: '2026-06-30T23:59:59.999Z' }));
test('range over', () => expect(periodInEffect({ kind: 'range', from: '2026-01-01', to: '2026-06-30' }, '2026-07-01T00:00:00Z')).toBeNull());
```

- [ ] **Step 3: Run** `cd core && npx jest test/budget.test.ts test/period.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement `money.ts`, `budget.ts`, `period.ts`.** Calendar periods use `Date.UTC`; a calendar period that starts before `from` does not apply (budgets start on a period boundary in practice; a mid-month `from` makes the first month not apply, documented in a comment).
- [ ] **Step 5: Run** `cd core && npx jest && node ../tools/trace.mjs`. Expected: PASS, exit 0.
- [ ] **Step 6: Commit** `git commit -m "Add budget validation and UTC periods"`.

### Task 6: Applicable scopes

**Files:**
- Create: `core/src/scopes.ts`
- Test: `core/test/scopes.test.ts`

**Interfaces:**
- Consumes: `Budget`, `periodInEffect`, `Interval` (Task 5)
- Produces:
  - `type CheckContext = { unitKey: string; costObjectKey?: string; customerId: string; buyerRoles: string[]; currencyCode: string; at: string }`
  - `type ApplicableScope = { key: string; budget: Budget; interval: Interval }`
  - `type SkippedScope = { key: string; skipped: 'currency' }`
  - `applicableScopes(ctx: CheckContext, budgets: Array<{ key: string; value: Budget }>): { scopes: ApplicableScope[]; skipped: SkippedScope[] }`

- [ ] **Step 1: Write the failing tests**, citing `[BCC-BUDGET-3] [BCC-BUDGET-8] [BCC-CART-4] [BCC-BUDGET-7]`, context `{ unitKey: 'unit-a', costObjectKey: 'unit-a~PRJ-1001', customerId: 'cust-1', buyerRoles: ['buyer'], currencyCode: 'EUR', at: '2026-11-02T10:00:00Z' }`:
  - cost-object budget for `unit-a~PRJ-1001`, unit budget for `unit-a` and role limit `buyer` owned by `unit-a` give three scopes;
  - a unit budget owned by `unit-a` does not apply to context unit `division-a1`;
  - a role limit owned by `unit-b` does not apply;
  - adding an associate limit for `cust-1` owned by `unit-a` gives three scopes (cost object, unit, associate) and no role scope;
  - an inactive budget and a budget whose period is not in effect are absent;
  - a USD unit budget is in `skipped` as `{ key, skipped: 'currency' }`, not in `scopes`.
- [ ] **Step 2: Run** `cd core && npx jest test/scopes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `scopes.ts`.**
- [ ] **Step 4: Run** `cd core && npx jest && node ../tools/trace.mjs`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `git commit -m "Add applicable scope selection"`.

### Task 7: Consumption

**Files:**
- Create: `core/src/consumption.ts`
- Test: `core/test/consumption.test.ts`

**Interfaces:**
- Consumes: `Money` (Task 5), `ApplicableScope`, `CheckContext` (Task 6)
- Produces:
  - `type PricedLike = { totalPrice: Money; taxedPrice?: { totalNet: Money } }`
  - `type OrderLike = PricedLike & { id: string; createdAt: string; orderState: string; customerId?: string; businessUnit?: { key: string }; custom?: { fields: Record<string, unknown> } }`
  - `amountOf(x: PricedLike): Money`
  - `countsToward(order: OrderLike, scope: ApplicableScope, ctx: CheckContext): boolean`
  - `consumed(orders: OrderLike[], scope: ApplicableScope, ctx: CheckContext): { amount: Money; orderCount: number }`
  - `projected(consumedAmount: Money, cart: PricedLike): Money`

- [ ] **Step 1: Write the failing tests**, citing `[BCC-SPEND-1] [BCC-SPEND-2] [BCC-SPEND-3]`, scope interval `2026-10-01T00:00:00.000Z` to `2026-12-31T23:59:59.999Z`:
  - `amountOf({ totalPrice: EUR 132000, taxedPrice: { totalNet: EUR 110000 } })` is EUR 110000; without `taxedPrice` it is `totalPrice`;
  - orders with `orderState: 'Cancelled'`, with `custom.fields.bccApprovalStatus: 'rejected'`, in USD, created `2026-09-30T23:59:59.999Z` or `2027-01-01T00:00:00.000Z` do not count;
  - an order created exactly `2026-10-01T00:00:00.000Z` and one with `bccApprovalStatus: 'pending'` count;
  - cost-object scope counts orders with `custom.fields.bccCostObject === scope ref` from any unit; business-unit scope counts only `businessUnit.key === ref`; role and associate scopes count only orders of `ctx.customerId` in the budget's owner unit;
  - `consumed` of two counting orders of EUR 70000 and EUR 30000 gives `{ amount: EUR 100000, orderCount: 2 }`;
  - `projected(EUR 70000, cart EUR 15000)` is EUR 85000.
- [ ] **Step 2: Run** `cd core && npx jest test/consumption.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `consumption.ts`.**
- [ ] **Step 4: Run** `cd core && npx jest && node ../tools/trace.mjs`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `git commit -m "Add consumption from orders"`.

### Task 8: Budget evaluation

**Files:**
- Create: `core/src/evaluate.ts`
- Test: `core/test/evaluate.test.ts`

**Interfaces:**
- Consumes: `Mode` (Task 3), `Budget`, `Money`, `ScopeKind` (Task 5), `ApplicableScope`, `SkippedScope` (Task 6)
- Produces:
  - `type ScopeLevel = 'ok' | 'warn' | 'exceeded'`
  - `type BudgetStatus = 'ok' | 'warn' | 'exceeded' | 'blocked' | 'none'`
  - `type ScopeResult = { key: string; kind: ScopeKind; amount: number; used: number; projected: number; level: ScopeLevel; mode: Mode }` (amounts in cent)
  - `scopeLevel(amount: number, projected: number, warnAtPercent: number): ScopeLevel`
  - `effectiveMode(budget: Budget, buyerRoles: string[], coveredRoles: string[]): Mode`
  - `type Outcome = { status: BudgetStatus; exceeded: boolean; scopes: Array<ScopeResult | SkippedScope> | { error: 'unchecked' } }`
  - `cartOutcome(input: { costObjectRequired: boolean; costObjectKey?: string; results: ScopeResult[]; skipped: SkippedScope[] }): Outcome`
  - `uncheckedOutcome(): Outcome` = `{ status: 'exceeded', exceeded: true, scopes: { error: 'unchecked' } }`

- [ ] **Step 1: Write the failing tests**, citing `[BCC-BUDGET-5] [BCC-BUDGET-6] [BCC-CART-5] [BCC-CART-6] [BCC-CART-8] [BCC-APPR-2]`:
  - `scopeLevel(100000, 85000, 80)` is `warn`; `(100000, 79999, 80)` is `ok`; `(100000, 100000, 80)` is `warn`; `(100000, 100001, 80)` is `exceeded`; `(0, 0, 80)` is `ok`; `(0, 1, 80)` is `exceeded`;
  - `effectiveMode` with `mode: 'block'`, `modeByRole: { 'purchasing-manager': 'warn' }`, roles `['purchasing-manager']` is `warn`; roles with overrides `warn` and `approval` give `approval`; no matching role gives `mode`;
  - fail-safe: `mode: 'approval'`, buyer roles `['site-buyer']`, covered `['buyer']` gives `block`; covered `['site-buyer']` gives `approval`;
  - `cartOutcome`: warn-exceeded plus block-exceeded gives `{ status: 'blocked', exceeded: false }`; only approval-exceeded gives `{ status: 'exceeded', exceeded: true }`; one warn-level scope gives `warn`; no scopes gives `ok`; `costObjectRequired: true` without `costObjectKey` gives `none`;
  - `uncheckedOutcome()` equals `{ status: 'exceeded', exceeded: true, scopes: { error: 'unchecked' } }`.
- [ ] **Step 2: Run** `cd core && npx jest test/evaluate.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `evaluate.ts`.** Strictness order `block > approval > warn`; the fail-safe applies after role overrides.
- [ ] **Step 4: Run** `cd core && npx jest && node ../tools/trace.mjs`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `git commit -m "Add budget evaluation with fail-safe"`.

### Task 9: Snapshot update actions

**Files:**
- Create: `core/src/snapshot.ts`
- Test: `core/test/snapshot.test.ts`

**Interfaces:**
- Consumes: `Outcome` (Task 8)
- Produces:
  - `type CustomState = { typeKey?: string; fields: Record<string, unknown> } | undefined` (the cart's current `custom`, with the type key resolved by the caller)
  - `type UpdateAction = { action: string; [k: string]: unknown }`
  - `snapshotActions(input: { custom: CustomState; configuredTypeKey: string; outcome: Outcome; defaultedCostObject?: string; now: string; isProject: boolean; deleteDaysAfterLastModification?: number; projectRetentionDays: number }): Result<UpdateAction[]>`

- [ ] **Step 1: Write the failing tests**, citing `[BCC-CART-2] [BCC-CART-7] [BCC-CART-11] [BCC-PROJ-3]`:
  - same status, flag and scopes as stored gives `ok: true, value: []` (no `bccCheckedAt` write);
  - a changed status gives `setCustomField` for `bccBudgetStatus`, `bccBudgetExceeded`, `bccBudgetScopes` (compact JSON, no spaces) and `bccCheckedAt` equal to `now`;
  - `custom` undefined gives one `setCustomType` with `type: { typeId: 'type', key: configuredTypeKey }` and all snapshot fields in `fields`;
  - `custom.typeKey: 'shop-cart'` with configured `bcc-order` gives `ok: false` with a message containing `shop-cart`;
  - `defaultedCostObject: 'unit-a~CC-100'` adds `setCustomField bccCostObject`;
  - `isProject: true`, `deleteDaysAfterLastModification: 90`, retention 365 adds `{ action: 'setDeleteDaysAfterLastModification', deleteDaysAfterLastModification: 365 }`; with 400 already set, no such action.
- [ ] **Step 2: Run** `cd core && npx jest test/snapshot.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `snapshot.ts`.** Compare `bccBudgetScopes` as the JSON string the function would write.
- [ ] **Step 4: Run** `cd core && npx jest && node ../tools/trace.mjs`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `git commit -m "Add snapshot update actions"`.

### Task 10: Approval status transitions

**Files:**
- Create: `core/src/approval-status.ts`
- Test: `core/test/approval-status.test.ts`

**Interfaces:**
- Produces:
  - `type ApprovalStatus = 'pending' | 'approved' | 'rejected'`
  - `type ApprovalMessage = { type: 'ApprovalFlowCreated'; orderId: string } | { type: 'ApprovalFlowCompleted'; orderId: string; status: 'Approved' | 'Rejected' } | { type: 'other' }`
  - `toApprovalMessage(message: unknown): ApprovalMessage` (reads `approvalFlow.order.id` for Created, `order.id` and `status` for Completed)
  - `nextApprovalStatus(current: ApprovalStatus | undefined, message: ApprovalMessage): ApprovalStatus | undefined` (undefined means "write nothing")

- [ ] **Step 1: Write the failing tests**, citing `[BCC-APPR-5]`: Created on no status gives `pending`; Completed `Rejected` on `pending` gives `rejected`; Completed `Approved` gives `approved`; Created on `rejected` or `approved` gives `undefined`; the same Completed twice (current already `rejected`) gives `undefined`; `toApprovalMessage({ type: 'ApprovalFlowApproved' })` gives `{ type: 'other' }`; a Created message without `approvalFlow` gives `{ type: 'other' }` without throwing.
- [ ] **Step 2: Run** `cd core && npx jest test/approval-status.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `approval-status.ts`.**
- [ ] **Step 4: Run** `cd core && npx jest && node ../tools/trace.mjs`. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** `git commit -m "Add approval status transitions"`.

### Task 11: Spend report and CSV

**Files:**
- Create: `core/src/report.ts`
- Test: `core/test/report.test.ts`

**Interfaces:**
- Consumes: `CostObject` (Task 2), `Budget`, `Interval`, `Money` (Task 5), `OrderLike`, `countsToward` semantics (Task 7)
- Produces:
  - `type ReportRow = { unit: string; costObject: string; type: string; externalId: string; period: string; budget: string; consumed: string; remaining: string; orderCount: number }` (money as `12345.67 EUR`, period as `2026-10-01..2026-12-31`)
  - `spendReport(input: { unitKey: string; interval: Interval; costObjects: Array<{ key: string; value: CostObject }>; budgets: Array<{ key: string; value: Budget }>; orders: OrderLike[] }): { rows: ReportRow[]; otherCurrencyOrders: number }`
  - `toCsv(rows: ReportRow[]): string`

- [ ] **Step 1: Write the failing tests**, citing `[BCC-SPEND-4]`: two cost objects with Q4 budgets give two rows in cost-object code order; header line is exactly `unit,cost object,type,externalId,period,budget,consumed,remaining,order count`; a cost object without a budget has empty budget and remaining; a USD order raises `otherCurrencyOrders` to 1 and is not in `consumed`; a name or externalId with a comma or quote is quoted per RFC 4180; lines end with `\r\n`.
- [ ] **Step 2: Run** `cd core && npx jest test/report.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `report.ts`.** Money formatting divides by 100 with two decimals (EUR, USD); currencies with other fraction digits are out of scope in v1 and noted in a comment.
- [ ] **Step 4: Run** `npm test` in the repository root. Expected: core PASS, trace tests PASS, trace exit 0.
- [ ] **Step 5: Commit** `git commit -m "Add spend report and CSV"`.

### Task 12: Close-out

**Files:**
- Modify: `docs/backlog.md` (Done: `core`; Next: plan 0B)
- Create: `docs/traceability.md` (generated)

- [ ] **Step 1: Build** `cd core && npm run build`. Expected: `dist/index.js` and `dist/index.d.ts` exist, no type errors.
- [ ] **Step 2: Generate the matrix** `node tools/trace.mjs --write`. Expected: every requirement listed in the task citations above is `traced` or `unproven` only where its implementation is planned in 0B or 0C (the matrix shows which).
- [ ] **Step 3: Commit** `git commit -m "Close Stage 0A: core library and traceability matrix"`.
