const test = require('node:test');
const assert = require('node:assert/strict');
const { getApplicationConfig } = require('../config/application');

test('centraliza la configuración portable de la aplicación', () => {
  const config = getApplicationConfig({
    PORT: '4567', MAX_BODY_SIZE_MB: '8', HAPI_FHIR_URL: 'https://fhir.example.org/r4',
    FHIR_GUIDE_VERSION: '0.2.0', FHIR_VALIDATION_URL: 'https://validator.example.org/fhir',
    OPENHIM_BASE_URL: 'https://openhim.example.org:5000', OPENHIM_USERNAME: 'client', OPENHIM_PASSWORD: 'secret',
    OPENHIM_TLS_REJECT_UNAUTHORIZED: 'false'
  });
  assert.equal(config.port, 4567);
  assert.equal(config.maxBodySize, 8 * 1024 * 1024);
  assert.equal(config.defaultFhirServerUrl, 'https://fhir.example.org/r4');
  assert.equal(config.guideVersion, '0.2.0');
  assert.equal(config.validationUrl, 'https://validator.example.org/fhir');
  assert.equal(config.documentMediator.baseUrl, 'https://openhim.example.org:5000');
  assert.equal(config.documentMediator.tlsRejectUnauthorized, false);
  assert.deepEqual(config.scope, ['document-publish', 'document-search', 'document-retrieve']);
});


test('configura emisor JWT institucional sin exponer credenciales a cliente', () => {
  const config = getApplicationConfig({
    OPENHIM_TOKEN_URL: 'https://auth.example.org/auth/token',
    OPENHIM_CLIENT_ID: 'lab-client', OPENHIM_CLIENT_SECRET: 'test-secret',
    DOCUMENT_PUBLISH_PATH: '/transaction'
  });
  assert.equal(config.documentMediator.tokenUrl, 'https://auth.example.org/auth/token');
  assert.equal(config.documentMediator.clientId, 'lab-client');
  assert.equal(config.documentMediator.clientSecret, 'test-secret');
  assert.equal(config.documentMediator.publishPath, '/transaction');
});
