const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const app = [
  fs.readFileSync(path.join(publicDir, 'main.mjs'), 'utf8'),
  ...fs.readdirSync(path.join(publicDir, 'js')).map(file => fs.readFileSync(path.join(publicDir, 'js', file), 'utf8'))
].join('\n');

test('mantiene editor, interpretación, validación y visor PDF', () => {
  for (const id of ['resourceUrlInput', 'jsonEditor', 'validationResult', 'binaryPreviewDialog', 'binaryPreviewFrame']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /Narrativa FHIR/);
  assert.match(app, /function renderBinaryDocuments/);
  assert.match(app, /application\/pdf/);
});

test('incluye los cuatro tipos documentales de la guía 0.2.0', () => {
  for (const value of ['nps', 'lab', 'notif', 'onco']) assert.match(html, new RegExp(`value="${value}"`));
  for (const profile of ['BundleNPSDO', 'BundleLabDO', 'BundleNotifDO', 'BundleOncoDO']) assert.match(app + html, new RegExp(profile));
  assert.match(html, /id="guidedLabFields"/);
  assert.match(html, /id="labTestCode"/);
});

test('publica Bundle document a través de transacción ITI-65 del backend', () => {
  assert.match(app, /\/api\/documents\/transaction\/prepare/);
  assert.match(app, /\/api\/documents\/transaction\/publish/);
  assert.match(html, /Bundle\.type=document/);
  assert.match(html, /transacción ITI-65/);
  assert.match(app, /result\.transaction/);
  assert.match(app, /transaction\.type !== 'transaction'/);
  assert.doesNotMatch(app, /\/api\/mhd\//);
});

test('busca con sistema, valor y tipo; recupera por documentId o URL', () => {
  for (const id of ['patientIdentifierSystemInput', 'patientIdentifierInput', 'documentTypeFilter', 'retrieveUrlInput']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /\/api\/documents\/search/);
  assert.match(app, /\/api\/documents\/retrieve/);
  assert.match(app, /patientSystem, patientValue/);
});

test('mantiene recursos base, selección de sandbox y búsqueda de pacientes', () => {
  for (const type of ['Organization', 'Patient', 'Practitioner']) assert.match(html, new RegExp(`data-resource-count="${type}"`));
  assert.match(html, /id="serverSelect"/);
  assert.match(app, /\/api\/fhir\/patients\/search/);
  assert.match(app, /serverRevision/);
});

test('IIS recibe el MIME type requerido para módulos mjs', () => {
  const webConfig = fs.readFileSync(path.join(publicDir, 'web.config'), 'utf8');
  assert.match(webConfig, /fileExtension="\.mjs"/);
  assert.match(webConfig, /mimeType="text\/javascript"/);
});
