'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(target);
  }
}
walk(sourceRoot);
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exitCode = 1;
  }
  for (const match of source.matchAll(/require[(]['"]([.][^'"]+)['"][)]/g)) {
    const base = path.resolve(path.dirname(file), match[1]);
    if (![base, base + '.js', base + '.json', path.join(base, 'index.js')].some(candidate => fs.existsSync(candidate))) {
      console.error('Missing relative module:', file, '->', match[1]);
      process.exitCode = 1;
    }
  }
}
if (process.exitCode) process.exit(process.exitCode);
console.log('Backend JavaScript syntax validation passed (' + files.length + ' files).');
