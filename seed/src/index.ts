// Seed CLI: node build/index.js --project <key>. Runs only when the key is named explicitly and equals CTP_PROJECT_KEY,
// and refuses a CTP_SCOPE holding manage_project (tools/run-local.mjs always sets the tooling scopes). Checked before
// any request. [BCC-SEED-4] [BCC-SEED-2]
import { type AppConfig, createApiRoot, log, readConfig } from 'budgets-cost-centers-shared';
import { applySeed, type SeedPort } from './apply';
import { seedData } from './data';
import { sdkPort } from './sdk-port';

type Env = Record<string, string | undefined>;

const USAGE = 'Usage: npm start -- --project <project key>; the key must equal CTP_PROJECT_KEY.';

function projectArg(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--project=')) return a.slice('--project='.length) || undefined;
    if (a === '--project') return argv[i + 1]?.startsWith('--') ? undefined : argv[i + 1] || undefined;
  }
  return undefined;
}

// Why the seed must not run, or null.
export function refusal(argv: string[], env: Env): string | null {
  const named = projectArg(argv);
  const configured = env.CTP_PROJECT_KEY?.trim();
  if (!named) return `No target project named. ${USAGE}`;
  if (!configured) return 'CTP_PROJECT_KEY is not set; the seed runs only against the configured sandbox.';
  if (named !== configured) return `Project "${named}" is not the configured sandbox "${configured}". Nothing was written.`;
  const scopes = (env.CTP_SCOPE ?? '').split(/\s+/).map((s) => s.split(':')[0]);
  if (scopes.includes('manage_project')) return 'The API client has manage_project; use the tooling client with its own scopes.';
  return null;
}

export async function main(
  argv: string[],
  env: Env,
  createPort: (config: AppConfig) => SeedPort = (config) => sdkPort(createApiRoot(config)),
): Promise<number> {
  const refused = refusal(argv, env);
  if (refused) {
    log('error', refused);
    return 1;
  }
  try {
    // The seed needs what the ledger needs: project, URLs, client, scopes; no Extension secret.
    const config = readConfig(env, 'seed');
    const report = await applySeed(createPort(config), seedData());
    log('info', 'seed finished', {
      created: report.created.length,
      updated: report.updated.length,
      unchanged: report.unchanged.length,
    });
    return 0;
  } catch (e) {
    log('error', e instanceof Error ? e.message : String(e));
    return 1;
  }
}

if (require.main === module) {
  void main(process.argv.slice(2), process.env).then((code) => {
    process.exitCode = code;
  });
}
