// All UI text comes from message descriptors, and en.json holds exactly those messages. [BCC-VIEW-10]
import fs from 'node:fs';
import path from 'node:path';
import en from './data/en.json';

const SRC = path.join(__dirname, '..');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name);
    return e.isDirectory() ? walk(f) : [f];
  });
const sources = walk(SRC).filter(
  (f) =>
    /\.tsx?$/.test(f) &&
    !/\.(spec|test)\.tsx?$/.test(f) &&
    !f.includes(`${path.sep}test-utils${path.sep}`) &&
    // The generated copy of core is shared domain code, not UI (tools/sync-view-core.mjs).
    !f.startsWith(path.join(SRC, 'core') + path.sep)
);

describe('messages', () => {
  it('en.json matches the message descriptors (run npm run extract-intl after a change)', () => {
    const descriptors: Record<string, string> = {};
    for (const f of sources.filter((s) => path.basename(s) === 'messages.ts')) {
      const mod = require(f).default as Record<
        string,
        { id: string; defaultMessage: string }
      >;
      for (const m of Object.values(mod)) descriptors[m.id] = m.defaultMessage;
    }
    expect(en).toEqual(descriptors);
  });

  it('components hold no hard-coded JSX text', () => {
    const offenders = sources
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) =>
        fs
          .readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ line, at: `${path.relative(SRC, f)}:${i + 1}` }))
          .filter(
            ({ line }) =>
              />\s*[A-Za-z][^<>{}]*</.test(line) ||
              /\b(aria-label|tabLabel|title|placeholder)=["'][A-Za-z]/.test(
                line
              )
          )
          .map(({ at }) => at)
      );
    expect(offenders).toEqual([]);
  });

  it('model and data code return message descriptors, not English text (finding 7)', () => {
    // Texts from core and the platform pass through as received; the view's own texts live in message files.
    const offenders = sources
      .filter((f) => path.basename(f) !== 'messages.ts')
      .flatMap((f) =>
        fs
          .readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ line, at: `${path.relative(SRC, f)}:${i + 1}` }))
          .filter(
            ({ line }) =>
              /\bmessage:\s*['"`][A-Za-z]/.test(line) ||
              /['"`][A-Z][^'"`]*\s[^'"`]*[.!?]['"`]/.test(line)
          )
          .map(({ at }) => at)
      );
    expect(offenders).toEqual([]);
  });
});
