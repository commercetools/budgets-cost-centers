// Least-privilege scopes per Connect app. [BCC-DEPLOY-6]
// https://docs.commercetools.com/api/scopes
export const SCOPES = {
  service: ['view_orders', 'view_quotes', 'view_business_units', 'view_key_value_documents', 'view_types', 'manage_types', 'manage_extensions'],
  ledger: ['manage_orders', 'view_types', 'view_messages', 'manage_key_value_documents', 'manage_subscriptions'],
} as const satisfies Record<string, readonly string[]>;

// Scope names in `CTP_SCOPE` (space separated, each `name:projectKey`) that are not in the allowed list.
export function unexpectedScopes(ctpScope: string, allowed: readonly string[]): string[] {
  const names = ctpScope.split(/\s+/).filter(Boolean).map((s) => s.split(':')[0] ?? s);
  return [...new Set(names.filter((n) => !allowed.includes(n)))];
}

// Scopes only `postDeploy` and `preUndeploy` need; running apps request a token without them.
export const LIFECYCLE_ONLY_SCOPES: readonly string[] = ['manage_types', 'manage_extensions', 'manage_subscriptions'];

// An empty list would make the token endpoint grant every scope of the client, so it is refused.
export function runtimeScopes(ctpScope: string): string[] {
  const scopes = ctpScope.split(/\s+/).filter(Boolean).filter((s) => !LIFECYCLE_ONLY_SCOPES.includes(s.split(':')[0] ?? s));
  if (!scopes.length) throw new Error('CTP_SCOPE holds no runtime scope.');
  return scopes;
}

// Scope names the app needs that `CTP_SCOPE` lacks; a missing scope would fail every request at runtime.
export function missingScopes(ctpScope: string, required: readonly string[]): string[] {
  const names = new Set(ctpScope.split(/\s+/).filter(Boolean).map((s) => s.split(':')[0] ?? s));
  return required.filter((r) => !names.has(r));
}
