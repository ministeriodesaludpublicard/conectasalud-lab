const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const ignored = new Set(['node_modules', 'generated', 'logs', 'coverage']);

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(fullPath);
    return /\.(?:js|mjs)$/.test(entry.name) ? [fullPath] : [];
  });
}

const files = javascriptFiles(projectRoot);
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`Sintaxis verificada en ${files.length} archivo(s) JavaScript.`);
