const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildValidateUrl,
  normalizeOperationOutcome,
  isPrivateNetworkAddress,
  validateRemoteFhirUrl,
  assertManagedResourceType,
  buildPatientSearchUrl
} = require('../services/fhirServerService');

test('$validate se ejecuta en el nivel del resourceType', () => {
  assert.equal(
    buildValidateUrl('http://servidor.test/fhir/', 'Patient'),
    'http://servidor.test/fhir/Patient/$validate'
  );
  assert.equal(
    buildValidateUrl('http://servidor.test/fhir', 'Bundle'),
    'http://servidor.test/fhir/Bundle/$validate'
  );
});

test('rechaza resourceType inseguro al construir la URL de validación', () => {
  assert.throws(() => buildValidateUrl('http://servidor.test/fhir', '../Patient'), /resourceType FHIR válido/);
});

test('OperationOutcome se resume por severidad y determina si es válido', () => {
  const result = normalizeOperationOutcome({
    resourceType: 'OperationOutcome',
    issue: [
      { severity: 'error', code: 'required', diagnostics: 'Falta identifier', expression: ['Patient.identifier'] },
      { severity: 'warning', code: 'business-rule', details: { text: 'Revisar teléfono' } }
    ]
  }, 200);
  assert.equal(result.valid, false);
  assert.equal(result.counts.error, 1);
  assert.equal(result.counts.warning, 1);
  assert.equal(result.issues[0].expression[0], 'Patient.identifier');
});

test('la carga por URL reconoce direcciones privadas y reservadas', () => {
  assert.equal(isPrivateNetworkAddress('127.0.0.1'), true);
  assert.equal(isPrivateNetworkAddress('192.168.1.20'), true);
  assert.equal(isPrivateNetworkAddress('10.0.0.4'), true);
  assert.equal(isPrivateNetworkAddress('8.8.8.8'), false);
  assert.equal(isPrivateNetworkAddress('::1'), true);
});

test('la carga por URL bloquea protocolos no web y redes privadas no autorizadas', async () => {
  await assert.rejects(validateRemoteFhirUrl('file:///etc/passwd'), /HTTP o HTTPS/);
  await assert.rejects(validateRemoteFhirUrl('http://127.0.0.1:8080/fhir/Patient/1'), /red privada o reservada/);
  assert.equal(
    await validateRemoteFhirUrl('http://127.0.0.1:8080/fhir/Patient/1', ['127.0.0.1']),
    'http://127.0.0.1:8080/fhir/Patient/1'
  );
});

test('la administración FHIR se limita a los tres recursos base definidos', () => {
  for (const type of ['Organization', 'Patient', 'Practitioner']) assert.equal(assertManagedResourceType(type), type);
  assert.throws(() => assertManagedResourceType('PractitionerRole'), /Solo se administran/);
  assert.throws(() => assertManagedResourceType('User'), /Solo se administran/);
});

test('la búsqueda tipo MPI construye parámetros demográficos FHIR controlados', () => {
  const url = new URL(buildPatientSearchUrl('https://sandbox.example/fhir/', {
    identifierSystem: 'https://digital.msp.gob.do/fhir/sid/cedula', identifier: '00100000001',
    given: 'María', family: 'Pérez', birthDate: '1990-05-15', gender: 'female'
  }));
  assert.equal(url.pathname, '/fhir/Patient');
  assert.equal(url.searchParams.get('identifier'), 'https://digital.msp.gob.do/fhir/sid/cedula|00100000001');
  assert.equal(url.searchParams.get('given'), 'María');
  assert.equal(url.searchParams.get('family'), 'Pérez');
  assert.equal(url.searchParams.get('birthdate'), '1990-05-15');
  assert.equal(url.searchParams.get('_count'), '20');
});

test('la búsqueda de pacientes evita consultas demográficas sin criterio identificador', () => {
  assert.throws(() => buildPatientSearchUrl('https://sandbox.example/fhir', { birthDate: '1990-05-15' }), /identificador, nombre o apellido/);
});
