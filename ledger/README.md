# ledger

Connect `event` app of Budgets, Cost Centers & Projects. It listens to the Approval Flow Messages
`ApprovalFlowCreated` and `ApprovalFlowCompleted` and writes the outcome onto the order as
`custom.bccApprovalStatus` (`pending`, `approved`, `rejected`). Spend reports use it to leave rejected orders out. It
also listens to `ApprovalRuleStatusSet`, `ApprovalRuleRequestersSet` and `ApprovalRulePredicateSet` (see Coverage
follows rule changes).

This is commercetools Labs reference code under the MIT license. It is not a supported product: review, test and
operate it as your own code.

## What it does

- `ApprovalFlowCreated` sets `pending` on the order in `approvalFlow.order`, unless the order already has a status.
- `ApprovalFlowCompleted` sets `approved` or `rejected` from `status`.
- A final status is never replaced by `pending`, so late or out-of-order Messages do no harm.
- The handler re-fetches the order and writes only when the value changes, so a duplicate delivery writes nothing.
- An order without Custom Fields gets the order type (`BCC_ORDER_TYPE_KEY`) with the field. An order that carries
  another Custom Type is not touched; the handler logs
  `Order <id> has another Custom Type; approval status not written.` and acknowledges the Message.

## Acknowledge or retry

Connect delivers each Message as a Pub/Sub push request to `POST /ledger` and redelivers on any answer other than
`102`, `200`, `201`, `202` or `204`.

The ledger answers `204` (acknowledged, never redelivered) for:

- a Message it wrote,
- a Message that changes nothing (duplicate, late `ApprovalFlowCreated`),
- Message types it does not handle and notifications other than Messages, such as the `ResourceCreated` test
  message the platform sends when the Subscription is created,
- a malformed envelope (missing `message.data`, bad base64, bad JSON), because redelivery cannot fix it,
- an order that no longer exists,
- an order with another Custom Type,
- an update the platform rejects as invalid (`400`), logged as an error.

It answers `500` (redelivered) for transient failures only:

- reading the order fails with anything but `404`,
- the order type cannot be read or does not exist yet,
- the update fails with a version conflict (`409`), `401`, `403`, `429`, a `5xx` or a network error.

`GET /ledger/health` answers `200`.

## Scopes

The ledger brings its own API Client. Its scopes are exactly `manage_orders`, `view_types`, `view_messages`,
`manage_key_value_documents` and `manage_subscriptions`. `postDeploy` fails before any request when `CTP_SCOPE`
holds any other scope or lacks one of these, and names them. The running app requests its token without
`manage_subscriptions`, which only `postDeploy` and `preUndeploy` use.

## Verified Messages

The ledger never trusts the pushed payload. It reads every Approval Flow Message back from the Messages API by its id
and acts on the stored Message only. A forged push therefore changes nothing, and a push with `payloadNotIncluded`
(too big for the queue) is handled in full. This requires **Messages querying enabled** in the Project (Merchant
Center: Settings > Developer settings, or the Project update action `changeMessagesConfiguration`). A Message that
cannot be read back is retried for five minutes after its creation, in case persistence lags behind the push, and then
acknowledged and logged as an error naming its id.

## Coverage follows rule changes

The ledger also receives `ApprovalRuleStatusSet`, `ApprovalRuleRequestersSet` and `ApprovalRulePredicateSet`. For
every unit whose settings name the changed rule (`approval.ruleId`), it narrows the covered roles to the new
requesters, or clears them when the rule becomes inactive or its predicate is no longer exactly
`custom.bccBudgetExceeded = true`. Coverage never grows from such a change: the next rule check in the view restores
it. Cleared coverage makes over-budget carts with mode `approval` blocked, never unapproved.

## Configuration

| Key | Kind | Default | Purpose |
| --- | --- | --- | --- |
| `CTP_PROJECT_KEY` | standard, required | | Project key |
| `CTP_REGION` | standard, required | | Region of the Project, for example `europe-west1.gcp` |
| `BCC_ORDER_TYPE_KEY` | standard | `bcc-order` | Key of the Custom Type for carts and orders; same value as for `service` |
| `CTP_CLIENT_ID` | secured, required | | Client ID of the ledger API Client |
| `CTP_CLIENT_SECRET` | secured, required | | Secret of the ledger API Client |
| `CTP_SCOPE` | secured, required | | `manage_orders view_types view_messages manage_key_value_documents manage_subscriptions`, each as `<scope>:<projectKey>` |

Connect sets `CONNECT_SUBSCRIPTION_DESTINATION`, `CONNECT_GCP_TOPIC_NAME`, `CONNECT_GCP_PROJECT_ID` and
`CONNECT_AWS_TOPIC_ARN` for `postDeploy`, and `PORT` for the app (default `8080`). For local runs, `CTP_AUTH_URL`
and `CTP_API_URL` can replace `CTP_REGION`.

## Deploy and undeploy

`postDeploy` creates the Subscription `bcc-ledger` for `ApprovalFlowCreated` and `ApprovalFlowCompleted` of resource
type `approval-flow` and the three Approval Rule Messages above of resource type `approval-rule` on the destination Connect provides (Google Cloud Pub/Sub or AWS SNS). Run again, it updates the
existing Subscription in place (`changeDestination`, `setMessages`) and never deletes it, so no Message is lost.

`preUndeploy` deletes the Subscription `bcc-ledger` and nothing else. Custom Types, Custom Fields on orders and all
Custom Objects stay in place, because they hold customer data. Remove them by hand if you need to.

The order type itself is created by the `service` app; deploy `service` before the first approval happens.

## Replay runbook

Use this when the ledger missed Messages, for example after it was undeployed or failed for longer than the queue
keeps Messages (7 days).

1. Messages querying must be on (see Verified Messages). Only Messages created while it is on can be replayed, and
   only for the retention the Project sets.
2. Use a local API Client with `manage_orders`, `view_types`, `view_messages` and `manage_key_value_documents`.
3. Build and start a local ledger with that client:

   ```sh
   cd ledger
   npm install && npm run build
   export CTP_PROJECT_KEY=<key> CTP_REGION=<region> CTP_CLIENT_ID=<id> CTP_CLIENT_SECRET=<secret>
   export CTP_SCOPE="manage_orders:<key> view_types:<key> view_messages:<key> manage_key_value_documents:<key>"
   PORT=8081 npm start
   ```

4. In a second shell with the same environment, replay from a point in time before the gap:

   ```sh
   node build/replay.js --since 2026-10-01T00:00:00Z --to http://localhost:8081/ledger
   ```

   The script reads every Approval Flow and Approval Rule Message the ledger handles created since then and posts
   each one to the ledger. It prints how many were sent and exits with `1` if any answered with an error; run it
   again, replays are safe because writes are idempotent and a final status always wins.

5. Stop the local ledger and delete or disable the local API Client.

## Development

```sh
npm install
npm test        # Jest: handler on an in-memory platform, SDK adapter and lifecycle scripts against msw
npm run build   # compiles ledger, shared and core to build/
```
