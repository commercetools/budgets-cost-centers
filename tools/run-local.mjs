// Local runner: starts one app with its own API client from the secrets file. [BCC-SEED-4] [BCC-DEPLOY-6]
//
// Reads the file BCC_SECRETS_FILE names, by default ~/_dev/Projects/.secrets/budgets-cost-centers.env (KEY=VALUE
// lines, `#` comments; layout in docs/backlog.md, "Human steps"), maps BCC_<APP>_CLIENT_ID/_SECRET to
// CTP_CLIENT_ID/CTP_CLIENT_SECRET, sets CTP_SCOPE to the app's scopes for CTP_PROJECT_KEY and runs
// `npm --prefix <app> start`. Secret values are never printed. Build the app first.
//
// Usage: node tools/run-local.mjs <service|ledger|seed> [args]   (seed: node tools/run-local.mjs seed --project <key>)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const secretsFile = (env = process.env) =>
  env.BCC_SECRETS_FILE || path.join(os.homedir(), '_dev/Projects/.secrets/budgets-cost-centers.env');
export const SECRETS_FILE = secretsFile();

const APPS = ['service', 'ledger', 'seed'];
const CLIENT_PREFIX = { service: 'BCC_SERVICE', ledger: 'BCC_LEDGER', seed: 'BCC_TOOLING' };

// The `bcc-tooling-dev` client (docs/backlog.md, "Human steps"); local only, never in connect.yaml.
export const TOOLING_SCOPES = [
  'manage_business_units',
  'manage_customers',
  'manage_associate_roles',
  'manage_key_value_documents',
  'manage_orders',
  'manage_shopping_lists',
  'manage_quote_requests',
  'manage_staged_quotes',
  'manage_quotes',
  'manage_approval_rules',
  'manage_approval_flows',
  'view_types',
];

export function parseEnvFile(text) {
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    // Quoted values are taken as written; unquoted ones end at an inline comment (whitespace, then #).
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    env[m[1]] = value;
  }
  return env;
}

// The Connect app scopes have one source, shared/src/scopes.ts; this reads its `service` and `ledger` lists.
export function scopesFromSource(source) {
  const list = (app) => {
    const m = source.match(new RegExp(`\\b${app}:\\s*\\[([^\\]]*)\\]`));
    if (!m) throw new Error(`No ${app} scope list found in shared/src/scopes.ts.`);
    return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  };
  return { service: list('service'), ledger: list('ledger') };
}

export const appScopes = () => scopesFromSource(fs.readFileSync(path.join(ROOT, 'shared/src/scopes.ts'), 'utf8'));

export function envFor(app, fileEnv, scopes = appScopes()) {
  if (!APPS.includes(app)) throw new Error(`App must be service, ledger or seed, not "${app}".`);
  const prefix = CLIENT_PREFIX[app];
  const needed = ['CTP_PROJECT_KEY', 'CTP_AUTH_URL', 'CTP_API_URL', `${prefix}_CLIENT_ID`, `${prefix}_CLIENT_SECRET`];
  if (app === 'service') needed.push('BCC_EXTENSION_SECRET');
  const missing = needed.filter((k) => !fileEnv[k]?.trim());
  if (missing.length) throw new Error(`Missing in the secrets file: ${missing.join(', ')}.`);

  const projectKey = fileEnv.CTP_PROJECT_KEY.trim();
  const names = app === 'seed' ? TOOLING_SCOPES : scopes[app];
  return {
    CTP_PROJECT_KEY: projectKey,
    CTP_AUTH_URL: fileEnv.CTP_AUTH_URL.trim(),
    CTP_API_URL: fileEnv.CTP_API_URL.trim(),
    CTP_CLIENT_ID: fileEnv[`${prefix}_CLIENT_ID`].trim(),
    CTP_CLIENT_SECRET: fileEnv[`${prefix}_CLIENT_SECRET`].trim(),
    CTP_SCOPE: names.map((s) => `${s}:${projectKey}`).join(' '),
    // Only the service verifies the Extension secret; no other app receives it.
    ...(app === 'service' ? { BCC_EXTENSION_SECRET: fileEnv.BCC_EXTENSION_SECRET.trim() } : {}),
  };
}

export function commandFor(app, args) {
  return ['npm', ['--prefix', app, 'start', ...(args.length ? ['--', ...args] : [])]];
}

function main([app, ...args]) {
  if (!fs.existsSync(SECRETS_FILE)) {
    console.error(`Secrets file not found: ${SECRETS_FILE}. See docs/backlog.md, "Human steps".`);
    return 1;
  }
  let env;
  try {
    env = envFor(app, parseEnvFile(fs.readFileSync(SECRETS_FILE, 'utf8')));
  } catch (e) {
    console.error(e.message);
    return 1;
  }
  // Variables of other apps and other clients from the shell are not passed on.
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CTP|BCC)_/.test(k)));
  const [cmd, cmdArgs] = commandFor(app, args);
  console.error(`Starting ${app} for project ${env.CTP_PROJECT_KEY} with scopes: ${env.CTP_SCOPE.replace(/:\S+/g, '')}`);
  const child = spawn(cmd, cmdArgs, { cwd: ROOT, env: { ...base, ...env }, stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
  return undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = main(process.argv.slice(2));
  if (code !== undefined) process.exitCode = code;
}
