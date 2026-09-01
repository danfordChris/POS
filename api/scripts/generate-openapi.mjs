import { writeFileSync } from 'node:fs';
import { generateDocument, outputPath, serializeDocument } from './openapi.mjs';

try {
  const path = outputPath();
  writeFileSync(path, serializeDocument(await generateDocument()));
  console.log(`Wrote ${path}`);
} catch (error) {
  console.error('Failed to generate OpenAPI document:');
  console.error(error);
  process.exit(1);
}
