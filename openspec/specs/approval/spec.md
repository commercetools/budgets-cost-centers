# approval Specification

## Purpose

Over-budget orders go through the platform's own approval: a native Approval Rule on
`custom.bccBudgetExceeded = true`. This package adds no approval engine and no order states. It keeps a fail-safe for
roles no rule covers, helps set the rule up, and records the approval outcome on the order so consumption can
exclude rejected orders (design §5.3, §5.4, §12 items 11, 12, 19).

Platform facts: `custom.<name>` is a valid Order Predicate identifier, and a rule applies only to orders created by an
associate holding a requester role
([Approval Flows](https://docs.commercetools.com/api/projects/approval-flows),
[Predicates and requesters](https://docs.commercetools.com/learning-model-b2b-commerce/configure-approval-workflows/approval-rules-predicates-and-requesters)).
Approval Rules are readable and writable only through `as-associate` endpoints
([Approval Rules](https://docs.commercetools.com/api/projects/approval-rules)).

## Requirements

### Requirement: [BCC-APPR-1] Native approval through the predicate field
The package SHALL route over-budget orders only through Approval Rules whose predicate is exactly
`custom.bccBudgetExceeded = true`; a rule with further conditions does not count as coverage, because over-budget
orders that miss its conditions would pass without approval. The package SHALL NOT define order states.

#### Scenario: Conditional rule
- **WHEN** the only budget rule has the predicate `custom.bccBudgetExceeded = true and totalPrice.centAmount > 1000000`
- **THEN** no role counts as covered and over-budget carts with mode `approval` are blocked

#### Scenario: Over budget with a covering rule
- **WHEN** a covered buyer orders a cart with `bccBudgetExceeded: true`
- **THEN** the platform creates an Approval Flow for the order

### Requirement: [BCC-APPR-2] Fail-safe for uncovered roles
The covered roles of a unit SHALL be `approval.requesterRoles` of its own settings record, not inherited settings;
for a division with `approvalRuleMode: ExplicitAndFromParent` the covered roles of its parent SHALL be added
([BusinessUnitApprovalRuleMode](https://docs.commercetools.com/api/projects/business-units)). When the effective mode
of an exceeded scope is `approval` and the buyer holds no covered role, the effective mode SHALL be `block`.

#### Scenario: Explicit division without its own record
- **WHEN** `division-a2` has `approvalRuleMode: Explicit`, no settings record, and its parent covers `buyer`
- **THEN** no role is covered in `division-a2`

#### Scenario: Division record does not copy coverage
- **WHEN** the view writes the first own settings record of `division-a1` from its parent's effective settings
- **THEN** the record's `approval.requesterRoles` is empty until a rule check for `division-a1` fills it

#### Scenario: Uncovered buyer
- **WHEN** a buyer whose roles are not in `requesterRoles` exceeds a budget with mode `approval`
- **THEN** the cart status is `blocked`

### Requirement: [BCC-APPR-3] Rule check in the view
The view SHALL list, for the unit, the active Approval Rules whose predicate mentions `bccBudgetExceeded`, mark
those that count as coverage (BCC-APPR-1),
SHALL warn about roles that hold `CreateMyOrdersFromMyCarts` or `CreateOrdersFromOthersCarts` and are missing from
the requesters, and SHALL refresh `approval.requesterRoles`, `approval.ruleKey`, `approval.ruleId` and
`approval.checkedAt` in the unit's settings. The check SHALL run as an associate of the unit that the user picks.

#### Scenario: Missing requester role
- **WHEN** role `site-buyer` may create orders and the budget rule lists only `buyer` as requester
- **THEN** the view warns that `site-buyer` is not covered and its over-budget orders are blocked

### Requirement: [BCC-APPR-4] Rule setup in the view
The view SHALL offer "Set up budget approval" when no active budget rule exists. It SHALL create the rule on behalf of
an associate of the unit chosen by the user, offering only associates holding `CreateApprovalRules` (and
`UpdateApprovalRules` for changes), with the predicate `custom.bccBudgetExceeded = true`, the requester roles and the
approver tiers the user picks, and SHALL then write the coverage to the unit's settings. The view SHALL say on whose
behalf the rule is created.

#### Scenario: Set up the rule
- **WHEN** the user picks associate `cust-admin`, requesters `buyer` and approver tier `approver`
- **THEN** an active Approval Rule exists in the unit with that predicate and the settings list `buyer` as covered

### Requirement: [BCC-APPR-5] Approval status on the order
The `ledger` app SHALL set `custom.bccApprovalStatus` on the order: `pending` on `ApprovalFlowCreated` (order from
`approvalFlow.order`), and `approved` or `rejected` from `status` on `ApprovalFlowCompleted`
([Approval Flow Messages](https://docs.commercetools.com/api/projects/messages/approval-rule-approval-flow-messages)).
A final status SHALL never be replaced by `pending`. The handler SHALL re-fetch the order and write only when the
value differs.

#### Scenario: Rejection
- **WHEN** an `ApprovalFlowCompleted` Message with `status: Rejected` arrives for order `o-1`
- **THEN** `o-1` has `bccApprovalStatus: rejected`

#### Scenario: Late creation message
- **WHEN** `ApprovalFlowCreated` arrives after `ApprovalFlowCompleted` for the same order
- **THEN** the order keeps its final status

#### Scenario: Duplicate delivery
- **WHEN** the same Message is delivered twice
- **THEN** the second delivery writes nothing

### Requirement: [BCC-APPR-6] Event handling contract
The `ledger` endpoint SHALL answer 2xx for handled Messages, for Message types it does not handle, for subscription
test messages and for orders that no longer exist. It SHALL answer 5xx only for retryable failures, so the platform
redelivers. An order with another Custom Type than the configured one SHALL be acknowledged and logged as not
writable.

#### Scenario: Unknown message type
- **WHEN** an `ApprovalFlowApproved` Message arrives
- **THEN** the endpoint acknowledges it with 204 and writes nothing

#### Scenario: Platform unavailable
- **WHEN** fetching the order fails with a 503
- **THEN** the endpoint answers 500 so the Message is redelivered

### Requirement: [BCC-APPR-7] Verified Messages
The `ledger` app SHALL read every Approval Flow Message it receives back from the Messages API by its id and SHALL
act only on the stored Message, so a forged push changes nothing and a push with `payloadNotIncluded` is handled in
full ([Messages](https://docs.commercetools.com/api/projects/messages)). This requires Messages querying to be
enabled in the Project; a Message that cannot be read back SHALL be acknowledged and logged as an error.

#### Scenario: Forged rejection
- **WHEN** a push claims `ApprovalFlowCompleted` with `status: Rejected` for `o-1` and the Messages API does not know it
- **THEN** `o-1` keeps its status and an error is logged

#### Scenario: Oversized Message
- **WHEN** an `ApprovalFlowCompleted` push arrives with `payloadNotIncluded`
- **THEN** the ledger reads the full Message and writes the status

### Requirement: [BCC-APPR-8] Coverage follows rule changes
The `ledger` app SHALL receive the Messages `ApprovalRuleStatusSet`, `ApprovalRuleRequestersSet` and
`ApprovalRulePredicateSet` and update every settings record whose `approval.ruleId` is the rule: no covered roles
when the rule becomes inactive or its predicate stops counting (BCC-APPR-1); the new requester roles when the
requesters change while coverage exists. Coverage never grows from a status change alone.

#### Scenario: Rule deactivated in the Merchant Center
- **WHEN** the budget rule of `unit-a` is set to `Inactive` outside the view
- **THEN** the settings of `unit-a` cover no role, so over-budget carts with mode `approval` are blocked

#### Scenario: Requester removed
- **WHEN** `site-buyer` is removed from the requesters of the budget rule of `unit-a`
- **THEN** `site-buyer` is no longer covered in `unit-a`

#### Scenario: Rule changed while the ledger was down
- **WHEN** the budget rule of `unit-a` is set to `Inactive` while the `ledger` is down, and the replay runs afterwards
- **THEN** the replay delivers the rule change, so the settings of `unit-a` cover no role
