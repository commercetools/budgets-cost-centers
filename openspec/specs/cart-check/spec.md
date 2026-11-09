# cart-check Specification

## Purpose

The `service` app is an API Extension that keeps every B2B cart stamped with its budget status, so the native
Approval Rule and the order guard can act on the order. Enforcement is server-side, so it works with any frontend
(design §5.1, §5.2). The platform waits for the Extension and a failing Extension fails the call
([API Extensions](https://docs.commercetools.com/api/projects/api-extensions)).

## Requirements

### Requirement: [BCC-CART-1] Trigger
The Extension SHALL be called on cart `Create` and `Update` only for carts with a Business Unit, through the trigger
condition `businessUnit is defined`
([Query predicates](https://docs.commercetools.com/api/predicates/query)). The endpoint SHALL reject requests without
the configured `Authorization` header value.

#### Scenario: B2C cart
- **WHEN** a cart without a Business Unit is updated
- **THEN** the Extension is not called

#### Scenario: Missing secret
- **WHEN** a request reaches the endpoint without the expected `Authorization` header
- **THEN** the endpoint answers 401 and does nothing

### Requirement: [BCC-CART-2] Resolve the cost object
The cost object of a cart SHALL be `custom.bccCostObject` when set, otherwise the unit's `defaultCostObject`
(BCC-SET-4) when it is still visible and usable; an invisible or unusable default SHALL be ignored. A defaulted cost
object SHALL be written to the cart.

#### Scenario: Default applies
- **WHEN** a cart of `unit-a` has no cost object and `unit-a` has default `unit-a~CC-100`
- **THEN** the Extension sets `bccCostObject` to `unit-a~CC-100`

### Requirement: [BCC-CART-3] Validate the cost object
When a cost object is set, the Extension SHALL reject the call with HTTP 400 and an `InvalidInput` error with a
buyer-readable message when the cost object does not exist, is not visible to the cart's unit (BCC-COST-5), is not
allowed for the cart's customer (BCC-COST-6) or is not usable now (BCC-COST-7).

#### Scenario: Closed project
- **WHEN** a cart is updated while its cost object is a project with status `closed`
- **THEN** the update fails with the message "Project PRJ-1001 is closed and cannot be ordered against."

#### Scenario: Switching to a valid cost object
- **WHEN** a cart with a closed project gets `setCustomField bccCostObject` to an active cost object
- **THEN** the update succeeds

### Requirement: [BCC-CART-4] Applicable scopes
For a cart the Extension SHALL check every active budget whose period is in effect and whose scope applies: the cost
object's budgets, the cart unit's business-unit budgets, and the limits of the cart's customer in the cart unit
(associate limit, else the limits of each role the customer holds there, including inherited role assignments).

#### Scenario: Three scopes
- **WHEN** a cart of `unit-a` uses `unit-a~PRJ-1001` and the buyer holds `buyer` with a monthly limit, and the
  project and the unit each have a budget
- **THEN** three scopes are checked

### Requirement: [BCC-CART-5] Status and outcome
Each scope SHALL be `ok`, `warn` (BCC-BUDGET-6) or `exceeded` (projected use above the amount). The cart status SHALL
be `blocked` when an exceeded scope has the effective mode `block`; else `exceeded` when an exceeded scope has the
effective mode `approval`; else `warn` when any scope is exceeded with mode `warn` or at warning level; else `ok`.
`bccBudgetExceeded` SHALL be true exactly when the status is `exceeded`.

#### Scenario: Strictest wins
- **WHEN** one scope is exceeded with mode `warn` and another with mode `block`
- **THEN** the status is `blocked` and `bccBudgetExceeded` is false

#### Scenario: Approval
- **WHEN** the only exceeded scope has mode `approval` and the buyer's roles are covered (BCC-APPR-2)
- **THEN** the status is `exceeded` and `bccBudgetExceeded` is true

### Requirement: [BCC-CART-6] Required cost object missing
When the unit requires a cost object and the cart has none after BCC-CART-2, the status SHALL be `none` and the cart
update SHALL succeed, so the buyer can still edit the cart.

#### Scenario: Missing cost object
- **WHEN** `unit-a` requires a cost object and the cart has none and no default exists
- **THEN** the cart status is `none`

### Requirement: [BCC-CART-7] Snapshot fields
The Extension SHALL write `bccBudgetStatus`, `bccBudgetExceeded`, `bccBudgetScopes` (compact JSON, sorted by budget
key, with key, kind, amount, used, projected, level `ok`/`warn`/`exceeded` and effective mode per scope) and
`bccCheckedAt`. It SHALL return update actions only when the status, the flag or the scopes changed; `bccCheckedAt`
changes only together with them.

#### Scenario: Nothing changed
- **WHEN** a cart update changes only the shipping address and the budget outcome stays the same
- **THEN** the Extension returns 200 without actions

### Requirement: [BCC-CART-11] Cart Custom Type
A cart without a Custom Type SHALL get the configured order type through `setCustomType`. A cart with another Custom
Type SHALL be rejected with an `InvalidInput` error naming the misconfiguration. When the configured type cannot be
resolved (missing, platform error, time budget), the update SHALL fail too, so a stale snapshot is never kept.

#### Scenario: Cart without a type
- **WHEN** a B2B cart without a Custom Type is created
- **THEN** the Extension returns `setCustomType` with the configured order type and the snapshot fields

#### Scenario: Type lookup fails
- **WHEN** reading the configured order type fails during a cart update
- **THEN** the update fails with "The budget check is not available right now. Please try again."

#### Scenario: Foreign cart type
- **WHEN** the configured order type is `bcc-order` and the cart uses the type `shop-cart`
- **THEN** the update fails with a message that the cart type is not configured for budgets

### Requirement: [BCC-CART-8] Internal failure routes to approval
When consumption cannot be computed (a platform call fails or the internal time budget of 1,500 ms runs out), the
Extension SHALL answer 200 with scopes `{"error":"unchecked"}` and status `exceeded` with `bccBudgetExceeded: true`,
so the order goes to approval; when no Approval Rule covers the buyer (BCC-APPR-2) the status SHALL be `blocked`.

#### Scenario: Uncovered buyer and a failing query
- **WHEN** the order query fails and the buyer holds no covered role
- **THEN** the cart is marked `blocked` with scopes `{"error":"unchecked"}`

#### Scenario: Order query times out
- **WHEN** the order query for consumption does not answer within the time budget
- **THEN** the cart is marked `exceeded` with scopes `{"error":"unchecked"}`

### Requirement: [BCC-CART-9] Order guard
On order `Create` from a cart the Extension SHALL reject the call with HTTP 400 and a buyer-readable `InvalidInput`
error when the inherited `bccBudgetStatus` is `blocked`, `none` or missing, when the unit requires a cost object (by
its current settings) and the order has none, or when the cost object fails BCC-CART-3 now. It SHALL NOT recompute
consumption. Orders from quotes are not budget-checked in v1. Assumption: the Extension sees inherited fields.

#### Scenario: Blocked cart is ordered
- **WHEN** an order is created from a cart with status `blocked` by the budget `unit-a~Q4-PRJ-1001`
- **THEN** order creation fails with "This order exceeds the budget Q4-PRJ-1001 and cannot be placed."

#### Scenario: Project closed after the last cart update
- **WHEN** a cart with status `ok` on `unit-a~PRJ-1001` is ordered after the project was closed
- **THEN** order creation fails with "Project PRJ-1001 is closed and cannot be ordered against."

#### Scenario: Requirement switched on after the last cart update
- **WHEN** a cart with status `ok` and no cost object is ordered after its unit started to require one
- **THEN** order creation fails with "This business unit requires a cost object. Choose one on the cart before ordering."

#### Scenario: Cart never checked
- **WHEN** a B2B cart created before the deployment is ordered without any update since
- **THEN** order creation fails with a message asking to update the cart so the budget can be checked

#### Scenario: Warned cart is ordered
- **WHEN** an order is created from a cart with status `warn`
- **THEN** the order is created

### Requirement: [BCC-CART-10] Latency
The Extension SHALL answer cart calls within p95 300 ms on the seed data, measured by the latency test.

#### Scenario: Latency test
- **WHEN** the latency test sends 200 recorded cart updates against the seed project
- **THEN** the 95th percentile of the response time is below 300 ms

### Requirement: [BCC-CART-12] Parallel reads
The Extension SHALL start independent platform reads together instead of one after the other: the unit chain, the cost
object named on the cart and the budgets of the cart's unit are requested at the same time, and the budgets of the
cost object's owner are requested as soon as that owner is known and differs from the cart's unit. The result SHALL be
the same as with sequential reads, and a failing read SHALL fail the check as before (BCC-CART-8).

#### Scenario: Reads start together
- **WHEN** a cart with `bccCostObject` is checked and the unit read has not answered yet
- **THEN** the cost object and the budgets of the cart's unit have already been requested

#### Scenario: Budgets of another owner
- **WHEN** the cost object belongs to the parent unit of the cart's unit
- **THEN** the budgets of both units apply, as with sequential reads

### Requirement: [BCC-CART-13] Master data cache
The cart check SHALL keep the Business Units, Custom Objects (settings, cost objects) and budgets it reads for
`BCC_CACHE_SECONDS` seconds (default 60, 0 turns the cache off, at most 3600), so most cart updates need no read of
master data. Orders SHALL always be read live. An identical read in flight SHALL be shared, a failed read and an
absent Business Unit SHALL NOT be cached, and the cache SHALL hold at most 1000 entries, dropping the oldest. The
order guard and the quote handling SHALL NOT use the cache. A change in the panel reaches the cart check after at most
`BCC_CACHE_SECONDS` seconds (documented limit).

#### Scenario: Second update inside the window
- **WHEN** two cart updates for the same unit arrive within the window
- **THEN** the second makes no read of Business Units, settings, cost objects or budgets, and reads orders again

#### Scenario: Window over
- **WHEN** the next update arrives after `BCC_CACHE_SECONDS`
- **THEN** the master data is read again

#### Scenario: Failed read
- **WHEN** a read fails
- **THEN** the next update reads again instead of failing from the cache

