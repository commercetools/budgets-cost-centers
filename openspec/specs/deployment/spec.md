# deployment Specification

## Purpose

The package installs with Connect plus a one-time Custom View registration in the Merchant Center and coexists with the customer's own Custom Types. `postDeploy`
prepares types, the Extension and the Subscription; `preUndeploy` removes what would break or keep calling, and leaves
data in place (design §3, §4.2).

Each app has its own API Client. `inheritAs.apiClient.scopes` is not used: it is a top-level key and creates one API
Client for the whole Connector
([Automatically generate API Client credentials](https://docs.commercetools.com/connect/modify-connector)), so the
`service` endpoint, which is reachable from the internet, would also hold `manage_orders`.

## Requirements

### Requirement: [BCC-DEPLOY-1] Composable Custom Types
For each resource type (`order` for carts and orders, `line-item`, `shopping-list`, `quote` for quote requests,
staged quotes and quotes) the type key SHALL be configuration. When the type exists, `postDeploy` SHALL add the
missing `bcc*` fields as optional fields and SHALL NOT change or remove other fields. When it does not exist,
`postDeploy` SHALL create it. A field with the same name and another type SHALL fail `postDeploy` with a message
naming the field.

#### Scenario: Customer already has an order type
- **WHEN** the configured order type `shop-order` exists with the field `poReference`
- **THEN** after `postDeploy` it holds `poReference` and the `bcc*` order fields

#### Scenario: Re-run
- **WHEN** `postDeploy` runs twice
- **THEN** the second run changes nothing

#### Scenario: Conflicting field
- **WHEN** the order type has `bccBudgetStatus` as a String field
- **THEN** `postDeploy` fails with a message naming `bccBudgetStatus`

### Requirement: [BCC-DEPLOY-2] Fields per resource
The order type SHALL hold `bccCostObject` (String), `bccBudgetStatus` (Enum `ok`, `warn`, `exceeded`, `blocked`,
`none`), `bccBudgetExceeded` (Boolean), `bccBudgetScopes` (String), `bccCheckedAt` (DateTime) and
`bccApprovalStatus` (Enum `pending`, `approved`, `rejected`). The line-item type SHALL hold `bccCostObject`
(reserved). The shopping-list and quote types SHALL hold `bccCostObject`.

#### Scenario: Order type fields
- **WHEN** `postDeploy` created the order type
- **THEN** it has the six `bcc*` fields with these types

### Requirement: [BCC-DEPLOY-3] Extension registration
`postDeploy` of `service` SHALL register the Extension with key `bcc-service` get-then-update, with
`AuthorizationHeader` authentication and the triggers cart `Create` and `Update` (condition
`businessUnit is defined`), order `Create` (condition `businessUnit is defined`) and quote-request `Create`.

#### Scenario: Registration is verified
- **WHEN** `postDeploy` finished
- **THEN** `GET /extensions/key=bcc-service` returns the three triggers

### Requirement: [BCC-DEPLOY-4] Subscription registration
`postDeploy` of `ledger` SHALL register the Subscription with key `bcc-ledger` for the Messages
`ApprovalFlowCreated` and `ApprovalFlowCompleted` of resource type `approval-flow` and `ApprovalRuleStatusSet`,
`ApprovalRuleRequestersSet` and `ApprovalRulePredicateSet` of resource type `approval-rule`, on the destination
Connect provides.

#### Scenario: Only the needed message types
- **WHEN** `postDeploy` finished
- **THEN** the Subscription `bcc-ledger` lists exactly these five message types

### Requirement: [BCC-DEPLOY-5] Undeploy
`preUndeploy` SHALL remove the Extension `bcc-service` and the Subscription `bcc-ledger` and SHALL leave Custom Types,
Custom Fields and Custom Objects in place, because they hold customer data. The README SHALL say so.

#### Scenario: Undeploy
- **WHEN** the connector is undeployed
- **THEN** carts no longer call the Extension and the `bcc*` fields and records remain

### Requirement: [BCC-DEPLOY-6] Least-privilege scopes
Each Connect app SHALL use its own API Client from its `securedConfiguration` (`CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`,
`CTP_SCOPE`) with only these scopes: `service`: `view_orders`, `view_quotes`, `view_business_units`,
`view_key_value_documents`, `view_types`, `manage_types`, `manage_extensions`; `ledger`: `manage_orders`,
`view_types`, `view_messages`, `manage_key_value_documents`, `manage_subscriptions`. `postDeploy` SHALL fail when
`CTP_SCOPE` holds any other scope or lacks one of these.

#### Scenario: No project-wide scope
- **WHEN** `postDeploy` of `service` runs with `CTP_SCOPE` containing `manage_project:demo`
- **THEN** it fails with a message naming `manage_project`

#### Scenario: Missing scope
- **WHEN** `CTP_SCOPE` of `service` lacks `manage_extensions`
- **THEN** `postDeploy` fails with a message naming the missing scopes

#### Scenario: No shared client
- **WHEN** the scope test reads `connect.yaml`
- **THEN** it holds no `inheritAs.apiClient` and each app declares its own `CTP_CLIENT_ID`

### Requirement: [BCC-DEPLOY-7] Generally available features only
The package SHALL use only generally available platform features (design §12 item 15).

#### Scenario: Feature list
- **WHEN** a release is prepared
- **THEN** every platform feature in `FEATURES.md` is listed without a beta label in the documentation

### Requirement: [BCC-DEPLOY-8] View scopes
The view SHALL request the view scopes `view_key_value_documents`, `view_orders`, `view_quotes`,
`view_quote_requests`, `view_shopping_lists`, `view_business_units`, `view_associate_roles`, `view_customers`,
`view_approval_rules` and the manage scopes `manage_key_value_documents`, `manage_approval_rules`, and nothing else.

#### Scenario: View config
- **WHEN** the scope test reads `custom-view-config.mjs`
- **THEN** `oAuthScopes` holds exactly these scopes

### Requirement: [BCC-DEPLOY-9] Runtime tokens without lifecycle scopes
Running apps SHALL request their tokens without `manage_types`, `manage_extensions` and `manage_subscriptions`, which
only `postDeploy` and `preUndeploy` use, and SHALL abort platform calls after a timeout.

#### Scenario: Read-only service at runtime
- **WHEN** the service app starts
- **THEN** its token holds only `view_*` scopes

### Requirement: [BCC-DEPLOY-10] Reproducible Connect build
Each app in `connect.yaml` SHALL build from a clean checkout of the tag with `npm ci` and `npm run build`, also when
`NODE_ENV` is `production`, and SHALL pass the Connect SCA step: every lock file is in sync with its `package.json`, no
dependency has a critical advisory, the Custom View builds from its own folder, and `service` and `ledger` install each
common module with its dev dependencies, which hold the compiler
([Share code across Connect applications](https://docs.commercetools.com/connect/common-modules)).

#### Scenario: Production build of a common module
- **WHEN** the build of `service` runs with `NODE_ENV=production`
- **THEN** it installs `core` and `shared` with `--include=dev`, so `tsc` is found

#### Scenario: Self-contained Custom View
- **WHEN** the Connect build of `budget-view` runs, which sees only the `budget-view` folder
- **THEN** the view needs nothing outside its folder: no `file:` dependency and no `../` in its build script, and its
  copy of `core` in `src/core` is identical to `core/src`

#### Scenario: Classic JSX runtime, as Connect builds it
- **WHEN** Connect builds `budget-view`, which uses neither the environment of its `build` script nor its
  `connect.yaml` configuration values for the build, so `mc-scripts` compiles JSX with its default classic runtime
- **THEN** every `.tsx` file with JSX imports `React`, and neither the scripts nor the test config set
  `ENABLE_NEW_JSX_TRANSFORM`, so tests and local builds compile JSX the same way

#### Scenario: Critical advisory
- **WHEN** an app or common module has a dependency with a critical advisory
- **THEN** the build check fails and names the folder and the package, because the Connect SCA step fails on it

#### Scenario: Lock file out of sync
- **WHEN** a `package.json` of an app or common module no longer matches its `package-lock.json`
- **THEN** the build check fails and names the folder
