const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const textFiles = [
  'README.md', '.env.example', 'ecosystem.config.js', 'server.js', 'app.js',
  'config/endpoints.js', 'config/application.js', 'controllers/apiController.js',
  'public/index.html', 'public/main.mjs'
].map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]);

test('el código publicable no contiene rutas o servidores de una instalación anterior', () => {
  for (const [file, content] of textFiles) {
    assert.doesNotMatch(content, /\/root\/conectasalud-lab/, file);
    assert.doesNotMatch(content, /(?:169\.58\.127\.30|190\.166\.237\.52|154\.38\.173\.158)/, file);
  }
});

test('PM2 usa la ubicación del repositorio y no reemplaza el puerto de .env', () => {
  const ecosystem = fs.readFileSync(path.join(root, 'ecosystem.config.js'), 'utf8');
  assert.match(ecosystem, /cwd: __dirname/);
  assert.doesNotMatch(ecosystem, /PORT:/);
});

test('.gitignore protege secretos, dependencias y datos de ejecución', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  for (const rule of ['node_modules/', '.env', '!.env.example', 'logs/', 'generated/']) {
    assert.ok(gitignore.split('\n').includes(rule), `Falta ${rule}`);
  }
});

test('README documenta instalación genérica y verificación completa', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /git clone <URL_DEL_REPOSITORIO>/);
  assert.match(readme, /npm run verify/);
  assert.match(readme, /## Arquitectura del proyecto/);
  assert.match(readme, /## Publicación en GitHub/);
});
