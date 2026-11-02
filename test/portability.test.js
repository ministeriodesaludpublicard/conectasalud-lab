const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
<<<<<<< HEAD

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
=======
const root=path.join(__dirname,'..');

test('no acopla el código a rutas del sistema ni a inventarios privados',()=>{
  for (const file of ['README.md','ecosystem.config.js','server.js','app.js','config/endpoints.js','config/application.js','controllers/apiController.js','public/index.html','public/main.mjs']) {
    const txt=fs.readFileSync(path.join(root,file),'utf8');
    assert.doesNotMatch(txt,/\/root\/conectasalud-lab/);
  }
});

test('se entrega una plantilla neutra para FHIR y OpenHIM',()=>{
  const env=fs.readFileSync(path.join(root,'.env.example'),'utf8');
  assert.match(env,/^HAPI_FHIR_URL=http:\/\/127\.0\.0\.1:8080\/fhir$/m);
  assert.match(env,/^OPENHIM_BASE_URL=https:\/\/openhim\.example\.org:5000$/m);
  assert.match(env,/^OPENHIM_TLS_REJECT_UNAUTHORIZED=true$/m);
});

test('el despliegue PM2 utiliza la raíz del proyecto',()=>{
  const txt=fs.readFileSync(path.join(root,'ecosystem.config.js'),'utf8');
  assert.match(txt,/cwd: __dirname/);
});

test('gitignore protege secretos y datos de ejecución',()=>{
  const entries=fs.readFileSync(path.join(root,'.gitignore'),'utf8').split('\n');
  for (const required of ['node_modules/','.env','!.env.example','logs/','generated/','SERVIDORES.json']) {
    assert.ok(entries.includes(required),required);
  }
});

test('README explica la instalación genérica y su verificación',()=>{
  const txt=fs.readFileSync(path.join(root,'README.md'),'utf8');
  assert.match(txt,/git clone <URL_DEL_REPOSITORIO>/);
  assert.match(txt,/npm run verify/);
  assert.match(txt,/## Arquitectura del proyecto/);
  assert.match(txt,/## Publicación en GitHub/);
>>>>>>> origin/master
});
