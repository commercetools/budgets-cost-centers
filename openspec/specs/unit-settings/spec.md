# unit-settings Specification

## Purpose

Per Business Unit settings: default mode, whether a cost object is required, the default cost object, and the
Approval Rule coverage that the fail-safe relies on (design §4.1, §5.3).

## Requirements

### Requirement: [BCC-SET-1] Settings record
The system SHALL store at most one settings record per Business Unit in the container `bcc-settings` with the key
equal to the Business Unit key and the value `{ defaultMode, costObjectRequired, defaultCostObject?, costObjectLevel,
features: { projects }, approval: { ruleKey?, ruleId?, requesterRoles, checkedAt? } }`.

#### Scenario: Store settings
- **WHEN** the settings of `unit-a` are saved
- **THEN** a Custom Object `bcc-settings/unit-a` holds the value

### Requirement: [BCC-SET-2] Defaults and resolution
The effective settings of a unit SHALL be its own record; without one, the record of the nearest ancestor; without
any, the defaults `{ defaultMode: 'approval', costObjectRequired: false, costObjectLevel: 'order',
features: { projects: true }, approval: { requesterRoles: [] } }`.

#### Scenario: Division without settings
- **WHEN** `division-a1` has no settings and its parent `unit-a` requires a cost object
- **THEN** `division-a1` requires a cost object

#### Scenario: Division saves its own record
- **WHEN** a user saves settings for `division-a1`, which has no record and inherits `costObjectRequired: true`
- **THEN** the new record holds `costObjectRequired: true` and every other inherited value, except the approval
  coverage (BCC-APPR-2)

#### Scenario: No settings anywhere
- **WHEN** no unit in the chain has settings
- **THEN** the defaults apply

### Requirement: [BCC-SET-3] Order-level cost objects only in v1
`costObjectLevel` SHALL accept only `order` in v1; `line` SHALL be rejected with a message that line level is
reserved.

#### Scenario: Line level requested
- **WHEN** settings with `costObjectLevel: 'line'` are written
- **THEN** the write is rejected

### Requirement: [BCC-SET-4] Default cost object
`defaultCostObject`, when set, SHALL be the key of a cost object visible to the unit; this is checked on write. On
read a default that is no longer visible SHALL NOT invalidate the record.

#### Scenario: Default from another company
- **WHEN** `unit-a` sets `defaultCostObject` to `unit-b~CC-1`
- **THEN** the write is rejected
