// Connect build check: every app in connect.yaml builds from a clean checkout with `npm ci` and `npm run build`, also
// when NODE_ENV=production. [BCC-DEPLOY-10]
//
// Checks that each common module (`npm --prefix ../<module> install` in a build script) is installed with
// `--include=dev`, because its compiler is a dev dependency, that every lock file is in sync (`npm ci --dry-run`,
// offline and fast), and that no folder has a critical advisory (`npm audit`), on which the Connect SCA step fails.
// A Custom View is built from its own folder only, so it must not reach outside it, and its copy of `core` in
// `budget-view/src/core` must match `core/src` (refresh it with `node tools/sync-view-core.mjs`). Connect builds the
// view with the classic JSX runtime, so every JSX file imports React and nothing sets ENABLE_NEW_JSX_TRANSFORM.
//
// Usage: node tools/connect-build-check.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const appsFromConnectYaml = (yaml) => [...yaml.matchAll(/^\s*-\s*name:\s*([\w-]+)\s*$/gm)].map((m) => m[1]);
export const customViewsFromConnectYaml = (yaml) =>
  [...yaml.matchAll(/^\s*-\s*name:\s*([\w-]+)\s*\n\s*applicationType:\s*merchant-center-custom-view\s*$/gm)].map((m) => m[1]);

export const CORE_SRC = 'core/src';
export const VIEW_CORE = 'budget-view/src/core';

// Relative paths of the files below a folder; dotfiles are ignored.
export const filesBelow = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && !e.name.startsWith('.'))
        .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
        .sort()
    : [];

export function viewCoreDrift(root) {
  const src = path.join(root, CORE_SRC);
  const copy = path.join(root, VIEW_CORE);
  const want = filesBelow(src);
  const have = new Set(filesBelow(copy));
  const problems = [];
  for (const f of want) {
    if (!have.has(f)) problems.push(`${VIEW_CORE}/${f} is missing (run node tools/sync-view-core.mjs)`);
    else if (!fs.readFileSync(path.join(src, f)).equals(fs.readFileSync(path.join(copy, f)))) problems.push(`${VIEW_CORE}/${f} differs from ${CORE_SRC}`);
  }
  for (const f of have) if (!want.includes(f)) problems.push(`${VIEW_CORE}/${f} is not in ${CORE_SRC}`);
  return problems.sort();
}

function customViewProblems(view, pkg) {
  const problems = [];
  for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (/^(file|link):/.test(spec)) problems.push(`${view}: Custom View depends on ${name} (${spec}) outside its folder; Connect builds it from its folder only`);
  }
  if ((pkg.scripts?.build ?? '').includes('../')) problems.push(`${view}: Custom View build script reaches outside its folder (../); Connect builds it from its folder only`);
  return problems;
}

// Connect builds a Custom View with neither the environment of its `build` script nor its connect.yaml configuration
// values (verified 2026-11-01), so mc-scripts compiles JSX with its default classic runtime: every JSX file needs React
// in scope, and scripts and tests must not switch to the automatic runtime, or they would hide a missing import.
const JSX_FLAG = 'ENABLE_NEW_JSX_TRANSFORM';
const HAS_JSX = /<\/|\/>/;
const IMPORTS_REACT = /^import (\* as )?React\b/m;

export function viewJsxProblems(root, view, pkg) {
  const problems = [];
  if ((pkg.scripts?.build ?? '').includes(JSX_FLAG)) problems.push(`${view}: build script sets ${JSX_FLAG}; Connect builds the view with the classic JSX runtime`);
  const jestConfig = path.join(root, view, 'jest.test.config.js');
  if (fs.existsSync(jestConfig) && fs.readFileSync(jestConfig, 'utf8').includes(JSX_FLAG))
    problems.push(`${view}: jest.test.config.js sets ${JSX_FLAG}, so tests compile JSX unlike the Connect build`);
  const src = path.join(root, view, 'src');
  for (const f of filesBelow(src).filter((x) => x.endsWith('.tsx'))) {
    const text = fs.readFileSync(path.join(src, f), 'utf8');
    if (HAS_JSX.test(text) && !IMPORTS_REACT.test(text))
      problems.push(`${view}/src/${f}: JSX without importing React (React is not defined under the classic JSX runtime)`);
  }
  return problems;
}

// `npm --prefix ../x install|ci ...` and `npm install|ci --prefix ../x ...`, one command between && | ;.
const modulesOf = (script) =>
  (script ?? '')
    .split(/&&|\|\||;|\|/)
    .map((c) => c.trim())
    .filter((c) => /^npm\b/.test(c) && /\b(install|ci|i)\b/.test(c))
    .flatMap((c) => [...c.matchAll(/--prefix[ =]\.\.\/([\w-]+)/g)].map((m) => ({ name: m[1], flags: c })));

export function buildScriptProblems(app, script) {
  return modulesOf(script)
    .filter((m) => !/--include=dev\b/.test(m.flags))
    .map((m) => `${app}: build installs ../${m.name} without --include=dev, so tsc is missing when NODE_ENV=production`);
}

const npmCiDryRun = (dir) =>
  spawnSync('npm', ['ci', '--dry-run', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8' }).status === 0;

// Package names with a critical advisory; dev dependencies count, because the SCA step scans them too. An audit that
// could not run (offline, registry error) throws instead of passing as clean. npm audit also exits 1 when it finds
// any advisory, so the output decides, not the exit status.
export function criticalFromAudit(out) {
  let report;
  try {
    report = JSON.parse(out);
  } catch {
    throw new Error('npm audit failed: no report');
  }
  if (report.error || !report.vulnerabilities) throw new Error(`npm audit failed: ${report.error?.summary ?? report.error?.code ?? 'no report'}`);
  return Object.entries(report.vulnerabilities)
    .filter(([, v]) => v.severity === 'critical')
    .map(([name]) => name);
}

const npmAuditCritical = (dir) => criticalFromAudit(spawnSync('npm', ['audit', '--json'], { cwd: dir, encoding: 'utf8' }).stdout);

export function checkConnectBuild(root, { lockInSync = npmCiDryRun, criticalIn = npmAuditCritical } = {}) {
  const problems = [];
  const dirs = new Set();
  const yaml = fs.readFileSync(path.join(root, 'connect.yaml'), 'utf8');
  const views = new Set(customViewsFromConnectYaml(yaml));
  const declaredViews = (yaml.match(/applicationType:\s*['"]?merchant-center-custom-view\b/g) ?? []).length;
  if (declaredViews !== views.size)
    problems.push(`connect.yaml: ${declaredViews} merchant-center-custom-view app(s), ${views.size} read; write \`- name: <app>\` unquoted with \`applicationType:\` on the next line`);
  for (const app of appsFromConnectYaml(yaml)) {
    const pkgPath = path.join(root, app, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      problems.push(`${app}: package.json is missing`);
      continue;
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const script = pkg.scripts?.build;
    if (views.has(app)) problems.push(...customViewProblems(app, pkg), ...viewJsxProblems(root, app, pkg));
    else problems.push(...buildScriptProblems(app, script));
    dirs.add(app);
    for (const m of modulesOf(script)) dirs.add(m.name);
  }
  // The SCA step scans the repository, so every folder with a lock file is audited, also tooling like the seed.
  for (const e of fs.readdirSync(root, { withFileTypes: true }))
    if (e.isDirectory() && fs.existsSync(path.join(root, e.name, 'package-lock.json'))) dirs.add(e.name);
  for (const dir of [...dirs].sort()) {
    if (!fs.existsSync(path.join(root, dir, 'package.json'))) continue;
    if (!lockInSync(path.join(root, dir))) problems.push(`${dir}: package-lock.json is out of sync with package.json (npm ci fails)`);
    try {
      for (const name of criticalIn(path.join(root, dir))) problems.push(`${dir}: critical advisory in ${name} (the Connect SCA step fails)`);
    } catch (e) {
      problems.push(`${dir}: ${e.message}`);
    }
  }
  if (fs.existsSync(path.join(root, CORE_SRC))) problems.push(...viewCoreDrift(root));
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = checkConnectBuild(root);
  for (const p of problems) console.error(`error: ${p}`);
  console.log(problems.length ? `${problems.length} problem(s).` : 'Connect build check passed.');
  process.exitCode = problems.length ? 1 : 0;
}
