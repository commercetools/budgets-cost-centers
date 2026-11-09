// [BCC-DEPLOY-6]
import { missingScopes, SCOPES, unexpectedScopes } from 'budgets-cost-centers-shared';

test('a project-wide scope is unexpected', () =>
  expect(unexpectedScopes('manage_types:demo view_orders:demo manage_project:demo', SCOPES.service)).toEqual(['manage_project']));
test('the exact service scopes pass', () =>
  expect(unexpectedScopes(SCOPES.service.map((s) => `${s}:demo`).join(' '), SCOPES.service)).toEqual([]));
test('an empty scope string passes', () => expect(unexpectedScopes('', SCOPES.service)).toEqual([]));
test('ledger and service lists are distinct', () => {
  expect(SCOPES.ledger).toEqual(['manage_orders', 'view_types', 'view_messages', 'manage_key_value_documents', 'manage_subscriptions']);
  expect(SCOPES.service).not.toContain('manage_orders');
});

test('missing scopes are named (review minor 7)', () =>
  expect(missingScopes('view_orders:demo manage_types:demo', SCOPES.service)).toEqual([
    'view_quotes', 'view_business_units', 'view_key_value_documents', 'view_types', 'manage_extensions',
  ]));
