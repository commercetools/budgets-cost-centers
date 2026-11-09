# cost-objects Specification

## Purpose

Cost objects are the things spend is booked against: cost centers, projects and sites. They belong to a Business Unit,
are visible down its hierarchy, and are referenced from carts, orders, shopping lists and quotes by their key. They
are stored as Custom Objects because a resource holds only one Custom Type and customer Business Units often have one
already (design §4).

## Requirements

### Requirement: [BCC-COST-1] Cost-object record
The system SHALL store each cost object as one Custom Object in the container `bcc-cost-objects` with the value
`{ code, name, type, ownerBusinessUnitKey, active, validFrom?, validTo?, externalId?, buyers?, linkedBusinessUnitKey?,
project? }`, where `type` is one of `cost-center`, `project`, `site`.

#### Scenario: Create a cost center
- **WHEN** a cost object with code `CC-100`, type `cost-center` and owner `unit-a` is created
- **THEN** a Custom Object exists in container `bcc-cost-objects` whose value holds these fields and `active: true`

### Requirement: [BCC-COST-2] Key scheme
The Custom Object key SHALL be `<ownerBusinessUnitKey>~<code>`, with the code matching `^[-_.a-zA-Z0-9]{1,64}$`, so
the key splits unambiguously at the last `~`. A key that breaks the Custom Object key rules
`^[-_~.a-zA-Z0-9]+$`, length 1 to 256 ([Custom Objects](https://docs.commercetools.com/api/projects/custom-objects)),
SHALL be rejected with a clear message.

#### Scenario: Unit key with a character a Custom Object key does not allow
- **WHEN** a cost object is created for a unit whose key contains `@` (assumption: Business Unit keys normally use
  only allowed characters; checked in the sandbox during Stage 0)
- **THEN** the write is rejected with a message naming the unit key

#### Scenario: Key is derived from owner and code
- **WHEN** a cost object with code `PRJ-1001` is created for unit `unit-a`
- **THEN** its key is `unit-a~PRJ-1001`

#### Scenario: Invalid code
- **WHEN** a cost object with code `PRJ 1001` is created
- **THEN** the write is rejected with a field error on `code`

### Requirement: [BCC-COST-3] Value validation
The `core` library SHALL validate every cost-object value on write and on read and SHALL reject a value that breaks
the shape, with one error per offending field. A record that fails validation on read SHALL be treated as absent and
logged.

#### Scenario: Missing name
- **WHEN** a cost object without `name` is written
- **THEN** the write is rejected with a field error on `name`

#### Scenario: Corrupt record on read
- **WHEN** a stored record has `type: 'department'`
- **THEN** the record is not offered to any cart and a warning with its key is logged

### Requirement: [BCC-COST-4] Immutable keys, deactivation instead of deletion
The code and the owner of a cost object SHALL NOT change after creation; the name and all other fields MAY change. A
cost object SHALL be deactivated (`active: false`), never deleted, by this package.

#### Scenario: Rename keeps the key
- **WHEN** the name of `unit-a~CC-100` changes
- **THEN** the key and code stay the same

#### Scenario: Deactivate
- **WHEN** a user removes a cost object in the view
- **THEN** the record stays and gets `active: false`

### Requirement: [BCC-COST-5] Inheritance down the hierarchy
A Business Unit SHALL see its own cost objects plus those of every ancestor reached through `parentUnit`. A cost
object with `linkedBusinessUnitKey` SHALL be offered only in that unit.

#### Scenario: Division sees the parent's cost objects
- **WHEN** `division-a1` has parent `unit-a` and `unit-a` owns `CC-100`
- **THEN** `CC-100` is available in `division-a1`

#### Scenario: Linked cost object stays in its unit
- **WHEN** `unit-a~PRJ-1001` is linked to `division-a1`
- **THEN** it is available in `division-a1` and not in `unit-a` or any other division

### Requirement: [BCC-COST-6] Allowed buyers
A cost object with an empty or absent `buyers` list SHALL be allowed for every associate of the units that see it.
A cost object with a non-empty `buyers` list SHALL be allowed only for the listed customer IDs.

#### Scenario: Restricted cost object
- **WHEN** `CC-200` lists only buyer `cust-1` and buyer `cust-2` uses it on a cart
- **THEN** the cost object is rejected for that cart

### Requirement: [BCC-COST-7] Usability at a point in time
A cost object SHALL be usable at time `t` only when it is active, `t` lies within `validFrom` and `validTo`
(inclusive, either bound optional), and, for type `project`, `project.status` is `active`.

#### Scenario: Expired cost object
- **WHEN** a cost object has `validTo` yesterday
- **THEN** it is not usable today

#### Scenario: Planned project
- **WHEN** a project has status `planned`
- **THEN** it is not usable

### Requirement: [BCC-COST-8] Type-specific fields
The `project` field SHALL be present only on cost objects of type `project` and SHALL hold
`{ status: 'planned' | 'active' | 'closed', siteAddress?, erpProjectNumber? }`.

#### Scenario: Project field on a cost center
- **WHEN** a cost object of type `cost-center` is written with a `project` field
- **THEN** the write is rejected with a field error on `project`
