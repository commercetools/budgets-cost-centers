// Tests for the local runner's environment mapping. [BCC-SEED-4] [BCC-DEPLOY-6]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appScopes, commandFor, envFor, parseEnvFile, scopesFromSource, TOOLING_SCOPES } from './run-local.mjs';

const FILE = {
  CTP_PROJECT_KEY: 'bcc-sandbox',
  CTP_AUTH_URL: 'https://auth.europe-west1.gcp.commercetools.com',
  CTP_API_URL: 'https://api.europe-west1.gcp.commercetools.com',
  BCC_SERVICE_CLIENT_ID: 'svc-id',
  BCC_SERVICE_CLIENT_SECRET: 'svc-secret',
  BCC_LEDGER_CLIENT_ID: 'led-id',
  BCC_LEDGER_CLIENT_SECRET: 'led-secret',
  BCC_TOOLING_CLIENT_ID: 'tool-id',
  BCC_TOOLING_CLIENT_SECRET: 'tool-secret',
  BCC_EXTENSION_SECRET: 'x'.repeat(40),
  CUSTOM_VIEW_ID: 'view-1',
};
const SCOPES = { service: ['view_orders', 'manage_extensions'], ledger: ['manage_orders'] };

test('parseEnvFile reads KEY=VALUE lines and skips comments and blanks', () => {
  const text = '# secrets\n\nCTP_PROJECT_KEY=bcc-sandbox\n  BCC_EXTENSION_SECRET = "a=b#c"  \nexport CUSTOM_VIEW_ID=\'v1\'\nnot a pair\n';
  assert.deepEqual(parseEnvFile(text), { CTP_PROJECT_KEY: 'bcc-sandbox', BCC_EXTENSION_SECRET: 'a=b#c', CUSTOM_VIEW_ID: 'v1' });
});

test('the service gets its own client, its scopes per project and the Extension secret', () => {
  assert.deepEqual(envFor('service', FILE, SCOPES), {
    CTP_PROJECT_KEY: 'bcc-sandbox',
    CTP_AUTH_URL: FILE.CTP_AUTH_URL,
    CTP_API_URL: FILE.CTP_API_URL,
    CTP_CLIENT_ID: 'svc-id',
    CTP_CLIENT_SECRET: 'svc-secret',
    CTP_SCOPE: 'view_orders:bcc-sandbox manage_extensions:bcc-sandbox',
    BCC_EXTENSION_SECRET: FILE.BCC_EXTENSION_SECRET,
  });
});

test('the ledger gets its own client and no other secret', () => {
  const env = envFor('ledger', FILE, SCOPES);
  assert.equal(env.CTP_CLIENT_ID, 'led-id');
  assert.equal(env.CTP_CLIENT_SECRET, 'led-secret');
  assert.equal(env.CTP_SCOPE, 'manage_orders:bcc-sandbox');
  assert.equal(env.BCC_EXTENSION_SECRET, undefined);
  assert.ok(!Object.values(env).includes('svc-secret') && !Object.values(env).includes('tool-secret'));
});

test('the seed gets the tooling client with the tooling scopes, never manage_project', () => {
  const env = envFor('seed', FILE, SCOPES);
  assert.equal(env.CTP_CLIENT_ID, 'tool-id');
  assert.equal(env.CTP_SCOPE, TOOLING_SCOPES.map((s) => `${s}:bcc-sandbox`).join(' '));
  assert.ok(!env.CTP_SCOPE.includes('manage_project'));
  assert.ok(TOOLING_SCOPES.includes('manage_approval_rules') && TOOLING_SCOPES.includes('view_types'));
});

test('missing values are named, never shown', () => {
  const { BCC_TOOLING_CLIENT_SECRET, CTP_API_URL, ...rest } = FILE;
  assert.throws(
    () => envFor('seed', { ...rest, BCC_SERVICE_CLIENT_SECRET: 'svc-secret' }, SCOPES),
    (e) => /BCC_TOOLING_CLIENT_SECRET/.test(e.message) && /CTP_API_URL/.test(e.message) && !e.message.includes('svc-secret'),
  );
});

test('an unknown app is refused', () => assert.throws(() => envFor('budget-view', FILE, SCOPES), /service, ledger or seed/));

test('scopesFromSource reads the app lists of shared/src/scopes.ts', () => {
  const parsed = scopesFromSource(fs.readFileSync(new URL('../shared/src/scopes.ts', import.meta.url), 'utf8'));
  assert.ok(parsed.service.includes('manage_extensions'));
  assert.ok(parsed.ledger.includes('manage_subscriptions'));
  assert.deepEqual(appScopes().ledger, parsed.ledger);
  assert.throws(() => scopesFromSource('export const SCOPES = {};'), /service/);
});

test('the seed passes its arguments after --', () => {
  assert.deepEqual(commandFor('seed', ['--project', 'bcc-sandbox']), ['npm', ['--prefix', 'seed', 'start', '--', '--project', 'bcc-sandbox']]);
  assert.deepEqual(commandFor('service', []), ['npm', ['--prefix', 'service', 'start']]);
});

test('an inline comment after whitespace is not part of the value; quoted values keep it (review minor 9)', () => {
  assert.deepEqual(parseEnvFile('A=secret # rotated in May\nB="x # y"\nC=a#b\n'), { A: 'secret', B: 'x # y', C: 'a#b' });
});

test('the secrets file defaults to the documented path and BCC_SECRETS_FILE overrides it', async () => {
  const { secretsFile } = await import('./run-local.mjs');
  assert.equal(secretsFile({}), path.join(os.homedir(), '_dev/Projects/.secrets/budgets-cost-centers.env'));
  assert.equal(secretsFile({ BCC_SECRETS_FILE: '/tmp/bcc.env' }), '/tmp/bcc.env');
});
