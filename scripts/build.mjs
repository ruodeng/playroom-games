import { lstatSync } from 'node:fs';
import { copyFile, mkdir, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fixedPublicAssets, isPublicAsset, publicModuleDirectories } from './public-assets.mjs';
import { robotsTxt, sitemapXml } from './site-response.mjs';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const publicFiles = new Set(fixedPublicAssets);
for (const directory of publicModuleDirectories) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  for (const entry of entries) {
    const file = `${directory}/${entry.name}`;
    if (!entry.isFile() || !isPublicAsset(`/${file}`)) continue;
    if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
    publicFiles.add(file);
  }
}

const dist = path.join(root, 'dist');
const previous = lstatSync(dist, { throwIfNoEntry: false });
if (previous) {
  if (!previous.isDirectory() || (await realpath(dist)) !== dist) throw new Error('dist must be a regular directory inside the workspace');
  await rm(dist, { recursive: true });
}
for (const file of ['index.html', ...publicFiles]) {
  const target = path.join(dist, file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, file), target);
}
await writeFile(path.join(dist, 'sitemap.xml'), sitemapXml());
await writeFile(path.join(dist, 'robots.txt'), robotsTxt());

// Wrangler serves the listed files directly. Documents go through the Worker.
const publicDirectories = new Set();
for (const file of publicFiles) {
  for (let directory = path.posix.dirname(file); directory !== '.'; directory = path.posix.dirname(directory)) {
    publicDirectories.add(directory);
  }
}
const directoryRules = Array.from(publicDirectories, directory => `!/${directory}/`).sort();
const fileRules = [...publicFiles].sort().map(file => `!/${file}`);
await writeFile(path.join(dist, '.assetsignore'), ['*', ...directoryRules, ...fileRules, ''].join('\n'));
console.log('Build complete: dist/ (public assets, SSR template, sitemap and robots.txt)');
