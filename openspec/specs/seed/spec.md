# seed Specification

## Purpose

An optional reference data set for a sandbox project. It is the base of the end-to-end tests and lets a reader try
the view without their own data (design §10, §11).

## Requirements

### Requirement: [BCC-SEED-1] Fictional and labelled
Every seeded name, code, address and amount SHALL be invented, and every seeded record that has a description or name
field SHALL mark it as fictional.

#### Scenario: Seeded unit
- **WHEN** the seed created the unit `bcc-demo-installer`
- **THEN** its name ends with "(fictional)"

### Requirement: [BCC-SEED-2] Idempotent by key
The seed SHALL create or update every record by key and SHALL change nothing on a second run.

#### Scenario: Second run
- **WHEN** the seed runs twice against the same project
- **THEN** the second run reports zero changes

### Requirement: [BCC-SEED-3] Content
The seed SHALL create two units, one division, Associate Roles with and without order permissions, associates, cost
objects of all three types (one project with two phase carts and a shopping list), budgets in all three modes, one
role limit, settings and an Approval Rule with the budget predicate.

#### Scenario: Coverage of the e2e flows
- **WHEN** the seed has run
- **THEN** each mode `approval`, `warn` and `block` has at least one budget a seeded buyer can exceed

### Requirement: [BCC-SEED-4] Safety
The seed SHALL refuse to run unless the target project key is given explicitly and matches the configured sandbox key.

#### Scenario: Wrong project
- **WHEN** the seed is started with a project key that differs from `CTP_PROJECT_KEY` in the secrets file
- **THEN** it exits without writing
