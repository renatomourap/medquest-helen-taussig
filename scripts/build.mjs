import { cp, copyFile, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(), out = path.join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const maintenance = JSON.parse(await readFile(path.join(root, 'maintenance.json'), 'utf8'));
if (maintenance.enabled) {
  await copyFile(path.join(root, 'maintenance.html'), path.join(out, 'index.html'));
  await copyFile(path.join(root, 'sw.js'), path.join(out, 'sw.js'));
  await mkdir(path.join(out, 'assets'), { recursive: true });
  await copyFile(path.join(root, 'assets', 'heart.png'), path.join(out, 'assets', 'heart.png'));
  console.log('MedQuest maintenance screen built; application and login assets are not published.');
  process.exit(0);
}

for (const name of ['index.html', 'manifest.webmanifest', 'sw.js']) await copyFile(path.join(root, name), path.join(out, name));
await cp(path.join(root, 'assets'), path.join(out, 'assets'), {
  recursive: true, filter: src => !src.startsWith(path.join(root, 'assets', 'vendor'))
});
const library = path.join(root, 'node_modules', 'pdfjs-dist');
const info = JSON.parse(await readFile(path.join(library, 'package.json'), 'utf8'));
if (info.version !== '6.4.299') throw new Error('Unexpected PDF.js version');
const vendor = path.join(out, 'assets', 'vendor', 'pdfjs-6.4.299');
await mkdir(vendor, { recursive: true });
for (const file of ['pdf.min.mjs', 'pdf.worker.min.mjs']) await copyFile(path.join(library, 'legacy', 'build', file), path.join(vendor, file));
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) await cp(path.join(library, folder), path.join(vendor, folder), { recursive: true });
await copyFile(path.join(library, 'LICENSE'), path.join(vendor, 'LICENSE'));
await writeFile(path.join(vendor, 'SOURCE.txt'), 'PDF.js 6.4.299, official legacy/polyfilled build, Apache-2.0. Runtime and worker are copied from the same locked npm package.');
console.log('Static MedQuest built with self-hosted PDF.js 6.4.299.');
