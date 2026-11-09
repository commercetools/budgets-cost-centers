// Tests for the trace check. [BCC-PKG-3]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildMatrix, statusOf } from './trace.mjs';

const fixture = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bcc-trace-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
};

// IDs are assembled at run time so this file does not cite them itself.
const id = (cap, n) => ['BCC', cap, n].join('-');
const COST1 = id('COST', 1);
const COST2 = id('COST', 2);
const COST99 = id('COST', 99);
const BUDGET1 = id('BUDGET', 1);

const spec = (...ids) =>
  ids.map((x) => `### Requirement: [${x}] Title of ${x}\nThe system SHALL work.\n`).join('\n');

test('joins requirements to implementation, unit tests and live checks', () => {
  const root = fixture({
    'openspec/specs/cost-objects/spec.md': spec(COST1, COST2),
    'core/src/key.ts': `// [${COST1}]\nexport const k = 1;`,
    'core/test/key.test.ts': `// ${COST1}`,
    'e2e/view.e2e.ts': `// ${COST1}`,
  });
  const { rows, errors } = buildMatrix(root);
  assert.deepEqual(errors, []);
  const r1 = rows.find((r) => r.id === COST1);
  assert.equal(r1.cap, 'cost-objects');
  assert.deepEqual(r1.impl, ['core/src/key.ts']);
  assert.deepEqual(r1.tests, ['core/test/key.test.ts']);
  assert.deepEqual(r1.live, ['e2e/view.e2e.ts']);
  assert.equal(statusOf(r1), 'traced');
  assert.equal(statusOf(rows.find((r) => r.id === COST2)), 'not built');
});

test('reports implementation without evidence as unproven', () => {
  const root = fixture({
    'openspec/specs/budgets/spec.md': spec(BUDGET1),
    'service/src/handler.ts': `// ${BUDGET1}`,
  });
  const [row] = buildMatrix(root).rows;
  assert.equal(statusOf(row), 'unproven');
});

test('fails on a citation of an unknown ID', () => {
  const root = fixture({
    'openspec/specs/cost-objects/spec.md': spec(COST1),
    'core/test/key.test.ts': `// ${COST99}`,
  });
  const { errors } = buildMatrix(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], new RegExp(`${COST99}.*core/test/key\\.test\\.ts`));
});

test('fails on a duplicate requirement ID and names both specs', () => {
  const root = fixture({
    'openspec/specs/cost-objects/spec.md': spec(COST1),
    'openspec/specs/budgets/spec.md': spec(COST1),
  });
  const { errors } = buildMatrix(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], new RegExp(`${COST1}.*(budgets.*cost-objects|cost-objects.*budgets)`));
});

test('ignores node_modules, build output and the specs themselves as citations', () => {
  const root = fixture({
    'openspec/specs/cost-objects/spec.md': spec(COST1),
    'core/node_modules/x/index.js': `// ${COST1}`,
    'budget-view/dist/main.js': `// ${COST1}`,
  });
  const [row] = buildMatrix(root).rows;
  assert.deepEqual(row.impl, []);
});

test('ignores the generated copy of core in the view, so core files are not listed twice', () => {
  const root = fixture({
    'openspec/specs/cost-objects/spec.md': spec(COST1),
    'core/src/a.ts': `// ${COST1}`,
    'budget-view/src/core/a.ts': `// ${COST1}`,
  });
  const [row] = buildMatrix(root).rows;
  assert.deepEqual(row.impl, ['core/src/a.ts']);
});

test('the check flag names a traceability file that no longer matches the specs and code', async () => {
  const { staleMatrix, renderMarkdown } = await import('./trace.mjs');
  const root = fixture({ 'openspec/specs/cost-objects/spec.md': spec(COST1), 'core/src/a.ts': `// ${COST1}` });
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs/traceability.md'), 'old\n');
  assert.equal(staleMatrix(root), true);
  fs.writeFileSync(path.join(root, 'docs/traceability.md'), renderMarkdown(buildMatrix(root).rows));
  assert.equal(staleMatrix(root), false);
});

test('a unit test inside an e2e folder counts as a unit test, not as live evidence (review finding 7)', () => {
  const root = fixture({
    'openspec/specs/cost-objects/spec.md': spec(COST1),
    'core/src/a.ts': `// ${COST1}`,
    'tools/e2e/stats.e2e.test.mjs': `// ${COST1}`,
  });
  const [row] = buildMatrix(root).rows;
  assert.deepEqual([row.tests, row.live], [['tools/e2e/stats.e2e.test.mjs'], []]);
});
