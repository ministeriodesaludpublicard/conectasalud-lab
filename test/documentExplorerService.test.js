const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let mockResponse;
let calledUrl = '';
Module._load = function(name, parent, main) {
  if (name === './logger' && parent?.filename?.endsWith('documentExplorerService.js')) return { appendLog() {} };
  if (name === 'axios') return {
    get: async (url) => { calledUrl = url; if (mockResponse instanceof Error) throw mockResponse; return { status: 200, data: mockResponse }; }
  };
  return originalLoad.apply(this, arguments);
};
const explorer = require('../services/documentExplorerService');
Module._load = originalLoad;

const config = {
  fhirServers: [
    { id: 'mpi', name: 'MPI', url: 'http://localhost:8080/fhir', role: 'general' },
    { id: 'registry', name: 'Registro', url: 'http://localhost:8083/fhir', role: 'registry' },
    { id: 'ips', name: 'IPS', url: 'http://localhost:8084/fhir', role: 'repository' }
  ],
  documentExplorer: { allowGlobal: false, maxPageSize: 50 },
  bearerToken: ''
};
test('solo admite registros y repositorios configurados por el administrador', () => {
  assert.throws(() => explorer.configuredServer(config, 'mpi'), /registro o repositorio/);
  assert.throws(() => explorer.configuredServer(config, 'evil'), /registro o repositorio/);
  assert.equal(explorer.configuredServer(config, 'registry').role, 'registry');
});
test('el registro admite únicamente DocumentReference', () => {
  assert.throws(() => explorer.requiredType(config.fhirServers[1], 'Binary'), /DocumentReference/);
  assert.equal(explorer.requiredType(config.fhirServers[1], 'DocumentReference'), 'DocumentReference');
});
test('no permite URLs de paginación a hosts externos o recursos distintos', () => {
  const server = config.fhirServers[1];
  assert.throws(() => explorer.safePageUrl(server, 'DocumentReference', 'http://evil.test/DocumentReference'), /otro servidor/);
  assert.throws(() => explorer.safePageUrl(server, 'DocumentReference', 'http://localhost:8083/fhir/Patient'), /catálogo solicitado/);
  assert.equal(explorer.safePageUrl(server, 'DocumentReference', 'http://localhost:8083/fhir?_getpages=opaque').pathname, '/fhir');
});
test('bloquea inventario global si no está habilitado', async () => {
  await assert.rejects(explorer.searchInventory({ config, input: { serverId: 'registry' } }), /Inventario global deshabilitado/);
});
test('construye búsqueda patient.identifier=system|value en el registro', async () => {
  mockResponse = { resourceType: 'Bundle', type: 'searchset', total: 1,
    entry: [{ resource: { resourceType: 'DocumentReference', id: 'test123' } }], link: [] };
  const result = await explorer.searchInventory({ config, input: { serverId: 'registry', resourceType: 'DocumentReference',
    patientSystem: 'https://digital.msp.gob.do/fhir/sid/cedula', patientValue: '00100000001', type: '60591-5', status: 'current' } });
  const search = new URL(calledUrl);
  assert.equal(search.port, '8083');
  assert.equal(search.searchParams.get('patient.identifier'), 'https://digital.msp.gob.do/fhir/sid/cedula|00100000001');
  assert.equal(search.searchParams.get('type'), 'http://loinc.org|60591-5');
  assert.equal(result.entries.length, 1);
});
test('inventario global se puede habilitar explícitamente sin afectar los recursos base', async () => {
  mockResponse = { resourceType: 'Bundle', type: 'searchset', entry: [{ resource: { resourceType: 'Bundle', type: 'document', id: 'b123' } }] };
  const enabled = { ...config, documentExplorer: { allowGlobal: true, maxPageSize: 50 } };
  const result = await explorer.searchInventory({ config: enabled, input: { serverId: 'ips', resourceType: 'Bundle' } });
  assert.equal(result.entries[0].id, 'b123');
  assert.match(calledUrl, /:8084\/fhir\/Bundle/);
});
test('solo permite lectura por ID FHIR y servidores autorizados', async () => {
  await assert.rejects(explorer.readInventoryResource({ config, input: { serverId: 'ips', resourceType: 'Bundle', id: '../Patient/1' } }), /ID de recurso/);
  mockResponse = { resourceType: 'Bundle', type: 'document', id: 'b123' };
  const result = await explorer.readInventoryResource({ config, input: { serverId: 'ips', resourceType: 'Bundle', id: 'b123' } });
  assert.equal(result.resource.id, 'b123');
});
