// Bundle-size budget (Spec P5 §15): initial JavaScript < 250 KB gzipped, each route chunk < 80 KB gzipped.
// Reads the Vite manifest written by `npm run build` and gzips every JavaScript file it lists.
//
//   initial JS   = the entry chunk plus every chunk it imports statically (what the first page load needs)
//   route chunk  = a lazily imported chunk plus the static imports it adds beyond the initial set
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGET = { initial: 250 * KB, route: 80 * KB };
const DIST = join(import.meta.dirname, '..', 'dist');

/** @type {Record<string, { file: string, isEntry?: boolean, isDynamicEntry?: boolean, imports?: string[], src?: string }>} */
let manifest;
try {
  manifest = JSON.parse(readFileSync(join(DIST, '.vite', 'manifest.json'), 'utf8'));
} catch {
  console.error('dist/.vite/manifest.json not found. Run `npm run build` first.');
  process.exit(1);
}

const gzipCache = new Map();
/** @param {string} file */
function gzippedSize(file) {
  if (!gzipCache.has(file)) gzipCache.set(file, gzipSync(readFileSync(join(DIST, file))).length);
  return gzipCache.get(file);
}

/** Every manifest key reachable from `key` through static imports, including `key`. */
function staticClosure(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const imported of manifest[key]?.imports ?? []) staticClosure(imported, seen);
  return seen;
}

const jsFiles = (keys) => [...keys].map((key) => manifest[key].file).filter((file) => file.endsWith('.js'));
const total = (files) => files.reduce((sum, file) => sum + gzippedSize(file), 0);
const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
const initialKeys = new Set(entries.flatMap((key) => [...staticClosure(key)]));
const initialFiles = jsFiles(initialKeys);
const initialSize = total(initialFiles);

const failures = [];
const rows = [['initial', initialFiles.join(', '), initialSize, BUDGET.initial]];
if (initialSize > BUDGET.initial) failures.push('initial');

for (const key of Object.keys(manifest).filter((k) => manifest[k].isDynamicEntry)) {
  const added = [...staticClosure(key)].filter((k) => !initialKeys.has(k));
  const files = jsFiles(added);
  const size = total(files);
  rows.push([`route ${manifest[key].src ?? key}`, files.join(', '), size, BUDGET.route]);
  if (size > BUDGET.route) failures.push(key);
}

console.log('Bundle-size budget (gzipped JavaScript)\n');
for (const [name, files, size, budget] of rows) {
  const mark = size > budget ? 'OVER' : 'ok  ';
  console.log(`${mark}  ${name.padEnd(48)} ${kb(size).padStart(10)} / ${kb(budget)}   ${files}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} chunk(s) over budget.`);
  process.exit(1);
}
console.log('\nAll chunks are within budget.');
