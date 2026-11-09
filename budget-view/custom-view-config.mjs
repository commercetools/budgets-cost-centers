// Custom View on the Business Unit detail page. [BCC-VIEW-1] [BCC-DEPLOY-8]
// https://docs.commercetools.com/merchant-center-customizations/tooling-and-configuration/custom-view-config
// Connect injects CUSTOM_VIEW_ID, CLOUD_IDENTIFIER and APPLICATION_URL at deploy time (see connect.yaml).
/* eslint-disable no-template-curly-in-string -- ${env:...} placeholders are literal strings by design */

/**
 * @type {import('@commercetools-frontend/application-config').ConfigOptionsForCustomView}
 */
const config = {
  name: 'Budgets & Cost Centers',
  cloudIdentifier: '${env:CLOUD_IDENTIFIER}',
  env: {
    development: {
      initialProjectKey: process.env.CTP_PROJECT_KEY || 'your-project-key',
      // Local only: a Business Unit page path, e.g. /<project>/customers/business-units/<id>/general, so the panel
      // finds its unit in the development host.
      ...(process.env.BCC_DEV_HOST_URI_PATH
        ? { hostUriPath: process.env.BCC_DEV_HOST_URI_PATH }
        : {}),
    },
    production: {
      customViewId: '${env:CUSTOM_VIEW_ID}',
      url: '${env:APPLICATION_URL}',
    },
  },
  oAuthScopes: {
    view: [
      'view_key_value_documents',
      'view_orders',
      'view_quotes',
      'view_quote_requests',
      'view_shopping_lists',
      'view_business_units',
      'view_associate_roles',
      'view_customers',
      'view_approval_rules',
    ],
    manage: ['manage_key_value_documents', 'manage_approval_rules'],
  },
  type: 'CustomPanel',
  typeSettings: {
    size: 'LARGE',
  },
  locators: ['customers.business_unit_details.general'],
};

export default config;
