# service

Connect `service` app of Budgets, Cost Centers & Projects. It is an API Extension that keeps every B2B cart stamped
with its budget status, guards order creation, and carries the cost object through quotes. The native Approval Rule on
`custom.bccBudgetExceeded = true` then holds over-budget orders for approval.

This is commercetools Labs reference code under the MIT license. It is not a supported product: review, test and
operate it as your own code.

## What it does

- **Cart `Create` and `Update`** (only carts with a Business Unit, through the trigger condition
  `businessUnit is defined`): resolves the cost object (cart value, else the unit's default when this buyer can use
  it), validates it, finds the budgets and limits that apply, computes consumption from orders, and writes
  `bccBudgetStatus`, `bccBudgetExceeded`, `bccBudgetScopes` and `bccCheckedAt`. It returns update actions only when
  a value changed. A cart on a project is kept for `BCC_PROJECT_RETENTION_DAYS`.
- **Order `Create`** from a cart: rejects the order when the cart was never checked, is `blocked`, or has no cost
  object while the unit requires one, and re-validates the cost object, so a project closed after the last cart update
  cannot be ordered against. It does not recompute consumption. From a quote: copies `bccCostObject` from the quote;
  orders from quotes are not budget-checked in this version.
- **Quote request `Create`**: copies `bccCostObject` from the cart, because the platform does not, and validates it.

Budget outcomes never fail a cart update, so buyers can always remove items. Only an invalid cost object, a cart
Custom Type other than the configured one, or an order type that cannot be resolved fails a cart update, with a
buyer-readable message.

## Fail-safe and fail-closed

| Situation | Behaviour |
| --- | --- |
| Consumption cannot be computed (platform error, internal time budget of 1,500 ms) | Cart marked `exceeded` with scopes `{"error":"unchecked"}`, so the order goes to approval; `blocked` when no Approval Rule covers the buyer or coverage is unknown |
| A budget or settings record is corrupt | Same as above: the cart is never marked `ok` on bad data |
| The order type does not exist or cannot be read | The cart update fails ("The budget check is not set up: the Custom Type <key> is missing." or "The budget could not be checked. Please try again."), so no stale snapshot is kept |
| The order guard cannot read the platform | Order rejected with "The budget could not be checked. Please try again." |
| Quote request: the cost object cannot be copied because of a platform error | Quote request created without it (logged) |

The Extension uses the platform's default timeout of 2 seconds. A `sandbox` or `preview` Connect deployment sleeps
when idle and needs longer than that to start, so the first cart call after a pause can fail with
`ExtensionNoResponse` (seen on a preview deployment after about 20 idle minutes); use a `production` deployment for
anything beyond a demo.

## Scopes

The service brings its own API Client with exactly `view_orders`, `view_quotes`, `view_business_units`,
`view_key_value_documents`, `view_types`, `manage_types` and `manage_extensions`. `postDeploy` fails before any
request when `CTP_SCOPE` holds any other scope or lacks one of these, and names them. The running Extension requests a token with the `view_*` scopes only;
`manage_types` and `manage_extensions` are used by `postDeploy` and `preUndeploy` alone. The connector does not use
`inheritAs.apiClient`, because it creates one client for all apps and the service endpoint, which is reachable from the internet, would then also hold `manage_orders`.

## Configuration

| Key | Kind | Default | Purpose |
| --- | --- | --- | --- |
| `CTP_PROJECT_KEY` | standard, required | | Project key |
| `CTP_REGION` | standard, required | | Region of the Project, for example `europe-west1.gcp` |
| `BCC_ORDER_TYPE_KEY` | standard | `bcc-order` | Custom Type for carts and orders, created or extended with the `bcc` fields |
| `BCC_LINE_ITEM_TYPE_KEY` | standard | `bcc-line-item` | Custom Type for line items (field reserved) |
| `BCC_SHOPPING_LIST_TYPE_KEY` | standard | `bcc-shopping-list` | Custom Type for shopping lists |
| `BCC_QUOTE_TYPE_KEY` | standard | `bcc-quote` | Custom Type for quote requests, staged quotes and quotes |
| `BCC_PROJECT_RETENTION_DAYS` | standard | `365` | Days a project cart is kept after its last change (1 to 365250) |
| `BCC_CACHE_SECONDS` | standard | `60` | Seconds the cart check keeps units, settings, cost objects and budgets (0 to 3600, 0 is off); panel changes reach carts after at most this delay. Orders are always read live |
| `CTP_CLIENT_ID` | secured, required | | Client ID of the service API Client |
| `CTP_CLIENT_SECRET` | secured, required | | Secret of the service API Client |
| `CTP_SCOPE` | secured, required | | The seven scopes above, each as `<scope>:<projectKey>` |
| `BCC_EXTENSION_SECRET` | secured, required | | Shared secret for the Extension `Authorization` header, at least 32 characters |

If your Project already has a Custom Type for carts and orders, set `BCC_ORDER_TYPE_KEY` to its key: `postDeploy` adds
the missing `bcc` fields and changes nothing else. A field with the same name and another type stops `postDeploy`
with a message naming the field.

## Lifecycle

- `postDeploy` checks the scopes, creates or extends the four Custom Types, and registers the Extension `bcc-service`
  with `AuthorizationHeader` authentication, updating it in place when it exists.
- `preUndeploy` removes the Extension. Custom Types, fields and Custom Objects stay, because they hold customer data.

## Endpoints

- `POST /service`: Extension input. `401` without the expected `Authorization: Bearer <BCC_EXTENSION_SECRET>`.
- `GET /service/health`: `200`.

## Develop

```bash
npm install
npm test
npm run build
```
