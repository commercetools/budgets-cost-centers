# budget-view Specification

## Purpose

The seller's view of budgets: a Merchant Center Custom View on the Business Unit detail page to maintain cost
objects, projects, budgets and limits, see consumption, set up the Approval Rule and export spend (design §6).
Self-service for the buyer admin is the storefront's job.

## Requirements

### Requirement: [BCC-VIEW-1] Placement
The view SHALL be a Custom View of type `CustomPanel` with the locator `customers.business_unit_details.general`
([Custom View config](https://docs.commercetools.com/merchant-center-customizations/tooling-and-configuration/custom-view-config#locators))
and SHALL open for the Business Unit shown on the page.

#### Scenario: Open the panel
- **WHEN** a user opens the panel on the detail page of `unit-a`
- **THEN** the panel shows the cost objects, budgets and settings of `unit-a`

### Requirement: [BCC-VIEW-2] Cost objects
The view SHALL list the unit's own cost objects (editable) and the inherited ones (read-only, with the owner unit),
and SHALL let the user add, edit and deactivate own cost objects of all three types, including allowed buyers and
validity.

#### Scenario: Add a site
- **WHEN** the user adds a site with code `SITE-7` and name "Riverside Depot"
- **THEN** the list shows `SITE-7` and the record `unit-a~SITE-7` exists

#### Scenario: Inherited cost object
- **WHEN** the user opens a division whose parent owns `CC-100`
- **THEN** `CC-100` is shown read-only with the parent unit as owner

### Requirement: [BCC-VIEW-3] Budgets and limits
The view SHALL let the user add, edit and deactivate budgets per cost object and per unit, and limits per Associate
Role and per associate, with amount, period, mode, role overrides and warning threshold.

#### Scenario: Role limit
- **WHEN** the user adds a monthly limit of 2,000 EUR for role `buyer`
- **THEN** a budget record with scope `{ kind: 'role', ref: 'buyer' }` exists

### Requirement: [BCC-VIEW-4] Consumption
The view SHALL show per budget the period in effect, the amount, the consumed amount, the remaining amount and a bar
in the states ok, warn and exceeded, and a hint when orders in another currency exist.

#### Scenario: Budget at warning level
- **WHEN** a budget of 1,000 EUR has 850 EUR consumed
- **THEN** the bar shows 85 % in the warn state

### Requirement: [BCC-VIEW-5] Settings
The view SHALL let the user edit the unit settings: default mode, cost object required, default cost object.

#### Scenario: Require a cost object
- **WHEN** the user switches on "Cost object required"
- **THEN** the unit's settings record has `costObjectRequired: true`

### Requirement: [BCC-VIEW-6] Project overview
For a project the view SHALL show the overview of BCC-PROJ-1 and the project fields of BCC-PROJ-4.

#### Scenario: Open a project
- **WHEN** the user opens project `PRJ-1001`
- **THEN** the overview lists its lists, carts, quotes and orders with budget, consumed and remaining

### Requirement: [BCC-VIEW-7] CSV export
The view SHALL export the spend report of BCC-SPEND-4 for the unit and a chosen period as CSV in the browser, with
the columns unit, cost object, type, externalId, period, budget, consumed, remaining, order count.

#### Scenario: Export
- **WHEN** the user exports Q4 2026 for `unit-a`
- **THEN** the browser downloads a CSV with a header row and one row per cost object

### Requirement: [BCC-VIEW-8] Concurrent edits
Every write SHALL send the Custom Object version it read. On a version conflict the view SHALL keep the user's input,
show that someone else changed the record and offer to reload.

#### Scenario: Conflict
- **WHEN** two users edit the same budget and the second saves after the first
- **THEN** the second user sees a conflict message and the first user's change is not overwritten

### Requirement: [BCC-VIEW-9] Permissions
A user with only the view permission SHALL see all data and no editing or setup controls.

#### Scenario: Read-only user
- **WHEN** a user without the manage permission opens the panel
- **THEN** no add, edit, deactivate or setup control is shown

### Requirement: [BCC-VIEW-10] Text and design system
All UI text of the view SHALL be English and come from message files, including field labels in error messages.
Validation messages from `core` and error texts from the platform MAY be shown as received, inside a message-file
frame. The view SHALL use the Nimbus design system.

#### Scenario: No hard-coded text
- **WHEN** the i18n test scans the view's components
- **THEN** every user-facing string comes from a message file
