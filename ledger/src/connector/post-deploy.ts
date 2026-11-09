// postDeploy of ledger: checks the scopes, then registers the Subscription. [BCC-DEPLOY-4] [BCC-DEPLOY-6]
import { createApiRoot } from 'budgets-cost-centers-shared';
import { readConfig } from 'budgets-cost-centers-shared';
import { missingScopes, SCOPES, unexpectedScopes } from 'budgets-cost-centers-shared';
import { ensureSubscription } from './subscription';

export async function postDeploy(env: NodeJS.ProcessEnv): Promise<void> {
  const extra = unexpectedScopes(env.CTP_SCOPE ?? '', SCOPES.ledger);
  if (extra.length) {
    throw new Error(`CTP_SCOPE holds scopes the ledger must not have: ${extra.join(', ')}. Allowed: ${SCOPES.ledger.join(', ')}.`);
  }
  const missing = missingScopes(env.CTP_SCOPE ?? '', SCOPES.ledger);
  if (missing.length) throw new Error(`CTP_SCOPE is missing scopes the ledger needs: ${missing.join(', ')}.`);
  const apiRoot = createApiRoot(readConfig(env, 'ledger'));
  const result = await ensureSubscription(apiRoot, env);
  process.stdout.write(`Subscription bcc-ledger ${result}.\n`);
}

if (require.main === module) {
  postDeploy(process.env).catch((error: unknown) => {
    process.stderr.write(`Post-deploy failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
