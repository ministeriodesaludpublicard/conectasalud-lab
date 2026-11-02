// Ejecuta exclusivamente los tests de la versión activa y evita `old/test`.
// Se usa spawn con rutas explícitas para funcionar igual en Windows y Linux.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const dir = path.join(__dirname, '..', 'test');
const tests = fs.readdirSync(dir).filter(name => /\.test\.(?:js|mjs)$/.test(name)).sort()
  .map(name => path.join(dir, name));
if (!tests.length) {
  console.error('No se encontraron pruebas en test/.');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit', env: process.env });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
