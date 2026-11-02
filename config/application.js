const path = require('path');
const { getEndpointConfig } = require('./endpoints');

const DEFAULT_PORT = 3445;
const DEFAULT_MAX_BODY_SIZE_MB = 20;
const DEFAULT_GUIDE_URL = 'https://digital.msp.gob.do/fhir/conectaton/';

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanValue(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function getApplicationConfig(env = process.env, warn = console.warn) {
  const endpoints = getEndpointConfig(env, warn);
  const maxBodySizeMb = positiveNumber(env.MAX_BODY_SIZE_MB, DEFAULT_MAX_BODY_SIZE_MB);
  return {
    port: positiveNumber(env.PORT, DEFAULT_PORT),
    publicDir: path.join(__dirname, '..', 'public'),
    maxBodySize: Math.round(maxBodySizeMb * 1024 * 1024),
    maxBodySizeMb,
    guideUrl: String(env.FHIR_GUIDE_URL || DEFAULT_GUIDE_URL),
    guideVersion: String(env.FHIR_GUIDE_VERSION || '').trim() || null,
    bearerToken: String(env.FHIR_BEARER_TOKEN || ''),
    validationUrl: String(env.FHIR_VALIDATION_URL || endpoints.hapiFhirUrl).replace(/\/+$/, ''),
    documentExplorer: { allowGlobal: booleanValue(env.DOCUMENT_EXPLORER_ALLOW_GLOBAL, false), maxPageSize: 50, tokenByServer: parseExplorerTokens(env.FHIR_EXPLORER_TOKENS_JSON) },
    identifierSystems: getIdentifierSystems(env),
    validationBearerToken: String(env.FHIR_VALIDATION_BEARER_TOKEN || ''),
    documentMediator: {
      baseUrl: String(env.OPENHIM_BASE_URL || '').replace(/\/+$/, ''),
      timeoutMs: positiveNumber(env.OPENHIM_TIMEOUT_MS, 90000),
      tlsRejectUnauthorized: booleanValue(env.OPENHIM_TLS_REJECT_UNAUTHORIZED, true),
      username: String(env.OPENHIM_USERNAME || ''),
      password: String(env.OPENHIM_PASSWORD || ''),
      publishUsername: String(env.OPENHIM_PUBLISH_USERNAME || ''),
      publishPassword: String(env.OPENHIM_PUBLISH_PASSWORD || ''),
      jwt: String(env.OPENHIM_JWT || ''),
      tokenUrl: String(env.OPENHIM_TOKEN_URL || 'http://127.0.0.1:3101/auth/token'),
      clientId: String(env.OPENHIM_CLIENT_ID || ''),
      clientSecret: String(env.OPENHIM_CLIENT_SECRET || ''),
      testToken: String(env.ITI65_TEST_TOKEN || ''),
      publishPath: String(env.DOCUMENT_PUBLISH_PATH || '/transaction'),
      searchPath: String(env.DOCUMENT_SEARCH_PATH || '/DocumentReference'),
      searchPatientIdentifierParam: String(env.DOCUMENT_SEARCH_PATIENT_IDENTIFIER_PARAM || 'patient.identifier'),
      searchStatusParam: String(env.DOCUMENT_SEARCH_STATUS_PARAM || 'status'),
      searchTypeParam: String(env.DOCUMENT_SEARCH_TYPE_PARAM || 'type'),
      retrievePathTemplate: String(env.DOCUMENT_RETRIEVE_PATH_TEMPLATE || '/documents/{documentId}')
    },
    scope: ['document-publish', 'document-search', 'document-retrieve'],
    ...endpoints
  };
}

function parseExplorerTokens(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, token]) => /^[A-Za-z0-9_-]{1,80}$/.test(key) && typeof token === 'string'));
  } catch { return {}; }
}
function getIdentifierSystems(env = process.env) {
  const defaults = [
    { code: 'cedula', name: 'Cédula dominicana', system: 'https://digital.msp.gob.do/fhir/sid/cedula' },
    { code: 'passport', name: 'Pasaporte (configurar system)', system: '' },
    { code: 'institutional', name: 'Identificador institucional (configurar system)', system: '' }
  ];
  if (!env.PATIENT_IDENTIFIER_SYSTEMS_JSON) return defaults;
  try {
    const values = JSON.parse(env.PATIENT_IDENTIFIER_SYSTEMS_JSON);
    if (!Array.isArray(values)) return defaults;
    return values.filter(value => value && typeof value.code === 'string' && typeof value.name === 'string')
      .map(value => ({ code: value.code, name: value.name, system: String(value.system || '') }));
  } catch { return defaults; }
}

module.exports = { getIdentifierSystems, DEFAULT_PORT, DEFAULT_MAX_BODY_SIZE_MB, DEFAULT_GUIDE_URL, booleanValue, getApplicationConfig };
