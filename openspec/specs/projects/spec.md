# projects Specification

## Purpose

A project is a cost object of type `project` and also a business object: status, validity, site address, ERP
project number, and an overview of what was bought for it (design §5.5).

## Requirements

### Requirement: [BCC-PROJ-1] Project overview
For a project, the system SHALL list the shopping lists, active carts, quote requests, quotes and orders that carry
its key, together with budget, consumption and remaining amount per budget of the project.

#### Scenario: Overview
- **WHEN** project `unit-a~PRJ-1001` has one shopping list, two carts, one quote and three orders
- **THEN** the overview lists all seven with their totals and the project budget with consumed and remaining

### Requirement: [BCC-PROJ-2] Shopping lists carry the project
Shopping lists SHALL carry `bccCostObject` through the configured shopping-list type, so a project material list is
durable beyond cart retention.

#### Scenario: Project list
- **WHEN** a shopping list has `bccCostObject: unit-a~PRJ-1001`
- **THEN** it appears in the project overview

### Requirement: [BCC-PROJ-3] Cart retention for project carts
When a cart carries a project cost object, the Extension SHALL set `deleteDaysAfterLastModification` to the
configured project retention (default 365 days) if the cart has a lower value. Carts are removed after
`lastModifiedAt + deleteDaysAfterLastModification`, project default 90 days, allowed 1 to 365250
([General concepts](https://docs.commercetools.com/api/general-concepts#automatic-cleanup)).

#### Scenario: Phase cart
- **WHEN** a cart gets the project `unit-a~PRJ-1001`
- **THEN** its `deleteDaysAfterLastModification` is 365

### Requirement: [BCC-PROJ-4] Project lifecycle in the view
The view SHALL let the user set a project to `planned`, `active` or `closed` and edit site address and ERP project
number. Carts on a project that is not `active` fail validation (BCC-CART-3).

#### Scenario: Close a project
- **WHEN** the user closes project `unit-a~PRJ-1001`
- **THEN** the record has `project.status: closed` and the next update of its carts fails
