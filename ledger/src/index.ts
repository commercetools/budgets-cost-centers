// Entry point of the ledger event app. [BCC-APPR-6] [BCC-DEPLOY-9]
import { createApiRoot } from 'budgets-cost-centers-shared';
import { readConfig } from 'budgets-cost-centers-shared';
import { log } from 'budgets-cost-centers-shared';
import { createApp } from './app';
import { sdkPlatform } from './sdk-platform';

const config = readConfig(process.env, 'ledger');
const port = Number(process.env.PORT) || 8080;
createApp({ platform: sdkPlatform(createApiRoot(config, { runtime: true, timeoutMs: 8000 })), config }).listen(port, () => log('info', `ledger listening on ${port}.`));
