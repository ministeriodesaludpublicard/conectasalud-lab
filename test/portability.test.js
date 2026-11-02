const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
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
});
