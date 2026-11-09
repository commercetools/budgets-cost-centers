// preUndeploy: remove the Extension; types, fields and records stay, because they hold customer data. [BCC-DEPLOY-5]
import { createApiRoot } from 'budgets-cost-centers-shared';
import { readConfig } from 'budgets-cost-centers-shared';
import { log } from 'budgets-cost-centers-shared';
import { removeExtension } from './extension';

export async function preUndeploy(env: Record<string, string | undefined>): Promise<void> {
  await removeExtension(createApiRoot(readConfig(env, 'service')));
  log('info', 'Extension removed; Custom Types, fields and Custom Objects are left in place.');
}

if (require.main === module) {
  preUndeploy(process.env).catch((error: Error) => {
    process.stderr.write(`Pre-undeploy failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
