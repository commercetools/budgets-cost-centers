# consumption Specification

## Purpose

Consumption is what has been spent against a scope in its period. In v1 it is computed live from orders; the ledger
bookkeeping follows later (design §5.1, §13).

## Requirements

### Requirement: [BCC-SPEND-1] Which orders count
An order SHALL count toward a scope when it matches the scope (BCC-BUDGET-3), was created inside the period in
effect, is in the budget's currency, has an `orderState` other than `Cancelled`, and does not have
`custom.bccApprovalStatus = rejected`. Orders pending approval SHALL count.

#### Scenario: Cancelled order
- **WHEN** an order in the period has `orderState: Cancelled`
- **THEN** it does not count

#### Scenario: Rejected approval
- **WHEN** an order has `bccApprovalStatus: rejected`
- **THEN** it does not count

#### Scenario: Pending approval
- **WHEN** an order has `bccApprovalStatus: pending`
- **THEN** it counts

### Requirement: [BCC-SPEND-2] Amount of an order or cart
The amount of an order or cart SHALL be `taxedPrice.totalNet` when `taxedPrice` is present and `totalPrice`
otherwise. `taxedPrice` exposes `totalNet` and `totalGross`
([Net prices, gross prices, and tax](https://docs.commercetools.com/learning-model-b2b-commerce/configure-b2b-pricing/net-and-gross-prices-and-tax)).
Assumption: without `taxedPrice`, `totalPrice` is net in a typical B2B setup (`includedInPrice: false`).

#### Scenario: Taxed order
- **WHEN** an order has `totalPrice` 1,320 EUR and `taxedPrice.totalNet` 1,100 EUR
- **THEN** its amount is 1,100 EUR

### Requirement: [BCC-SPEND-3] Projected use
The projected use of a scope for a cart SHALL be the consumption of the scope plus the cart's amount. A cart that
is being re-checked SHALL NOT count twice: carts are never part of consumption, only orders are.

#### Scenario: Projected use
- **WHEN** a scope has 700 EUR consumed and the cart amount is 150 EUR
- **THEN** the projected use is 850 EUR

### Requirement: [BCC-SPEND-4] Spend report
For a unit and a period, the system SHALL report one row per cost object and per cost-object budget whose period in
effect is exactly the report period (one row without budget when none matches): unit, cost object code, type,
externalId, period, budget, consumed, remaining and order count. Orders in another currency SHALL be counted
separately and flagged. Free-text cells that start like a spreadsheet formula SHALL be exported as text.

#### Scenario: Report rows
- **WHEN** `unit-a` has two cost objects with budgets in Q4
- **THEN** the report has one row per cost object with the nine columns
