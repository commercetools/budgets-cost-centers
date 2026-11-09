# labs-package Specification

## Purpose

The repository is commercetools Labs reference code: public, MIT, not supported. It states its limits, keeps its
specs traceable and contains no customer, prospect, analyst or competitor names (design §3, §13).

## Requirements

### Requirement: [BCC-PKG-1] Labs files
The repository SHALL contain `README.md` with the "commercetools-labs reference code, MIT, not supported" banner,
`SUPPORT.md`, `CONTRIBUTING.md`, `LICENSE` (MIT) and `FEATURES.md` with one entry per capability and file pointers.

#### Scenario: Files present
- **WHEN** the package check runs
- **THEN** all five files exist and the README starts with the banner

### Requirement: [BCC-PKG-2] Stated limits
The README SHALL state: live consumption without ledger; the cart-level race between two carts (design §5.2); returns
and refunds out of scope; budget approval on orders from quotes not guaranteed; recurring orders checked once, when the
recurring cart is created; imported orders not checked; Approval Rules apply only to requester roles; the view acts on behalf of an associate to manage Approval
Rules; budgets apply per currency; periods in UTC; undeploy leaves types and data.

#### Scenario: Limits section
- **WHEN** the package check reads the README
- **THEN** a section "Limits" names each of these points

### Requirement: [BCC-PKG-3] Traceability
Every requirement in `openspec/specs/` SHALL carry a unique ID `[BCC-<CAP>-<n>]`. Code and tests SHALL cite the IDs
they implement or prove. The trace check SHALL fail when an ID is duplicated, when code cites an unknown ID, or, in
strict mode, when a requirement has no implementation or no evidence.

#### Scenario: Unknown citation
- **WHEN** a test cites `BCC-COST-99` and no such requirement exists
- **THEN** the trace check fails and names the file

#### Scenario: Duplicate ID
- **WHEN** two requirements carry `BCC-COST-1`
- **THEN** the trace check fails and names both specs

### Requirement: [BCC-PKG-4] No internal content
Committed files SHALL NOT contain customer, prospect, analyst or competitor names, and `_intern/` SHALL NOT be
tracked. The check SHALL read its deny list from an untracked local file, so the list itself is never published.

#### Scenario: Internal folder staged
- **WHEN** a file under `_intern/` is staged
- **THEN** the package check fails

#### Scenario: Denied name
- **WHEN** a tracked file contains a name from the local deny list
- **THEN** the package check fails and names the file and line
