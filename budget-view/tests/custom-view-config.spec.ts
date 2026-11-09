// The Custom View config: placement on the Business Unit page and exactly the scopes the view needs.
// [BCC-VIEW-1] [BCC-DEPLOY-8]
// https://docs.commercetools.com/merchant-center-customizations/tooling-and-configuration/custom-view-config
/* eslint-disable no-template-curly-in-string -- ${env:...} placeholders are literal strings by design */
// eslint-disable-next-line import/extensions -- the config is an ES module file
import config from '../custom-view-config.mjs';

describe('custom-view-config', () => {
  it('is a large panel on the Business Unit detail page', () => {
    expect(config.type).toBe('CustomPanel');
    expect(config.typeSettings).toEqual({ size: 'LARGE' });
    expect(config.locators).toEqual([
      'customers.business_unit_details.general',
    ]);
  });

  it('requests exactly the view and manage scopes of BCC-DEPLOY-8', () => {
    expect([...config.oAuthScopes.view].sort()).toEqual(
      [
        'view_key_value_documents',
        'view_orders',
        'view_quotes',
        'view_quote_requests',
        'view_shopping_lists',
        'view_business_units',
        'view_associate_roles',
        'view_customers',
        'view_approval_rules',
      ].sort()
    );
    expect([...config.oAuthScopes.manage].sort()).toEqual(
      ['manage_key_value_documents', 'manage_approval_rules'].sort()
    );
    expect(config).not.toHaveProperty('additionalOAuthScopes');
  });

  it('takes deploy-time values from environment placeholders', () => {
    expect(config.name).toBe('Budgets & Cost Centers');
    expect(config.cloudIdentifier).toBe('${env:CLOUD_IDENTIFIER}');
    expect(config.env.production).toEqual({
      customViewId: '${env:CUSTOM_VIEW_ID}',
      url: '${env:APPLICATION_URL}',
    });
    expect(typeof config.env.development.initialProjectKey).toBe('string');
  });
});
