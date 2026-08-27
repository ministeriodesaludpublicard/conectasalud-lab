const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');
const { appendLog } = require('./logger');
const { prepareIti65Payload, saveSubmittedTransaction } = require('./nationalMhdService');

function normalizeBaseUrl(serverUrl) {
  if (!serverUrl) throw new Error('Debe configurar la URL base del servidor FHIR.');
  return String(serverUrl).replace(/\/+$/, '');
}

function buildHeaders(token) {
  const headers = {
    Accept: 'application/fhir+json, application/json',
    'Content-Type': 'application/fhir+json'
  };
  if (token) headers.Authorization = String(token).startsWith('Bearer ') ? token : `Bearer ${token}`;
  return headers;
}

function serviceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseAllowedHosts(value) {
  return String(value || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
}

function isPrivateNetworkAddress(address) {
  const value = String(address || '').toLowerCase().split('%')[0];
  if (net.isIP(value) === 4) {
    const parts = value.split('.').map(Number);
    return parts[0] === 10
      || parts[0] === 127
      || parts[0] === 0
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
      || parts[0] >= 224;
  }
  if (net.isIP(value) === 6) {
    if (value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value)) return true;
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateNetworkAddress(mapped[1]) : false;
  }
  return false;
}

async function validateRemoteFhirUrl(rawUrl, allowedHosts = []) {
  let parsed;
  try { parsed = new URL(String(rawUrl || '').trim()); }
  catch { throw serviceError('La URL del recurso FHIR no es válida.'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw serviceError('Solo se permiten URLs HTTP o HTTPS.');
  if (parsed.username || parsed.password) throw serviceError('La URL no puede contener credenciales embebidas.');
  if (parsed.href.length > 4096) throw serviceError('La URL supera la longitud permitida.');

  const hostname = parsed.hostname.toLowerCase();
  const allowlisted = allowedHosts.map(item => item.toLowerCase()).includes(hostname);
  if (!allowlisted) {
    let addresses;
    try {
      addresses = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw serviceError('No fue posible resolver el host indicado en la URL.', 422);
    }
    if (!addresses.length || addresses.some(item => isPrivateNetworkAddress(item.address))) {
      throw serviceError('La URL apunta a una red privada o reservada. Autoriza explícitamente el host mediante FHIR_FETCH_ALLOWED_HOSTS.', 403);
    }
  }
  return parsed.toString();
}

async function fetchFhirResource({ serverUrl, token, url, allowedHosts = [] }) {
  const configuredHost = (() => {
    try { return new URL(normalizeBaseUrl(serverUrl)).hostname.toLowerCase(); }
    catch { return null; }
  })();
  const hosts = [...new Set([...allowedHosts, ...parseAllowedHosts(process.env.FHIR_FETCH_ALLOWED_HOSTS), configuredHost].filter(Boolean))];
  let currentUrl = await validateRemoteFhirUrl(url, hosts);
  const startedAt = Date.now();

  appendLog({
    level: 'info', action: 'fhir.fetch.request', direction: 'outbound', method: 'GET', url: currentUrl,
    message: 'Recuperando un recurso FHIR desde una URL.', context: { operation: 'read-by-url' }
  });

  try {
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      const response = await axios({
        method: 'GET', url: currentUrl,
        headers: { Accept: 'application/fhir+json, application/json', ...(token ? { Authorization: String(token).startsWith('Bearer ') ? token : `Bearer ${token}` } : {}) },
        timeout: 30000, maxRedirects: 0, maxContentLength: 20 * 1024 * 1024,
        validateStatus: status => (status >= 200 && status < 300) || (status >= 300 && status < 400)
      });
      if (response.status >= 300) {
        const location = response.headers?.location;
        if (!location) throw serviceError('El servidor respondió con una redirección sin destino.', 502);
        if (redirect === 3) throw serviceError('La URL excedió el máximo de tres redirecciones.', 422);
        currentUrl = await validateRemoteFhirUrl(new URL(location, currentUrl).toString(), hosts);
        continue;
      }
      const resource = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      if (!resource || typeof resource !== 'object' || Array.isArray(resource) || typeof resource.resourceType !== 'string') {
        throw serviceError('La URL respondió JSON, pero no contiene un resourceType FHIR.', 422);
      }
      appendLog({
        level: 'info', action: 'fhir.fetch.response', direction: 'inbound', method: 'GET', url: currentUrl,
        status: response.status, durationMs: Date.now() - startedAt,
        message: 'Recurso FHIR recuperado desde la URL.', responseSummary: summarizeResource(resource)
      });
      return { status: response.status, requestUrl: currentUrl, resource };
    }
  } catch (error) {
    appendLog({
      level: 'error', action: 'fhir.fetch.error', direction: 'inbound', method: 'GET', url: currentUrl,
      status: error.response?.status || error.statusCode || null, durationMs: Date.now() - startedAt,
      message: 'No fue posible recuperar el recurso FHIR desde la URL.', error
    });
    if (error instanceof SyntaxError) throw serviceError('La URL no devolvió un documento JSON válido.', 422);
    throw error;
  }
  throw serviceError('No fue posible recuperar el recurso FHIR.', 502);
}

function summarizeResource(resource) {
  const summary = {
    resourceType: resource?.resourceType || null,
    id: resource?.id || null,
    profiles: Array.isArray(resource?.meta?.profile) ? resource.meta.profile : []
  };
  if (resource?.resourceType === 'Bundle') {
    summary.bundleType = resource.type || null;
    summary.entries = Array.isArray(resource.entry) ? resource.entry.length : 0;
  }
  return summary;
}

async function requestFHIR({ action, method, url, token, data, timeout = 60000, context = {}, acceptedStatuses }) {
  const startedAt = Date.now();
  appendLog({
    level: 'info', action: `${action}.request`, direction: 'outbound', method, url,
    message: 'Solicitud enviada al servidor FHIR.',
    context: { ...context, resource: data ? summarizeResource(data) : null }
  });

  try {
    const response = await axios({
      method, url, data, headers: buildHeaders(token), timeout,
      validateStatus: acceptedStatuses
        ? status => acceptedStatuses.includes(status)
        : status => status >= 200 && status < 300
    });
    appendLog({
      level: response.status >= 400 ? 'warn' : 'info',
      action: `${action}.response`, direction: 'inbound', method, url,
      status: response.status, durationMs: Date.now() - startedAt,
      message: response.status >= 400
        ? 'El servidor FHIR respondió con incidencias de validación.'
        : 'Respuesta recibida desde el servidor FHIR.',
      context, responseSummary: summarizeResource(response.data)
    });
    return response;
  } catch (error) {
    appendLog({
      level: 'error', action: `${action}.error`, direction: 'inbound', method, url,
      status: error.response?.status || null, durationMs: Date.now() - startedAt,
      message: 'Error en la solicitud al servidor FHIR.', context, error
    });
    throw error;
  }
}

async function testFHIRServer(serverUrl, token) {
  const response = await requestFHIR({
    action: 'fhir.metadata', method: 'GET',
    url: `${normalizeBaseUrl(serverUrl)}/metadata`, token, timeout: 30000,
    context: { operation: 'CapabilityStatement' }
  });
  return {
    status: response.status,
    software: response.data?.software || null,
    fhirVersion: response.data?.fhirVersion || null,
    implementation: response.data?.implementation || null
  };
}

function buildValidateUrl(serverUrl, resourceType) {
  const cleanType = String(resourceType || '').trim();
  if (!/^[A-Z][A-Za-z0-9]+$/.test(cleanType)) {
    throw new Error('El JSON debe contener un resourceType FHIR válido para ejecutar $validate.');
  }
  return `${normalizeBaseUrl(serverUrl)}/${cleanType}/$validate`;
}

function normalizeOperationOutcome(outcome, status) {
  const issues = Array.isArray(outcome?.issue) ? outcome.issue : [];
  const normalized = issues.map((issue, index) => ({
    index: index + 1,
    severity: issue.severity || 'information',
    code: issue.code || 'informational',
    diagnostics: issue.diagnostics || issue.details?.text || 'El servidor no proporcionó un diagnóstico.',
    details: issue.details?.text || null,
    expression: Array.isArray(issue.expression) ? issue.expression : [],
    location: Array.isArray(issue.location) ? issue.location : []
  }));
  const counts = normalized.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, { fatal: 0, error: 0, warning: 0, information: 0 });
  return {
    status,
    valid: counts.fatal === 0 && counts.error === 0,
    counts,
    issues: normalized,
    outcome
  };
}

async function validateFHIRResource({ serverUrl, token, resource }) {
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
    throw new Error('Debe proporcionar un recurso FHIR JSON.');
  }
  const url = buildValidateUrl(serverUrl, resource.resourceType);
  const response = await requestFHIR({
    action: 'fhir.validate', method: 'POST', url, token, data: resource,
    timeout: 90000, acceptedStatuses: [200, 400, 422],
    context: { operation: '$validate', resourceType: resource.resourceType }
  });
  if (response.data?.resourceType !== 'OperationOutcome') {
    throw new Error(`El servidor respondió HTTP ${response.status}, pero no devolvió un OperationOutcome.`);
  }
  return normalizeOperationOutcome(response.data, response.status);
}

const MANAGED_RESOURCE_TYPES = new Set(['Organization', 'Patient', 'Practitioner']);

function assertManagedResourceType(resourceType) {
  const cleanType = String(resourceType || '').trim();
  if (!MANAGED_RESOURCE_TYPES.has(cleanType)) {
    throw serviceError('Solo se administran Organization, Patient y Practitioner.', 400);
  }
  return cleanType;
}

async function searchManagedResources({ serverUrl, token, resourceType }) {
  const cleanType = assertManagedResourceType(resourceType);
  const url = buildUrlWithQuery(`${normalizeBaseUrl(serverUrl)}/${cleanType}`, { _count: 100, _format: 'json' });
  const response = await requestFHIR({
    action: 'fhir.resources.search', method: 'GET', url, token, timeout: 30000,
    context: { operation: 'search', resourceType: cleanType }
  });
  return { status: response.status, requestUrl: url, bundle: response.data };
}

async function readManagedResource({ serverUrl, token, resourceType, id }) {
  const cleanType = assertManagedResourceType(resourceType);
  const cleanId = String(id || '').trim();
  if (!/^[A-Za-z0-9\-.]{1,64}$/.test(cleanId)) throw serviceError('El ID FHIR indicado no es válido.');
  const url = `${normalizeBaseUrl(serverUrl)}/${cleanType}/${encodeURIComponent(cleanId)}`;
  const response = await requestFHIR({
    action: 'fhir.resources.read', method: 'GET', url, token, timeout: 30000,
    context: { operation: 'read', resourceType: cleanType, id: cleanId }
  });
  return { status: response.status, requestUrl: url, resource: response.data };
}

async function createManagedResource({ serverUrl, token, resourceType, resource }) {
  const cleanType = assertManagedResourceType(resourceType);
  if (!resource || resource.resourceType !== cleanType) throw serviceError(`El cuerpo debe contener un recurso ${cleanType}.`);
  const response = await requestFHIR({
    action: 'fhir.resources.create', method: 'POST', url: `${normalizeBaseUrl(serverUrl)}/${cleanType}`,
    token, data: resource, timeout: 60000,
    context: { operation: 'create', resourceType: cleanType }
  });
  return {
    status: response.status,
    location: response.headers?.location || response.headers?.['content-location'] || null,
    resource: response.data
  };
}

async function provideDocumentIti65({ serverUrl, token, resource, sourceId }) {
  const prepared = prepareIti65Payload(resource, { sourceId });
  const saved = saveSubmittedTransaction(prepared.transaction);
  const response = await requestFHIR({
    action: 'mhd.iti65.provideDocument', method: 'POST',
    url: normalizeBaseUrl(serverUrl), token, data: prepared.transaction,
    timeout: 90000,
    context: {
      transaction: 'ITI-65', useCase: prepared.useCase,
      generatedTransaction: prepared.generated, savedFile: saved.fileName
    }
  });
  return {
    status: response.status,
    useCase: prepared.useCase,
    useCaseLabel: prepared.useCaseLabel || null,
    generatedTransaction: prepared.generated,
    submittedTransaction: prepared.transaction,
    savedSubmittedTransaction: saved,
    response: response.data,
    location: response.headers?.location || response.headers?.['content-location'] || null
  };
}

function buildUrlWithQuery(url, params = {}) {
  const result = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      result.searchParams.set(key, String(value).trim());
    }
  });
  return result.toString();
}

function buildPatientSearchUrl(serverUrl, criteria = {}) {
  const identifier = String(criteria.identifier || '').trim().slice(0, 200);
  const identifierSystem = String(criteria.identifierSystem || '').trim().slice(0, 500);
  const given = String(criteria.given || '').trim().slice(0, 120);
  const family = String(criteria.family || '').trim().slice(0, 120);
  const birthDate = String(criteria.birthDate || '').trim();
  const gender = String(criteria.gender || '').trim();
  if (!identifier && !given && !family) throw serviceError('La búsqueda requiere un identificador, nombre o apellido.');
  if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw serviceError('La fecha de nacimiento no tiene un formato válido.');
  if (gender && !['female', 'male', 'other', 'unknown'].includes(gender)) throw serviceError('El sexo administrativo indicado no es válido.');
  return buildUrlWithQuery(`${normalizeBaseUrl(serverUrl)}/Patient`, {
    identifier: identifierSystem && identifier ? `${identifierSystem}|${identifier}` : identifier,
    given, family, birthdate: birthDate, gender, _count: 20, _format: 'json'
  });
}

async function searchPatients({ serverUrl, token, criteria }) {
  const url = buildPatientSearchUrl(serverUrl, criteria);
  const response = await requestFHIR({
    action: 'patient-demographics.search', method: 'GET', url, token, timeout: 30000,
    context: { operation: 'patient-demographics-search', criteria: Object.keys(criteria || {}).filter(key => criteria[key]) }
  });
  return { status: response.status, requestUrl: url, bundle: response.data };
}

async function findDocumentReferences({ serverUrl, token, patientIdentifier }) {
  if (!String(patientIdentifier || '').trim()) throw new Error('Debe indicar el identificador del paciente para ITI-67.');
  const url = buildUrlWithQuery(`${normalizeBaseUrl(serverUrl)}/DocumentReference`, {
    'patient.identifier': patientIdentifier, status: 'current', _format: 'json'
  });
  const response = await requestFHIR({
    action: 'mhd.iti67.findDocumentReferences', method: 'GET', url, token, timeout: 30000,
    context: { transaction: 'ITI-67', patientIdentifier }
  });
  return { status: response.status, requestUrl: url, bundle: response.data };
}

function resolveRetrieveUrl(serverUrl, retrieveUrl) {
  const baseUrl = normalizeBaseUrl(serverUrl);
  const value = String(retrieveUrl || '').trim();
  if (!value) throw new Error('Debe indicar el ID, la referencia Bundle/{id} o la URL del documento para ITI-68.');
  if (/^https?:\/\//i.test(value)) {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/\/(Bundle\/[^/?#]+)/i);
    return match ? buildUrlWithQuery(`${baseUrl}/${match[1]}`, { _format: 'json' }) : buildUrlWithQuery(value, { _format: 'json' });
  }
  const clean = value.replace(/^\/+/, '');
  return clean.startsWith('Bundle/')
    ? buildUrlWithQuery(`${baseUrl}/${clean}`, { _format: 'json' })
    : buildUrlWithQuery(`${baseUrl}/Bundle/${encodeURIComponent(clean)}`, { _format: 'json' });
}

async function retrieveDocument({ serverUrl, token, retrieveUrl }) {
  const url = resolveRetrieveUrl(serverUrl, retrieveUrl);
  const response = await requestFHIR({
    action: 'mhd.iti68.retrieveDocument', method: 'GET', url, token, timeout: 30000,
    context: { transaction: 'ITI-68', retrieveUrl }
  });
  return { status: response.status, requestUrl: url, bundle: response.data };
}

module.exports = {
  testFHIRServer,
  isPrivateNetworkAddress,
  validateRemoteFhirUrl,
  fetchFhirResource,
  buildValidateUrl,
  normalizeOperationOutcome,
  validateFHIRResource,
  assertManagedResourceType,
  searchManagedResources,
  readManagedResource,
  createManagedResource,
  provideDocumentIti65,
  buildPatientSearchUrl,
  searchPatients,
  findDocumentReferences,
  resolveRetrieveUrl,
  retrieveDocument
};
