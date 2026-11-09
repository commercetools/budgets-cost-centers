# Features

One entry per capability, with the files that implement it. Requirement IDs are in `openspec/specs/`.

| Capability | What it does | Files |
| --- | --- | --- |
| cost-objects | Cost centers, projects and sites per Business Unit, inherited by divisions, with buyers and validity | `core/src/cost-object.ts`, `core/src/keys.ts`, `core/src/hierarchy.ts`, `service/src/cost-object-check.ts` |
| budgets | Budgets per cost object or unit, limits per role or associate, calendar periods, modes and role overrides | `core/src/budget.ts`, `core/src/period.ts`, `core/src/scopes.ts`, `core/src/evaluate.ts` |
| unit-settings | Default mode, required cost object, default cost object, Approval Rule coverage | `core/src/settings.ts`, `core/src/hierarchy.ts`, `service/src/unit-context.ts` |
| consumption | Spend from orders, net amounts, spend report and CSV | `core/src/consumption.ts`, `core/src/report.ts`, `service/src/consumption-query.ts` |
| cart-check | Budget snapshot on every B2B cart change and the order guard | `service/src/cart-check.ts`, `service/src/order-guard.ts`, `core/src/snapshot.ts`, `service/src/app.ts` |
| approval | Native Approval Rule routing, fail-safe for uncovered roles, approval status on the order | `core/src/evaluate.ts`, `core/src/approval-status.ts`, `ledger/src/handle.ts` |
| quotes | Cost object on quote requests and on orders from quotes | `service/src/quote-request.ts`, `service/src/order-guard.ts` |
| projects | Project status and validity, retention of project carts | `core/src/cost-object.ts`, `core/src/snapshot.ts`, `service/src/connector/types.ts` |
| deployment | Composable Custom Types, Extension and Subscription registration, per-app scopes, reproducible Connect build | `connect.yaml`, `service/src/connector/`, `ledger/src/connector/`, `shared/src/scopes.ts`, `tools/connect-build-check.mjs`, `tools/sync-view-core.mjs` |
| budget-view | Merchant Center Custom View on the Business Unit page | `budget-view/` |
| seed | Fictional reference data for a sandbox project | `seed/`, `tools/run-local.mjs` |
| labs-package | Labs files, trace check, package check, Connect build check | `README.md`, `tools/trace.mjs`, `tools/package-check.mjs`, `tools/connect-build-check.mjs` |

## Platform features

Every platform feature the package uses, with its documentation page. None carried a beta label when checked on
2026-10-30; `node tools/package-check.mjs` fails when an entry is marked beta.

- API Extensions: https://docs.commercetools.com/api/projects/api-extensions
- Subscriptions: https://docs.commercetools.com/api/projects/subscriptions
- Messages and querying Messages: https://docs.commercetools.com/api/projects/messages
- Custom Objects: https://docs.commercetools.com/api/projects/custom-objects
- Custom Types and Custom Fields: https://docs.commercetools.com/api/projects/types
- Business Units: https://docs.commercetools.com/api/projects/business-units
- Associate Roles: https://docs.commercetools.com/api/projects/associate-roles
- Approval Rules: https://docs.commercetools.com/api/projects/approval-rules
- Approval Flows: https://docs.commercetools.com/api/projects/approval-flows
- Quote Requests, Staged Quotes and Quotes: https://docs.commercetools.com/api/quotes-overview
- Shopping Lists: https://docs.commercetools.com/api/projects/shoppingLists
- GraphQL API: https://docs.commercetools.com/api/graphql
- Connect (service, event and Custom View applications, common modules): https://docs.commercetools.com/connect/overview
- Merchant Center Custom Views: https://docs.commercetools.com/merchant-center-customizations/custom-views
