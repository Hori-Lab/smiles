import { cp, copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const rdkit = dirname(require.resolve('@rdkit/rdkit'));
const source = join(root, 'data', 'processed');
const questions = JSON.parse(await readFile(join(source, 'questions.json'), 'utf8'));
const output = join(root, 'dist');
const vendor = join(output, 'vendor');
const data = join(output, 'data');

await rm(output, { recursive: true, force: true });
await cp(join(root, 'site'), output, { recursive: true });
await mkdir(vendor);
await mkdir(join(data, 'structures'), { recursive: true });
await Promise.all([
  copyFile(join(rdkit, 'RDKit_minimal.js'), join(vendor, 'RDKit_minimal.js')),
  copyFile(join(rdkit, 'RDKit_minimal.wasm'), join(vendor, 'RDKit_minimal.wasm')),
  copyFile(join(rdkit, '..', 'LICENSE'), join(vendor, 'LICENSE')),
  copyFile(join(source, 'questions.json'), join(data, 'questions.json')),
  ...Object.values(questions).flat().map(({ image }) => copyFile(join(source, image), join(data, image))),
]);
