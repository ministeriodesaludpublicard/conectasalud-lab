const test = require('node:test');
const assert = require('node:assert/strict');
const { getApplicationConfig } = require('../config/application');

test('centraliza la configuración portable de la aplicación', () => {
  const config = getApplicationConfig({
    PORT: '4567', MAX_BODY_SIZE_MB: '8', HAPI_FHIR_URL: 'https://fhir.example.org/r4',
    FHIR_GUIDE_VERSION: 'actual', MHD_SOURCE_ID: 'urn:oid:1.2.3'
  });
  assert.equal(config.port, 4567);
  assert.equal(config.maxBodySize, 8 * 1024 * 1024);
  assert.equal(config.defaultFhirServerUrl, 'https://fhir.example.org/r4');
  assert.equal(config.guideVersion, 'actual');
  assert.equal(config.sourceId, 'urn:oid:1.2.3');
  assert.deepEqual(config.scope, ['ITI-65', 'ITI-67', 'ITI-68']);
});
