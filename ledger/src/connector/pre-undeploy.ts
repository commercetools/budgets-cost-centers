// preUndeploy of ledger: removes the Subscription only. [BCC-DEPLOY-5]
// Types and order fields stay, because they hold customer data.
import { createApiRoot } from 'budgets-cost-centers-shared';
import { readConfig } from 'budgets-cost-centers-shared';
import { removeSubscription } from './subscription';

export async function preUndeploy(env: NodeJS.ProcessEnv): Promise<void> {
  const result = await removeSubscription(createApiRoot(readConfig(env, 'ledger')));
  process.stdout.write(`Subscription bcc-ledger ${result}.\n`);
}

if (require.main === module) {
  preUndeploy(process.env).catch((error: unknown) => {
    process.stderr.write(`Pre-undeploy failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
