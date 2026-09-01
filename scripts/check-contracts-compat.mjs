// Fails if a zod-schema property exported from @pos/contracts on the base ref is
// missing now — a proxy for "no breaking event/RPC schema change".
// Usage: node scripts/check-contracts-compat.mjs <base-ref>
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const baseRef = process.argv[2] || 'HEAD~1';
const SRC = 'packages/contracts/src';

const KEY_RE = /^\s{2,}([a-z_][a-zA-Z0-9_]*):\s/gm; // top-ish-level `  key:` lines

function keysFor(text) {
  const set = new Set();
  let m;
  while ((m = KEY_RE.exec(text))) set.add(m[1]);
  return set;
}

function currentFiles() {
  return readdirSync(SRC)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map((f) => [f, readFileSync(join(SRC, f), 'utf8')]);
}

function baseFile(f) {
  try {
    return execSync(`git show ${baseRef}:${SRC}/${f}`, { encoding: 'utf8' });
  } catch {
    return null; // new file — nothing to break
  }
}

let broken = [];
for (const [file, curText] of currentFiles()) {
  const prevText = baseFile(file);
  if (!prevText) continue;
  const cur = keysFor(curText);
  for (const k of keysFor(prevText)) {
    if (!cur.has(k)) broken.push(`${file}: removed/renamed \`${k}\``);
  }
}

if (broken.length) {
  console.error('Contracts backward-compat check FAILED:');
  for (const b of broken) console.error('  - ' + b);
  console.error('Add a new versioned subject/schema instead of removing fields.');
  process.exit(1);
}
console.log('Contracts backward-compat: OK');
