// Tests for the package check. [BCC-PKG-1] [BCC-PKG-2] [BCC-PKG-4] [BCC-DEPLOY-7]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BANNER, checkPackage, LIMITS } from './package-check.mjs';

const fixture = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bcc-pkg-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
};
const readme = (limits = LIMITS.map((l) => l.phrase)) => `${BANNER}\n\n# Title\n\n## Limits\n\n${limits.map((l) => `- ${l}`).join('\n')}\n`;
const FEATURES = '# Features\n\n## Platform features\n\n- API Extensions: https://docs.commercetools.com/api/projects/api-extensions\n';
const complete = (extra = {}) => ({ 'README.md': readme(), 'SUPPORT.md': 's', 'CONTRIBUTING.md': 'c', LICENSE: 'MIT License', 'FEATURES.md': FEATURES, ...extra });
const run = (root, opts = {}) => checkPackage(root, { tracked: Object.keys(opts.files ?? {}), staged: [], ...opts });

test('a complete package has no problems', () => assert.deepEqual(run(fixture(complete()), { tracked: ['README.md'] }), []));
test('a missing Labs file is named', () => {
  const files = complete();
  delete files['SUPPORT.md'];
  assert.match(run(fixture(files)).join('\n'), /SUPPORT\.md is missing/);
});
test('a missing CONTRIBUTING.md is reported [BCC-PKG-1]', () => {
  const files = complete();
  delete files['CONTRIBUTING.md'];
  assert.match(run(fixture(files)).join('\n'), /CONTRIBUTING\.md is missing/);
});
test('the README must start with the banner', () =>
  assert.match(run(fixture(complete({ 'README.md': `# Title\n${readme()}` }))).join('\n'), /banner/));
test('every limit is required in the Limits section', () => {
  const [first, ...rest] = LIMITS;
  const problems = run(fixture(complete({ 'README.md': readme(rest.map((l) => l.phrase)) })));
  assert.equal(problems.length, 1);
  assert.match(problems[0], new RegExp(first.name));
});
test('a staged file under _intern fails', () =>
  assert.match(run(fixture(complete()), { staged: ['_intern/notes.md'] }).join('\n'), /_intern\/notes\.md/));
test('a denied name in a tracked file fails with file and line', () => {
  const root = fixture(complete({ 'docs/a.md': 'line one\nwe met Acme Corp today\n', '_intern/deny-list.txt': '# comment\nacme corp\n' }));
  assert.deepEqual(run(root, { tracked: ['docs/a.md'] }), ['docs/a.md:2 contains a denied name']);
});
test('the deny list itself is never printed', () => {
  const root = fixture(complete({ 'docs/a.md': 'Acme Corp', '_intern/deny-list.txt': 'Acme Corp' }));
  assert.doesNotMatch(run(root, { tracked: ['docs/a.md'] }).join('\n'), /Acme/i);
});
test('names match whole words only', () => {
  const root = fixture(complete({ 'docs/a.md': 'acmecorporation', '_intern/deny-list.txt': 'acme corp' }));
  assert.deepEqual(run(root, { tracked: ['docs/a.md'] }), []);
});
test('a name split across a line break is found at its first line (review I-4)', () => {
  const root = fixture(complete({ 'docs/a.md': 'one\nwe met Acme\nCorp today\n', '_intern/deny-list.txt': 'acme corp' }));
  assert.deepEqual(run(root, { tracked: ['docs/a.md'] }), ['docs/a.md:2 contains a denied name']);
});
test('a denied name in a file path is found (review I-4)', () => {
  const root = fixture(complete({ 'docs/acme-corp-notes.md': 'x', '_intern/deny-list.txt': 'acme corp' }));
  assert.deepEqual(run(root, { tracked: ['docs/acme-corp-notes.md'] }), ['docs/acme-corp-notes.md has a denied name in its path']);
});

test('FEATURES.md lists the platform features with documentation links (BCC-DEPLOY-7)', () => {
  assert.match(run(fixture(complete({ 'FEATURES.md': '# Features\n' }))).join('\n'), /Platform features/);
  assert.match(run(fixture(complete({ 'FEATURES.md': '# Features\n\n## Platform features\n\n- Something without a link\n' }))).join('\n'), /documentation link/);
});
test('a platform feature marked beta fails (BCC-DEPLOY-7)', () =>
  assert.match(run(fixture(complete({ 'FEATURES.md': FEATURES + '- Shiny thing (beta): https://docs.commercetools.com/x\n' }))).join('\n'), /beta/i));

test('recurring and imported orders must be stated in the same bullet (review finding 9)', () => {
  const split = LIMITS.map((l) =>
    l.name === 'recurring and imported orders' ? 'Recurring orders are checked once.\n- Something else. Imported orders are not checked.' : l.phrase
  );
  const problems = run(fixture(complete({ 'README.md': readme(split) })));
  assert.ok(problems.some((p) => p.includes('recurring and imported orders')), problems.join('\n'));
});
