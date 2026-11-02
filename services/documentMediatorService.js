const https = require('https');
const axios = require('axios');
const { appendLog } = require('./logger');
const { DOCUMENT_TYPES, identifyDocumentType } = require('./documentProfiles');
const { prepareIti65Payload } = require('./nationalMhdService');

const DOCUMENT_ID_RE = /^(?:doc-)?[a-f0-9]{40}$/;

function serviceError(message, statusCode = 400, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function findResource(bundle, resourceType) {
  return (bundle?.entry || []).find(entry => entry?.resource?.resourceType === resourceType)?.resource || null;
}

function validateDocumentBundle(bundle) {
  if (!bundle || bundle.resourceType !== 'Bundle' || bundle.type !== 'document') {
    throw serviceError('La publicación requiere un Bundle FHIR R4 con type=document.');
  }
  if (!bundle.identifier?.system || !bundle.identifier?.value) {
    throw serviceError('El Bundle documental debe incluir identifier.system e identifier.value.');
  }
  if (!Array.isArray(bundle.entry) || bundle.entry.length === 0) {
    throw serviceError('El Bundle documental no contiene entradas FHIR.');
  }
  const composition = bundle.entry[0]?.resource;
  if (composition?.resourceType !== 'Composition') {
    throw serviceError('Composition debe ser la primera entrada del Bundle documental.');
  }
  const patient = findResource(bundle, 'Patient');
  if (!patient) throw serviceError('El Bundle documental debe incluir Patient.');

  const documentType = identifyDocumentType(bundle);
  if (!documentType) {
    throw serviceError('No se pudo identificar el tipo documental; indica un perfil nacional o un código LOINC de los cuatro casos de uso.');
  }
  // Identificar el caso por el perfil del Bundle no basta: su Composition también debe
  // declarar el perfil y el código documental correspondientes al mismo caso de uso.
  if (!Array.isArray(composition.meta?.profile) ||
      !composition.meta.profile.includes(documentType.compositionProfile)) {
    throw serviceError(`Composition debe declarar el perfil ${documentType.compositionProfile}.`);
  }
  if (!(composition.type?.coding || []).some(coding =>
    coding.system === documentType.loinc.system && coding.code === documentType.loinc.code)) {
    throw serviceError(`Composition debe declarar el código LOINC ${documentType.loinc.code} del documento.`);
  }
  return documentType;
}

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw serviceError('OPENHIM_BASE_URL debe ser una URL HTTP(S) sin credenciales embebidas.', 500);
  }
  return parsed.toString().replace(/\/+$/, '');
}

// JWT del servicio institucional: solo en memoria, nunca en el navegador.
const tokenCache = new Map();
const tokenInFlight = new Map();

function authError(message) { return serviceError(message, 503); }

function resolveTokenUrl(config) {
  let url;
  try { url = new URL(String(config.tokenUrl || 'http://127.0.0.1:3101/auth/token')); }
  catch { throw authError('OPENHIM_TOKEN_URL no es una URL válida.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw authError('OPENHIM_TOKEN_URL debe ser HTTP(S) sin credenciales embebidas.');
  }
  // No enviar credenciales por HTTP a un servidor remoto.
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    throw authError('El servicio de emisión remoto debe utilizar HTTPS.');
  }
  return url.toString();
}

function authKey(config) {
  return JSON.stringify([config.tokenUrl, config.clientId]);
}

function invalidateToken(config) { tokenCache.delete(authKey(config)); }

async function getJwt(config, force = false) {
  if (config.clientId && config.clientSecret) {
    const key = authKey(config);
    const now = Date.now();
    const cached = tokenCache.get(key);
    if (!force && cached && cached.expireAt > now + 60000) return cached.value;
    if (tokenInFlight.has(key)) return tokenInFlight.get(key);
    const promise = (async () => {
      let response;
      try {
        response = await axios.post(resolveTokenUrl(config), {
          client_id: config.clientId,
          client_secret: config.clientSecret
        }, {
          timeout: Math.min(config.timeoutMs || 10000, 15000),
          httpsAgent: new https.Agent({ rejectUnauthorized: config.tlsRejectUnauthorized !== false }),
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
        });
      } catch (e) {
        throw authError(`No se pudo obtener el JWT del emisor institucional (HTTP ${e.response?.status || 'sin respuesta'}). Revisa OPENHIM_TOKEN_URL y las credenciales.`);
      }
      const data = response.data || {};
      if (typeof data.access_token !== 'string' || !data.access_token.trim()) {
        throw authError('El emisor no devolvió access_token.');
      }
      const expiresIn = Number(data.expires_in);
      const expiry = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 300;
      const value = data.access_token.trim();
      tokenCache.set(key, { value, expireAt: Date.now() + expiry * 1000 });
      return value;
    })();
    tokenInFlight.set(key, promise);
    try { return await promise; }
    finally { tokenInFlight.delete(key); }
  }
  // Compatibilidad para entornos de prueba con JWT generado manualmente.
  const fallback = String(config.jwt || '').trim();
  if (fallback) return fallback;
  throw authError('Configura OPENHIM_CLIENT_ID, OPENHIM_CLIENT_SECRET y OPENHIM_TOKEN_URL en el servidor de Lab.');
}

async function createClient(config, operation) {
  const baseURL = normalizeBaseUrl(config.baseUrl);
  const token = await getJwt(config);
  const headers = {
    Accept: 'application/fhir+json, application/json',
    Authorization: `Bearer ${token}`
  };
  if (operation === 'publish') {
    // El control de acceso se realiza mediante JWT en OpenHIM.
    // El antiguo token adicional no se envía.
  }
  return axios.create({
    baseURL, timeout: config.timeoutMs,
    httpsAgent: new https.Agent({ rejectUnauthorized: config.tlsRejectUnauthorized }),
    headers, validateStatus: status => status >= 200 && status < 300
  });
}

function responseDetails(error) {
  return error?.response?.data || error?.details || null;
}

async function mediatorRequest({ config, operation, method, path, params, data, context }) {
  const startedAt = Date.now();
  const requestUrl = `${normalizeBaseUrl(config.baseUrl)}${path}`;
  appendLog({
    level: 'info', action: `documents.${operation}.request`, direction: 'outbound', method, url: requestUrl,
    message: 'Solicitud enviada al mediador documental.', context
  });
  try {
    const send = async () => (await createClient(config, operation)).request({
      method, url: path, params, data,
      headers: data ? { 'Content-Type': 'application/fhir+json' } : undefined
    });
    let response;
    try { response = await send(); }
    catch (error) {
      if (error.response?.status !== 401 || !config.clientId || !config.clientSecret) throw error;
      // Un JWT revocado o rechazado se renueva y se reintenta solo una vez.
      invalidateToken(config);
      await getJwt(config, true);
      response = await send();
    }
    appendLog({
      level: 'info', action: `documents.${operation}.response`, direction: 'inbound', method, url: requestUrl,
      status: response.status, durationMs: Date.now() - startedAt,
      message: 'Respuesta recibida desde el mediador documental.', context
    });
    return response;
  } catch (error) {
    const status = error?.response?.status || error?.statusCode || 502;
    appendLog({
      level: 'error', action: `documents.${operation}.error`, direction: 'inbound', method, url: requestUrl,
      status, durationMs: Date.now() - startedAt,
      message: 'Falló la operación del mediador documental.', context, error
    });
    if (error.response) {
      const diagnostics = error.response.data?.issue?.map(issue => issue.diagnostics).filter(Boolean).join('; ');
      const message = status === 403 && /Publicación ITI-65 no autorizada/i.test(diagnostics || '')
        ? 'El mediador rechazó X-ITI65-Test-Token. Comprueba que ITI65_TEST_TOKEN del backend de Lab coincide con el token configurado en document-mediator (sin compartir su valor).'
        : (diagnostics || error.response.data?.message || error.response.data?.error || `El mediador respondió HTTP ${status}.`);
      throw serviceError(message, status, responseDetails(error));
    }
    throw error;
  }
}

function prepareDocument(document) {
  const documentType = validateDocumentBundle(document);
  const prepared = prepareIti65Payload(document);
  return { document, documentType, transaction: prepared.transaction };
}

function preparePublication(resource, options = {}) {
  const prepared = prepareIti65Payload(resource, { sourceId: options.sourceId });
  // La previsualización es una operación local: no solicita JWT ni escribe en FHIR.
  return { transaction: prepared.transaction, generated: prepared.generated,
    useCase: prepared.useCase, useCaseLabel: prepared.useCaseLabel || null };
}

async function publishPreparedTransaction({ config, transaction }) {
  if (transaction?.resourceType !== 'Bundle' || transaction.type !== 'transaction' ||
      !Array.isArray(transaction.entry) || transaction.entry.length === 0) {
    throw serviceError('Se requiere un Bundle FHIR de tipo transaction previamente generado.');
  }
  const response = await mediatorRequest({
    config, operation: 'publish', method: 'POST', path: config.publishPath,
    data: transaction, context: { transactionEntries: transaction.entry.length }
  });
  return { status: response.status, response: response.data };
}

async function publishDocument({ config, document }) {
  const documentType = validateDocumentBundle(document);
  const transaction = preparePublication(document).transaction;
  const result = await publishPreparedTransaction({ config, transaction });
  return { ...result, documentType, result: result.response };
}

async function searchDocuments({ config, patientSystem, patientValue, type, status = 'current' }) {
  const system = String(patientSystem || '').trim();
  const value = String(patientValue || '').trim();
  if (!system || !value) throw serviceError('La búsqueda ITI-67 requiere el sistema y valor del identificador del paciente.');
  if (system.includes('|') || value.includes('|')) throw serviceError('El sistema y valor no pueden contener el separador FHIR |.');
  const allowedCodes = new Set(Object.values(DOCUMENT_TYPES).map(item => item.loinc.code));
  const cleanType = String(type || '').trim();
  if (cleanType && !allowedCodes.has(cleanType)) throw serviceError('El tipo documental indicado no está soportado.');
  const cleanStatus = String(status || '').trim();
  if (!['current', 'superseded', 'entered-in-error'].includes(cleanStatus)) {
    throw serviceError('El estado documental indicado no es válido.');
  }
  const params = {
    [config.searchPatientIdentifierParam || 'patient.identifier']: `${system}|${value}`,
    [config.searchStatusParam || 'status']: cleanStatus,
    ...(cleanType ? { [config.searchTypeParam || 'type']: `http://loinc.org|${cleanType}` } : {})
  };
  const requestPath = `${config.searchPath}?${new URLSearchParams(params).toString()}`;
  const response = await mediatorRequest({
    config, operation: 'search', method: 'GET', path: config.searchPath, params,
    context: { patientSystem: system, type: cleanType || null, status: cleanStatus }
  });
  if (response.data?.resourceType !== 'Bundle' || response.data?.type !== 'searchset') {
    throw serviceError('El mediador no devolvió un Bundle FHIR de tipo searchset.', 502, response.data);
  }
  return { status: response.status, requestPath, bundle: response.data };
}

function resolveDocumentId(value, config) {
  const raw = String(value || '').trim();
  if (!raw) throw serviceError('Debe indicar el documentId o la URL devuelta por la búsqueda.');
  let documentId = raw;
  if (/^https?:\/\//i.test(raw)) {
    const supplied = new URL(raw);
    const expected = new URL(normalizeBaseUrl(config.baseUrl));
    if (supplied.origin !== expected.origin) throw serviceError('La URL de recuperación no pertenece al mediador configurado.');
    if (!supplied.pathname.includes('/documents/')) throw serviceError('URL de recuperación fuera de la ruta documental.');
    documentId = supplied.pathname.split('/').filter(Boolean).pop() || '';
  } else if (raw.includes('/')) {
    documentId = raw.split('/').filter(Boolean).pop() || '';
  }
  if (!DOCUMENT_ID_RE.test(documentId)) {
    throw serviceError('El identificador documental debe contener 40 caracteres hexadecimales.');
  }
  return documentId;
}

async function retrieveDocument({ config, documentIdOrUrl }) {
  const documentId = resolveDocumentId(documentIdOrUrl, config);
  const path = config.retrievePathTemplate.replace('{documentId}', encodeURIComponent(documentId));
  const response = await mediatorRequest({
    config, operation: 'retrieve', method: 'GET', path,
    context: { documentId }
  });
  if (response.data?.resourceType !== 'Bundle' || response.data?.type !== 'document') {
    throw serviceError('El mediador no devolvió un Bundle FHIR documental.', 502, response.data);
  }
  return { status: response.status, documentId, bundle: response.data };
}

module.exports = {
  preparePublication,
  publishPreparedTransaction,
  DOCUMENT_ID_RE,
  validateDocumentBundle,
  prepareDocument,
  publishDocument,
  searchDocuments,
  resolveDocumentId,
  retrieveDocument
};
