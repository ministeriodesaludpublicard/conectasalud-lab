const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/main.mjs'), 'utf8');
test('mantiene íntegramente el menú original de ocho secciones', () => {
  for (const page of ['home','resources','guided','editor','iti65','queries','servers','activity']) {
    assert.match(html, new RegExp(`class="nav-link[^>]*data-page-target="${page}"`));
    assert.match(html, new RegExp(`class="page(?: active)?" data-page="${page}"`));
  }
});
test('integra identificadores y explorador en consulta sin eliminar ITI-67 y 68', () => {
  for (const id of ['patientIdentifierTypeSelect','patientIdentifierSystemInput','patientIdentifierInput','explorerServerSelect','explorerResourceType','explorerResult','iti67Button','iti68Button'])
    assert.match(html, new RegExp(`id="${id}"`));
  for (const endpoint of ['/api/documents/search','/api/documents/retrieve','/api/documents/explorer/search','/api/documents/explorer/read'])
    assert.ok(script.includes(endpoint), `Falta ${endpoint}`);
});
