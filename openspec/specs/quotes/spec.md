# quotes Specification

## Purpose

A quote request does not inherit the cart's custom fields, and an order created from a quote has no `custom` field
in its draft and no documented copy from the quote (design §12 items 4 and 7,
[Quote Requests](https://docs.commercetools.com/api/projects/quote-requests)). The `service` app copies the cost
object so quotes and their orders show up in the project overview and count as consumption.

## Requirements

### Requirement: [BCC-QUOTE-1] Cost object on quote request Create
On quote request `Create` the Extension SHALL set `bccCostObject` from the source cart when the quote request does not
carry one, and SHALL validate the resulting cost object as for carts (BCC-CART-3). Staged quotes and quotes inherit
it from the quote request.

#### Scenario: Copy from the cart
- **WHEN** a quote request is created from a cart with `bccCostObject: unit-a~PRJ-1001`
- **THEN** the quote request carries `bccCostObject: unit-a~PRJ-1001`

#### Scenario: Explicit value wins
- **WHEN** the quote request draft already sets `bccCostObject`
- **THEN** the Extension keeps that value

### Requirement: [BCC-QUOTE-2] Cost object on order Create from a quote
On order `Create` for an order that references a quote, the Extension SHALL set `bccCostObject` from the quote.
Assumption: the order Create Extension may return `setCustomType` and `setCustomField` (verified in the sandbox during
Stage 0).

#### Scenario: Order from a quote
- **WHEN** an order is created from a quote with `bccCostObject: unit-a~PRJ-1001`
- **THEN** the order carries `bccCostObject: unit-a~PRJ-1001` and counts toward that project's budget
