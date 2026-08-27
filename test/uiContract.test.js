const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const publicDir = path.join(__dirname, '..', 'public');
const app = [
  fs.readFileSync(path.join(publicDir, 'main.mjs'), 'utf8'),
  ...fs.readdirSync(path.join(publicDir, 'js')).map(file => fs.readFileSync(path.join(publicDir, 'js', file), 'utf8'))
].join('\n');

test('el editor reúne URL, interpretación completa, narrativa y perfiles identificados', () => {
  assert.match(html, /id="resourceUrlInput"/);
  assert.match(app, /Todos los campos FHIR/);
  assert.match(app, /Narrativa FHIR/);
  assert.match(app, /Perfil FHIR/);
  assert.match(app, /Correo electrónico/);
  assert.doesNotMatch(app, /Vista abreviada a 180 valores/);
  assert.match(app, /Composition · estructura clínica/);
  assert.match(app, /Secciones clínicas/);
  assert.match(app, /Paciente \/ sujeto/);
  assert.match(app, /Referencias \(/);
});

test('permite visualizar y descargar los Binary PDF de un recurso o Bundle', () => {
  assert.match(html, /id="binaryPreviewDialog"/);
  assert.match(html, /id="previewGuidedPdfButton"/);
  assert.match(html, /id="binaryPreviewFrame"/);
  assert.doesNotMatch(html, /id="binaryPreviewFrame"[^>]*sandbox/);
  assert.match(app, /function renderBinaryDocuments/);
  assert.match(app, /function pdfBlob/);
  assert.match(app, /application\/pdf/);
  assert.match(app, /data-binary-action="preview"/);
  assert.match(app, /data-binary-action="download"/);
  assert.match(app, /firma esperada de un archivo PDF/);
});

test('la interfaz incluye selector de servidores, recursos base y tres casos guiados', () => {
  assert.match(html, /id="serverSelect"/);
  assert.match(html, /data-page="resources"/);
  assert.match(html, /data-page="guided"/);
  assert.match(html, /value="nps"/);
  assert.match(html, /value="notif"/);
  assert.match(html, /value="onco"/);
  assert.match(html, /id="guidedPatientMode"/);
  assert.match(html, /id="guidedPatientIdentifier"/);
  assert.match(html, /id="guidedPatientFamily"/);
  assert.match(html, /id="guidedPatientBirthDate"/);
  assert.match(html, /id="guidedPatientResults"/);
  assert.match(html, /perfil PDQm de IHE/);
  assert.match(app, /\/api\/fhir\/patients\/search/);
  assert.doesNotMatch(app, /fetchCatalog\('Patient', context\)/);
});

test('selecciona el servidor configurado sin sobrescribir una preferencia vigente', () => {
  const endpoints = fs.readFileSync(path.join(__dirname, '..', 'config', 'endpoints.js'), 'utf8');
  assert.match(app, /config\.defaultFhirServerUrl \|\| config\.hapiFhirUrl/);
  assert.match(app, /state\.servers\.some\(item => item\.url === saved\) \? saved : defaultServerUrl/);
  assert.match(endpoints, /defaultFhirServerUrl: hapiFhirUrl/);
  assert.match(html, /servidores definidos por el administrador no pueden eliminarse/i);
});

test('cambiar de servidor invalida y recarga todo el estado dependiente', () => {
  assert.match(app, /serverRevision/);
  assert.match(app, /resetServerDependentViews/);
  assert.match(app, /reloadActiveServerPage/);
  assert.match(app, /El servidor cambió\. Ejecuta nuevamente ITI-67 o ITI-68/);
  assert.match(app, /ejecuta <strong>\$validate<\/strong> nuevamente contra este servidor/);
  assert.match(app, /isCurrentServerContext\(context\)/);
});

test('el alcance visible y la API excluyen ITI-66 y no permiten limpiar la actividad', () => {
  const api = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'apiController.js'), 'utf8');
  assert.doesNotMatch(html, /id="iti66Button"/);
  assert.doesNotMatch(html, /id="clearLogsButton"/);
  assert.doesNotMatch(app, /\/api\/mhd\/iti66/);
  assert.doesNotMatch(api, /\/api\/mhd\/iti66/);
  assert.doesNotMatch(api, /\/api\/logs\/clear/);
  assert.match(html, /Perfil MHD de IHE/);
  assert.match(html, /https:\/\/profiles\.ihe\.net\/ITI\/MHD\/index\.html/);
  assert.match(app, /log-profile-link/);
  assert.match(app, /action\.replace\(\/\^mhd/);
});

test('cada tipo de recurso base muestra su contador circular y consulta el total del servidor', () => {
  for (const type of ['Organization', 'Patient', 'Practitioner']) {
    assert.match(html, new RegExp(`data-resource-count="${type}"`));
  }
  assert.doesNotMatch(html, /data-resource-type="PractitionerRole"/);
  assert.match(app, /catalogTotals/);
  assert.match(app, /bundle\?\.total/);
  assert.match(app, /renderResourceCounts/);
});

test('PractitionerRole se interpreta, pero no se administra como recurso base', () => {
  const fields = app.split('export const RESOURCE_FIELDS =')[1] || '';
  assert.doesNotMatch(fields, /PractitionerRole:\s*\[/);
  assert.match(app, /resource\.resourceType === 'PractitionerRole'/);
});
