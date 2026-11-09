# budget-view

Merchant Center Custom View of Budgets, Cost Centers & Projects. It opens as a large panel on the Business Unit detail
page (locator `customers.business_unit_details.general`) and is the seller's view of cost objects, budgets, settings
and the Approval Rule check.

This is commercetools Labs reference code under the MIT license. It is not a supported product: review, test and
operate it as your own code.

## How it works

- The view reads the Business Unit ID from the host page URL (`hostUrl` of the Custom View context) and loads the unit.
- All platform calls go through the Merchant Center API proxy in the user's session; the view has no API Client.
- Every write sends the Custom Object version it read. A version conflict is reported, never overwritten.
- Values are validated with `src/core` before a write; stored records it rejects are shown as errors. `src/core` is a
  generated copy of `core/src`, because Connect builds the view from its own folder only. Do not edit it: change
  `core/src` and run `node tools/sync-view-core.mjs` from the repository root; the Connect build check fails on drift.
- UI text comes from `src/i18n/data/en.json`; run `npm run extract-intl` after changing a message. The UI uses Nimbus.

## Scopes

View: `view_key_value_documents view_orders view_quotes view_quote_requests view_shopping_lists view_business_units
view_associate_roles view_customers view_approval_rules`. Manage: `manage_key_value_documents manage_approval_rules`.
Users with only the view permission see no edit or setup controls.

## Develop and deploy

```console
npm install
CTP_PROJECT_KEY=<your-project-key> \
  BCC_DEV_HOST_URI_PATH=/<your-project-key>/customers/business-units/<unit-id>/general \
  npm start                                     # http://localhost:3001, after mc-scripts login
npm test
CUSTOM_VIEW_ID=<id> APPLICATION_URL=<url> CLOUD_IDENTIFIER=gcp-eu npm run build
```

Connect deploys the view from the `budget-view` entry of `connect.yaml` with `CUSTOM_VIEW_ID` and `CLOUD_IDENTIFIER`
([deploy via Connect](https://docs.commercetools.com/merchant-center-customizations/deployment/commercetools-connect)).
Connect builds the view with the default classic JSX runtime: it uses neither the environment of the `build` script nor
these values for the build. So every file with JSX imports `React`, and the scripts, the tests and `tsconfig.json` use
the classic runtime too; a missing import fails `tsc`, lint and the Connect build check instead of the deployed panel.
Register the Custom View in the Merchant Center first to get its ID: add and verify the organization's contact email,
add the view with a placeholder URL, these scopes, the entry point Business Unit general page and the extended panel.
After the deployment, set the URL to the `budget-view` application URL of the Deployment, set the view to Ready and
install it for your projects. `BCC_DEV_HOST_URI_PATH` points the local development host at a Business Unit page, so
the panel finds its unit.
