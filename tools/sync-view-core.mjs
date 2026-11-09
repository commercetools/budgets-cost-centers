// Copies core/src into budget-view/src/core, because Connect builds the Custom View from its own folder only.
// [BCC-DEPLOY-10] The copy is generated: edit core/src, then run this script. tools/connect-build-check.mjs fails on drift.
//
// Usage: node tools/sync-view-core.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_SRC, VIEW_CORE } from './connect-build-check.mjs';

export function syncViewCore(root) {
  const copy = path.join(root, VIEW_CORE);
  fs.rmSync(copy, { recursive: true, force: true });
  fs.cpSync(path.join(root, CORE_SRC), copy, { recursive: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncViewCore(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  console.log(`Copied ${CORE_SRC} to ${VIEW_CORE}.`);
}
