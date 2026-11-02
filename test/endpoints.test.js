const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_HAPI_FHIR_URL, normalizeServerUrl, parseServersJson, getEndpointConfig
} = require('../config/endpoints');

test('usa un servidor FHIR local portable cuando el entorno no define otro', () => {
  const config = getEndpointConfig({});
  assert.equal(config.defaultFhirServerUrl, DEFAULT_HAPI_FHIR_URL);
  assert.equal(config.hapiFhirUrl, DEFAULT_HAPI_FHIR_URL);
  assert.deepEqual(config.fhirServers, [{
    id: 'configured-default', name: 'Servidor FHIR predeterminado',
    url: DEFAULT_HAPI_FHIR_URL, role: 'general', locked: true
  }]);
});

test('configura el servidor inicial y servidores administrados desde el entorno', () => {
  const config = getEndpointConfig({
    HAPI_FHIR_NAME: 'Sandbox principal',
    HAPI_FHIR_URL: 'https://principal.example/fhir/',
    FHIR_SERVERS_JSON: JSON.stringify([
      { id: 'a', name: 'Sandbox A', url: 'https://a.example/fhir/' },
      { id: 'b', name: 'Sandbox B', url: 'https://b.example/fhir' }
    ])
  });
  assert.equal(config.fhirServers.length, 3);
  assert.equal(config.fhirServers[0].name, 'Sandbox principal');
  assert.equal(config.fhirServers[0].url, 'https://principal.example/fhir');
  assert.equal(config.fhirServers[1].name, 'Sandbox A');
  assert.equal(config.fhirServers[2].url, 'https://b.example/fhir');
});

test('elimina duplicados por URL y conserva el servidor inicial primero', () => {
  const config = getEndpointConfig({
    HAPI_FHIR_URL: 'https://principal.example/fhir/',
    FHIR_SERVERS_JSON: JSON.stringify([{ name: 'Repetido', url: 'https://principal.example/fhir/' }])
  });
  assert.equal(config.fhirServers.length, 1);
  assert.equal(config.fhirServers[0].id, 'configured-default');
});

test('descarta FHIR_SERVERS_JSON inválido sin impedir el arranque', () => {
  const warnings = [];
  assert.deepEqual(parseServersJson('{invalido', message => warnings.push(message)), []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /no pudo cargarse/);
});

test('rechaza protocolos inseguros y credenciales incluidas en URL', () => {
  assert.throws(() => normalizeServerUrl('file:///tmp/fhir'), /HTTP o HTTPS/);
  assert.throws(() => normalizeServerUrl('https://user:secret@example.org/fhir'), /credenciales/);
});
