// Tests for the Connect build check. [BCC-DEPLOY-10]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appsFromConnectYaml, buildScriptProblems, checkConnectBuild, criticalFromAudit, customViewsFromConnectYaml, viewCoreDrift } from './connect-build-check.mjs';

const fixture = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bcc-build-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
};

const YAML = 'deployAs:\n  - name: service\n    applicationType: service\n  - name: budget-view\n    applicationType: merchant-center-custom-view\n';

test('the apps are read from connect.yaml', () => assert.deepEqual(appsFromConnectYaml(YAML), ['service', 'budget-view']));

test('Custom Views are read from connect.yaml', () => assert.deepEqual(customViewsFromConnectYaml(YAML), ['budget-view']));

test('a Custom View with a file: dependency or a ../ build step is named, because Connect builds it from its folder only', () => {
  const root = fixture({
    'connect.yaml': YAML,
    'service/package.json': { name: 's', version: '1.0.0', scripts: { build: 'tsc' } },
    'budget-view/package.json': { name: 'v', version: '1.0.0', scripts: { build: 'cd ../x && mc-scripts build' }, dependencies: { c: 'file:../core' } },
  });
  assert.deepEqual(checkConnectBuild(root, { lockInSync: () => true, criticalIn: () => [] }), [
    'budget-view: Custom View depends on c (file:../core) outside its folder; Connect builds it from its folder only',
    'budget-view: Custom View build script reaches outside its folder (../); Connect builds it from its folder only',
  ]);
});

const stubs = { lockInSync: () => true, criticalIn: () => [] };
const viewYaml = () =>
  'deployAs:\n  - name: service\n    applicationType: service\n  - name: budget-view\n    applicationType: merchant-center-custom-view\n';

test('a Custom View that sets the JSX runtime flag is named, because Connect builds it with the classic runtime anyway', () => {
  const root = fixture({
    'connect.yaml': viewYaml(),
    'service/package.json': { name: 's', version: '1.0.0', scripts: { build: 'tsc' } },
    'budget-view/package.json': { name: 'v', version: '1.0.0', scripts: { build: 'ENABLE_NEW_JSX_TRANSFORM=true mc-scripts build' } },
    'budget-view/jest.test.config.js': "process.env.ENABLE_NEW_JSX_TRANSFORM = 'true';\n",
    'budget-view/src/a.tsx': "import React from 'react';\nexport const A = () => <div />;\n",
  });
  assert.deepEqual(checkConnectBuild(root, stubs), [
    'budget-view: build script sets ENABLE_NEW_JSX_TRANSFORM; Connect builds the view with the classic JSX runtime',
    'budget-view: jest.test.config.js sets ENABLE_NEW_JSX_TRANSFORM, so tests compile JSX unlike the Connect build',
  ]);
});

test('a Custom View on the classic JSX runtime must import React in every file with JSX', () => {
  const root = fixture({
    'connect.yaml': viewYaml(),
    'service/package.json': { name: 's', version: '1.0.0', scripts: { build: 'tsc' } },
    'budget-view/package.json': { name: 'v', version: '1.0.0', scripts: { build: 'mc-scripts build' } },
    'budget-view/src/a.tsx': "import React from 'react';\nexport const A = () => <div />;\n",
    'budget-view/src/b.tsx': "import { useState } from 'react';\nexport const B = () => <><span>b</span></>;\n",
    'budget-view/src/c.ts': 'export const c = 1 < 2;\n',
  });
  assert.deepEqual(checkConnectBuild(root, stubs), [
    'budget-view/src/b.tsx: JSX without importing React (React is not defined under the classic JSX runtime)',
  ]);
});

test('the view copy of core must match core/src file by file', () => {
  const root = fixture({
    'core/src/index.ts': 'export * from "./a";\n',
    'core/src/a.ts': 'export const a = 1;\n',
    'budget-view/src/core/index.ts': 'export * from "./a";\n',
    'budget-view/src/core/a.ts': 'export const a = 2;\n',
    'budget-view/src/core/old.ts': 'x',
  });
  assert.deepEqual(viewCoreDrift(root), ['budget-view/src/core/a.ts differs from core/src', 'budget-view/src/core/old.ts is not in core/src']);
});

test('a missing file in the view copy of core is named', () => {
  const root = fixture({ 'core/src/a.ts': 'x', 'budget-view/src/core/.keep': '' });
  assert.deepEqual(viewCoreDrift(root), ['budget-view/src/core/a.ts is missing (run node tools/sync-view-core.mjs)']);
});

test('a common module installed without dev dependencies is named', () =>
  assert.deepEqual(buildScriptProblems('service', 'npm --prefix ../core install && npm --prefix ../core run build && tsc'), [
    'service: build installs ../core without --include=dev, so tsc is missing when NODE_ENV=production',
  ]));

test('a common module installed with dev dependencies passes', () =>
  assert.deepEqual(buildScriptProblems('service', 'npm --prefix ../core install --include=dev && npm --prefix ../core run build'), []));

test('a lock file out of sync is named with its folder', () => {
  const root = fixture({
    'connect.yaml': YAML,
    'service/package.json': { name: 's', version: '1.0.0', scripts: { build: 'tsc' } },
    'budget-view/package.json': { name: 'v', version: '1.0.0', scripts: { build: 'mc-scripts build' } },
  });
  const lockOk = (dir) => !dir.endsWith('budget-view');
  assert.deepEqual(checkConnectBuild(root, { lockInSync: lockOk, criticalIn: () => [] }), ['budget-view: package-lock.json is out of sync with package.json (npm ci fails)']);
});

test('common modules referenced by the build are checked for lock sync too', () => {
  const root = fixture({
    'connect.yaml': YAML,
    'service/package.json': { name: 's', version: '1.0.0', scripts: { build: 'npm --prefix ../core install --include=dev && tsc' } },
    'budget-view/package.json': { name: 'v', version: '1.0.0', scripts: { build: 'mc-scripts build' } },
    'core/package.json': { name: 'c', version: '1.0.0' },
  });
  const seen = [];
  checkConnectBuild(root, { lockInSync: (dir) => (seen.push(path.basename(dir)), true), criticalIn: () => [] });
  assert.deepEqual(seen.sort(), ['budget-view', 'core', 'service']);
});

test('a critical advisory in any app or common module is named, because the Connect SCA step fails on it', () => {
  const root = fixture({
    'connect.yaml': YAML,
    'service/package.json': { name: 's', version: '1.0.0', scripts: { build: 'tsc' } },
    'budget-view/package.json': { name: 'v', version: '1.0.0', scripts: { build: 'mc-scripts build' } },
  });
  const criticalIn = (dir) => (dir.endsWith('budget-view') ? ['dompurify'] : []);
  assert.deepEqual(checkConnectBuild(root, { lockInSync: () => true, criticalIn }), [
    'budget-view: critical advisory in dompurify (the Connect SCA step fails)',
  ]);
});

test('the repository passes the build script check', () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  assert.deepEqual(checkConnectBuild(root, { lockInSync: () => true, criticalIn: () => [] }), []);
});

test('the sync script makes the view copy of core identical to core/src', async () => {
  const { syncViewCore } = await import('./sync-view-core.mjs');
  const root = fixture({ 'core/src/a.ts': 'x', 'core/src/sub/b.ts': 'y', 'budget-view/src/core/old.ts': 'z' });
  syncViewCore(root);
  assert.deepEqual(viewCoreDrift(root), []);
});

test('an npm audit that could not run is a problem, not a clean result (review finding 1)', () => {
  assert.throws(() => criticalFromAudit('{"error":{"code":"ENOTFOUND","summary":"request to registry failed"}}'), /npm audit failed/);
  assert.throws(() => criticalFromAudit(''), /npm audit failed/);
  assert.deepEqual(criticalFromAudit('{"vulnerabilities":{"a":{"severity":"critical"},"b":{"severity":"high"}}}'), ['a']);
  const root = fixture({
    'connect.yaml': YAML,
    'service/package.json': { name: 's', version: '1.0.0', scripts: { build: 'tsc' } },
    'budget-view/package.json': { name: 'v', version: '1.0.0', scripts: { build: 'mc-scripts build' } },
  });
  const criticalIn = () => {
    throw new Error('npm audit failed: offline');
  };
  assert.deepEqual(checkConnectBuild(root, { lockInSync: () => true, criticalIn }), [
    'budget-view: npm audit failed: offline',
    'service: npm audit failed: offline',
  ]);
});

test('a Custom View that the parser cannot read is named, so its checks are not skipped silently (review finding 3)', () => {
  const yaml = "deployAs:\n  - name: 'budget-view'\n    configuration: {}\n    applicationType: merchant-center-custom-view\n";
  const root = fixture({ 'connect.yaml': yaml, 'budget-view/package.json': { name: 'v', version: '1.0.0' } });
  assert.deepEqual(checkConnectBuild(root, stubs), [
    'connect.yaml: 1 merchant-center-custom-view app(s), 0 read; write `- name: <app>` unquoted with `applicationType:` on the next line',
  ]);
});

test('common modules installed with ci or with the prefix after install are found too (review finding 4)', () => {
  assert.deepEqual(buildScriptProblems('service', 'npm --prefix ../core ci && npm install --prefix ../shared && tsc'), [
    'service: build installs ../core without --include=dev, so tsc is missing when NODE_ENV=production',
    'service: build installs ../shared without --include=dev, so tsc is missing when NODE_ENV=production',
  ]);
});

test('every folder with a package-lock.json is audited, not only the apps and their modules (review finding 5)', () => {
  const root = fixture({
    'connect.yaml': YAML,
    'service/package.json': { name: 's', version: '1.0.0', scripts: { build: 'tsc' } },
    'budget-view/package.json': { name: 'v', version: '1.0.0', scripts: { build: 'mc-scripts build' } },
    'seed/package.json': { name: 'seed', version: '1.0.0' },
    'seed/package-lock.json': '{}',
  });
  const criticalIn = (dir) => (dir.endsWith('seed') ? ['x'] : []);
  assert.deepEqual(checkConnectBuild(root, { lockInSync: () => true, criticalIn }), ['seed: critical advisory in x (the Connect SCA step fails)']);
});
