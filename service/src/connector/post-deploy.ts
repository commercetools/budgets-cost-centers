// postDeploy: check scopes, prepare the Custom Types, register the Extension. [BCC-DEPLOY-1] [BCC-DEPLOY-3] [BCC-DEPLOY-6]
import { createApiRoot } from 'budgets-cost-centers-shared';
import { readConfig } from 'budgets-cost-centers-shared';
import { log } from 'budgets-cost-centers-shared';
import { missingScopes, SCOPES, unexpectedScopes } from 'budgets-cost-centers-shared';
import { ensureExtension } from './extension';
import { ensureType, TYPE_DRAFTS } from './types';

export async function postDeploy(env: Record<string, string | undefined>): Promise<void> {
  const config = readConfig(env, 'service');
  const extra = unexpectedScopes(config.scope, SCOPES.service);
  if (extra.length) throw new Error(`CTP_SCOPE holds scopes the service must not have: ${extra.join(', ')}`);
  const missing = missingScopes(config.scope, SCOPES.service);
  if (missing.length) throw new Error(`CTP_SCOPE is missing scopes the service needs: ${missing.join(', ')}`);
  const url = env.CONNECT_SERVICE_URL?.trim();
  if (!url) throw new Error('CONNECT_SERVICE_URL is required');

  const apiRoot = createApiRoot(config);
  for (const draft of TYPE_DRAFTS(config)) log('info', `Type ${draft.key}: ${await ensureType(apiRoot, draft)}`);
  log('info', `Extension: ${await ensureExtension(apiRoot, url, config.extensionSecret ?? '')}`);
}

if (require.main === module) {
  postDeploy(process.env).catch((error: Error) => {
    process.stderr.write(`Post-deploy failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
