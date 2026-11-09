// Package check: Labs files, stated limits, generally available features, no internal content.
// [BCC-PKG-1] [BCC-PKG-2] [BCC-PKG-4] [BCC-DEPLOY-7]
//
// The deny list is read from an untracked local file (default `_intern/deny-list.txt`, one name per line, `#` for
// comments), so the list itself is never published. Findings name the file and line, never the matched name.
//
// Usage: node tools/package-check.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BANNER = '> commercetools-labs reference code, MIT, not supported.';
const LABS_FILES = ['README.md', 'SUPPORT.md', 'CONTRIBUTING.md', 'LICENSE', 'FEATURES.md'];

// The ten limits the README must state, each found by a pattern inside the "Limits" section.
export const LIMITS = [
  { name: 'live consumption', pattern: /consumption is computed live/i, phrase: 'Consumption is computed live from orders; there is no ledger bookkeeping yet.' },
  { name: 'cart race', pattern: /two carts/i, phrase: 'Two carts checked against the same remaining budget can both be ordered.' },
  { name: 'returns', pattern: /returns and refunds/i, phrase: 'Returns and refunds are out of scope.' },
  { name: 'quote orders', pattern: /orders from quotes/i, phrase: 'Budget approval on orders from quotes is not guaranteed.' },
  {
    name: 'recurring and imported orders',
    pattern: /recurring\s+orders\s+are\s+checked\s+once(?:(?!\n\s*-\s)[\s\S])*?imported\s+orders[^.]*not\s+checked/i,
    phrase: 'Recurring orders are checked once, when the recurring cart is created. Imported orders (Order Import) are not checked.',
  },
  { name: 'requester roles', pattern: /requester roles/i, phrase: 'Approval Rules apply only to requester roles.' },
  { name: 'impersonation', pattern: /on behalf of an associate/i, phrase: 'The view manages Approval Rules on behalf of an associate.' },
  { name: 'currency', pattern: /per currency/i, phrase: 'Budgets apply per currency.' },
  { name: 'UTC', pattern: /\bUTC\b/, phrase: 'Periods are computed in UTC.' },
  { name: 'undeploy', pattern: /undeploy/i, phrase: 'Undeploy leaves Custom Types and data in place.' },
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function limitsSection(readme) {
  const m = readme.match(/^## Limits\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m);
  return m ? m[1] : '';
}

function denyPatterns(file) {
  if (!fs.existsSync(file)) return null;
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((name) => new RegExp(`(^|[^\\p{L}\\p{N}])${name.split(/\s+/).map(escape).join('\\s+')}(?=$|[^\\p{L}\\p{N}])`, 'giu'));
}

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

export function checkPackage(root, opts = {}) {
  const problems = [];
  for (const f of LABS_FILES) if (!fs.existsSync(path.join(root, f))) problems.push(`${f} is missing`);

  const readmePath = path.join(root, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf8');
    if (!readme.startsWith(BANNER)) problems.push('README.md does not start with the Labs banner');
    const section = limitsSection(readme);
    for (const l of LIMITS) if (!l.pattern.test(section)) problems.push(`README.md "Limits" does not state: ${l.name}`);
  }

  // Every platform feature the package uses is listed with its documentation page and none is labelled beta.
  const featuresPath = path.join(root, 'FEATURES.md');
  if (fs.existsSync(featuresPath)) {
    const m = fs.readFileSync(featuresPath, 'utf8').match(/^## Platform features\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m);
    const items = m ? m[1].split('\n').filter((l) => l.trim().startsWith('- ')) : [];
    if (!items.length) problems.push('FEATURES.md has no "Platform features" list');
    for (const item of items) {
      if (!/https:\/\/docs\.commercetools\.com\//.test(item)) problems.push(`FEATURES.md platform feature without a documentation link: ${item.trim().slice(2, 60)}`);
      if (/\bbeta\b/i.test(item)) problems.push(`FEATURES.md lists a beta feature: ${item.trim().slice(2, 60)}`);
    }
  }

  const staged = opts.staged ?? git(root, ['diff', '--cached', '--name-only']);
  for (const f of staged) if (f.startsWith('_intern/')) problems.push(`${f} is staged but _intern/ must never be committed`);

  const patterns = denyPatterns(opts.denyListPath ?? path.join(root, '_intern/deny-list.txt'));
  if (patterns) {
    const tracked = opts.tracked ?? git(root, ['ls-files']);
    for (const f of tracked) {
      if (f.startsWith('_intern/') || f.endsWith('package-lock.json')) continue;
      const full = path.join(root, f);
      if (!fs.existsSync(full)) continue;
      // Whole-file matching, so a name wrapped across lines is found; the hit is reported at its first line.
      const text = fs.readFileSync(full, 'utf8');
      const lines = new Set();
      for (const p of patterns) {
        p.lastIndex = 0;
        for (let m = p.exec(text); m; m = p.exec(text)) {
          const start = m.index + m[1].length;
          lines.add(text.slice(0, start).split('\n').length);
          if (m[0].length === 0) p.lastIndex += 1;
        }
      }
      for (const line of [...lines].sort((a, b) => a - b)) problems.push(`${f}:${line} contains a denied name`);
      const pathWords = f.replace(/[-_./]+/g, ' ');
      if (patterns.some((p) => ((p.lastIndex = 0), p.test(pathWords)))) problems.push(`${f} has a denied name in its path`);
    }
  } else if (!opts.quiet) {
    process.stderr.write('notice: no local deny list found; the name check was skipped.\n');
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = checkPackage(root);
  for (const p of problems) console.error(`error: ${p}`);
  console.log(problems.length ? `${problems.length} problem(s).` : 'Package check passed.');
  process.exitCode = problems.length ? 1 : 0;
}
