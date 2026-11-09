// Starts the Extension endpoint; configuration is validated before listening. [BCC-CART-1] [BCC-DEPLOY-9]
import { createApiRoot, log, readConfig } from 'budgets-cost-centers-shared';
import { createApp, DEADLINE_MS } from './app';
import { sdkPlatform } from './sdk-platform';

const config = readConfig(process.env, 'service');
const port = Number(process.env.PORT ?? 8080);
// Read-only token at runtime; platform calls are aborted at the internal time budget.
const apiRoot = createApiRoot(config, { runtime: true, timeoutMs: DEADLINE_MS });
createApp({ platform: sdkPlatform(apiRoot), config }).listen(port, () => log('info', `service listening on ${port}`));
