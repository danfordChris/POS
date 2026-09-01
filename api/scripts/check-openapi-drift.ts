import { readFileSync } from 'node:fs';
import { generateDocument, outputPath, serializeDocument } from './openapi.js';

const path = outputPath();

let committed: string;
try {
  committed = readFileSync(path, 'utf8');
} catch {
  console.error(
    'openapi.json is missing. Run: pnpm --filter api openapi:generate',
  );
  process.exit(1);
}

const fresh = serializeDocument(await generateDocument());

if (fresh !== committed) {
  console.error(
    'OpenAPI drift detected. Run: pnpm --filter api openapi:generate, then commit openapi.json',
  );
  process.exit(1);
}

console.log('OpenAPI document is in sync.');
