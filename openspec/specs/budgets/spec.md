# budgets Specification

## Purpose

Budgets cap spend per cost object or Business Unit and period. Spend limits cap spend per Associate Role or associate
and period. Both are the same record with a different scope. Approval Rule predicates see one order and never a sum
over time ([Why procurement governance matters](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/why-procurement-governance-matters)),
so this package keeps the sums.

## Requirements

### Requirement: [BCC-BUDGET-1] Budget record
The system SHALL store each budget or limit as one Custom Object in the container `bcc-budgets` with the value
`{ scope: { kind, ref }, ownerBusinessUnitKey, amount, period, mode, modeByRole?, warnAtPercent, active }`, where
`scope.kind` is one of `cost-object`, `business-unit`, `role`, `associate` and `amount` is a Money value in the
currency's minor unit, as the platform's `centAmount`. The key SHALL be `<ownerBusinessUnitKey>~<id>`, with `id` matching `^[-_.a-zA-Z0-9]{1,64}$`.

#### Scenario: Create a project budget
- **WHEN** a budget of 10,000.00 EUR per quarter is created for cost object `unit-a~PRJ-1001`
- **THEN** a Custom Object in `bcc-budgets` holds scope `{ kind: 'cost-object', ref: 'unit-a~PRJ-1001' }` and amount
  `{ currencyCode: 'EUR', centAmount: 1000000 }`

### Requirement: [BCC-BUDGET-2] Value validation and deactivation
The `core` library SHALL validate every budget value on write and on read, as for cost objects. Budgets SHALL be
deactivated, never deleted, by this package.

#### Scenario: Negative amount
- **WHEN** a budget with a negative amount is written
- **THEN** the write is rejected with a field error on `amount`

### Requirement: [BCC-BUDGET-3] Budget scopes
A `cost-object` scope SHALL cover orders that carry that cost-object key, in any unit. A `business-unit` scope SHALL
cover orders of exactly that unit; a parent unit's budget SHALL NOT cover its divisions. A `business-unit` scope SHALL
reference its owner unit and a `cost-object` scope a cost object of its owner unit; other values SHALL be rejected.

#### Scenario: Budget on another company's cost object
- **WHEN** `unit-a` writes a budget with scope `{ kind: 'cost-object', ref: 'unit-b~CC-1' }`
- **THEN** the write is rejected with a field error on `scope`

#### Scenario: Parent budget does not cover a division
- **WHEN** `unit-a` has a business-unit budget and `division-a1` places an order
- **THEN** the order does not count toward the `unit-a` budget

### Requirement: [BCC-BUDGET-8] Limit scopes
A `role` scope SHALL be a limit per person: it applies separately to each associate who holds the role in the owner
unit and covers only that associate's orders in that unit. An `associate` scope SHALL cover one associate's orders in
the owner unit and, when it is in the cart's currency, SHALL replace every `role` scope of the same owner unit for
that associate.

#### Scenario: Role limit is per person
- **WHEN** the role `buyer` has a limit of 2,000 EUR per month and two associates hold it
- **THEN** each associate may spend 2,000 EUR per month before the limit is reached

#### Scenario: Associate limit in another currency
- **WHEN** `cust-1` has an associate limit in USD, holds `buyer` with an EUR limit, and the cart is in EUR
- **THEN** the EUR role limit applies and the USD associate limit is skipped for currency

#### Scenario: Associate limit replaces role limits
- **WHEN** associate `cust-1` holds role `buyer` with a limit of 2,000 EUR and has an associate limit of 5,000 EUR
- **THEN** only the 5,000 EUR limit applies to `cust-1`

### Requirement: [BCC-BUDGET-4] Periods
`period.kind` SHALL be `month`, `quarter`, `year` or `range`. For `month`, `quarter` and `year` the amount SHALL apply
to each calendar period that starts on or after `period.from` and, when `period.to` is set, ends on or before it. For
`range` the amount SHALL apply once, from `period.from` to `period.to` inclusive. Period boundaries SHALL be computed
in UTC in v1.

#### Scenario: Monthly limit renews
- **WHEN** a monthly limit starts on 2026-01-01 and it is 2026-03-15
- **THEN** the period in effect runs from 2026-03-01T00:00:00Z to 2026-03-31T23:59:59.999Z

#### Scenario: Quarter
- **WHEN** a quarterly budget is evaluated on 2026-11-02
- **THEN** the period in effect is 2026-10-01 to 2026-12-31

#### Scenario: Outside the range
- **WHEN** a `range` budget ends on 2026-06-30 and it is 2026-07-01
- **THEN** the budget does not apply

### Requirement: [BCC-BUDGET-9] Calendar periods on boundaries
For `month`, `quarter` and `year`, `period.from` SHALL be the first day and `period.to`, when set, the last day of such
a calendar period; other values SHALL be rejected, so a budget never silently fails to apply.

#### Scenario: Fiscal year not on a calendar boundary
- **WHEN** a `year` budget is written with `from: 2026-03-01`
- **THEN** the write is rejected with a field error on `period`

### Requirement: [BCC-BUDGET-5] Mode and role override
`mode` SHALL be `approval`, `warn` or `block`; a new budget SHALL default to the unit's `defaultMode`. When the buyer
holds roles that appear in `modeByRole`, the effective mode SHALL be the strictest of those role modes
(`block` over `approval` over `warn`); otherwise it SHALL be `mode`.

#### Scenario: Role relaxes the mode
- **WHEN** a budget has mode `block` and `modeByRole: { 'purchasing-manager': 'warn' }` and the buyer holds
  `purchasing-manager`
- **THEN** the effective mode for this buyer is `warn`

#### Scenario: Two overriding roles
- **WHEN** the buyer holds two roles with overrides `warn` and `approval`
- **THEN** the effective mode is `approval`

### Requirement: [BCC-BUDGET-6] Warning threshold
`warnAtPercent` SHALL default to 80. A scope SHALL be at warning level when the projected use reaches
`warnAtPercent` of the amount and does not exceed the amount.

#### Scenario: Warning level
- **WHEN** a budget of 1,000 EUR has 700 EUR used and the cart adds 150 EUR
- **THEN** the scope is at warning level (85 %)

### Requirement: [BCC-BUDGET-7] Currency
A budget SHALL apply only to carts and orders in its own currency. A cart in another currency SHALL skip that scope
and list it in the snapshot as skipped for currency.

#### Scenario: USD cart against an EUR budget
- **WHEN** the unit has an EUR budget and the cart is in USD
- **THEN** the budget is not checked and the snapshot lists it with `skipped: 'currency'`
