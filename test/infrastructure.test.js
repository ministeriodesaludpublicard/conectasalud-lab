const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

test('usa PM2 portátil sin ruta ni puerto fijos de sistema', () => {
  const pm2 = fs.readFileSync(path.join(root, 'ecosystem.config.js'),'utf8');
  const example = fs.readFileSync(path.join(root, '.env.example'),'utf8');
  assert.match(pm2,/cwd: __dirname/);
  assert.match(example,/^PORT=3445$/m);
});

test('ejemplo utiliza servidor genérico y TLS seguro', () => {
  const t = fs.readFileSync(path.join(root, '.env.example'),'utf8');
  assert.match(t,/^HAPI_FHIR_URL=http:\/\/127\.0\.0\.1:8080\/fhir$/m);
  assert.match(t,/^OPENHIM_TLS_REJECT_UNAUTHORIZED=true$/m);
});

test('archivo de ejemplo mantiene vacíos los secretos', () => {
  const t = fs.readFileSync(path.join(root, '.env.example'),'utf8');
  for (const key of ['OPENHIM_PASSWORD','OPENHIM_PUBLISH_PASSWORD','OPENHIM_CLIENT_SECRET','ITI65_TEST_TOKEN','FHIR_BEARER_TOKEN','FHIR_VALIDATION_BEARER_TOKEN','MPI_BEARER_TOKEN','MPI_PASSWORD']) {
    assert.match(t,new RegExp(`^${key}=$`,'m'),key);
  }
});
