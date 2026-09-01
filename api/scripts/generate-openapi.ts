import { writeFileSync } from 'node:fs';
import { generateDocument, outputPath, serializeDocument } from './openapi.js';

const path = outputPath();
writeFileSync(path, serializeDocument(await generateDocument()));
console.log(`Wrote ${path}`);
