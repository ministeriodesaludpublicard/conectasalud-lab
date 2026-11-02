// FHIR inventory of configured registries and document repositories.
// Not a substitute for mediator ITI-67/ITI-68; those remain separate API endpoints.
const axios = require('axios');
const { appendLog } = require('./logger');

const TYPES = new Set(['DocumentReference', 'Bundle', 'Binary']);
const ROLES = new Set(['registry', 'repository']);
const DOC_STATES = new Set(['current', 'superseded', 'entered-in-error']);
const FHIR_ID = /^[A-Za-z0-9\-.]{1,64}$/;

function problem(message, statusCode = 400) {
  const error = new Error(message); error.statusCode = statusCode; return error;
}
function configuredServer(config, serverId) {
  const server = config.fhirServers.find(s => s.id === serverId && ROLES.has(s.role));
  if (!server) throw problem('Selecciona un registro o repositorio documental configurado por el administrador.', 400);
  return server;
}
function requiredType(server, type) {
  const resourceType = String(type || 'DocumentReference');
  if (!TYPES.has(resourceType)) throw problem('Tipo de recurso no permitido.');
  if (server.role === 'registry' && resourceType !== 'DocumentReference') {
    throw problem('El índice documental se consulta mediante DocumentReference.');
  }
  return resourceType;
}
function safePageUrl(server, type, nextUrl) {
  if (!nextUrl) return new URL(`${server.url}/${type}`);
  let url;
  try { url = new URL(String(nextUrl), `${server.url}/`); }
  catch { throw problem('El enlace de paginación no es válido.'); }
  const base = new URL(server.url);
  if (url.origin !== base.origin || url.username || url.password || url.hash) {
    throw problem('El enlace de paginación pertenece a otro servidor.', 403);
  }
  const root = base.pathname.replace(/\/$/, '');
  const expected = `${root}/${type}`;
  const hapiCursor = url.pathname === root && url.searchParams.has('_getpages');
  if (url.pathname !== expected && !hapiCursor) throw problem('El enlace de paginación no corresponde al catálogo solicitado.', 403);
  return url;
}
function requestHeaders(config, serverId) {
  const token = config.documentExplorer?.tokenByServer?.[serverId] || config.bearerToken;
  return { Accept: 'application/fhir+json, application/json', ...(token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : {}) };
}
async function requestResource(config, url, action, context) {
  const started = Date.now();
  try {
    const response = await axios.get(url.toString(), {
      timeout: 30000, maxRedirects: 0, maxContentLength: 20 * 1024 * 1024,
      headers: requestHeaders(config, context.serverId), validateStatus: status => status >= 200 && status < 300
    });
    if (!response.data || typeof response.data !== 'object' || typeof response.data.resourceType !== 'string') {
      throw problem('El servidor no devolvió un recurso FHIR JSON.', 502);
    }
    appendLog({ level: 'info', action, method: 'GET', direction: 'outbound', status: response.status, durationMs: Date.now() - started, url: url.toString().split('?')[0], context });
    return response.data;
  } catch (error) {
    appendLog({ level: 'error', action, method: 'GET', direction: 'outbound', durationMs: Date.now() - started,
      url: url.toString().split('?')[0], context, error });
    if (error.statusCode) throw error;
    throw problem(error.response?.status === 404 ? 'El recurso no existe en este repositorio.' : 'No fue posible consultar el servidor FHIR. Comprueba sus permisos y capacidades.', error.response?.status || 502);
  }
}
function validatedIdentity(input) {
  const value = String(input.patientValue || '').trim();
  const system = String(input.patientSystem || '').trim();
  if (!value && !system) return null;
  if (!value || !system || value.length > 180 || system.length > 400 || /[|\r\n]/.test(system + value)) throw problem('Especifica un sistema y número de identificación válidos.');
  try { const uri = new URL(system); if (!['http:', 'https:', 'urn:'].includes(uri.protocol)) throw Error(); }
  catch { throw problem('El system debe ser una URI válida (HTTP, HTTPS o URN).'); }
  return { system, value };
}
async function searchInventory({ config, input }) {
  const server = configuredServer(config, String(input.serverId || ''));
  const resourceType = requiredType(server, input.resourceType);
  const identity = validatedIdentity(input);
  const globalSearch = !identity;
  if (globalSearch && !config.documentExplorer.allowGlobal) throw problem('Inventario global deshabilitado por seguridad. Busca por paciente o solicita habilitación administrativa.', 403);
  if (identity && resourceType !== 'DocumentReference') throw problem('Para buscar por paciente, selecciona DocumentReference; Bundle y Binary requieren inventario global habilitado.');
  const url = safePageUrl(server, resourceType, input.nextUrl);
  if (input.nextUrl && identity && url.searchParams.get('patient.identifier') !== `${identity.system}|${identity.value}`) {
    // HAPI opaque continuation tokens may omit original filters; send the first page for those instead.
    if (!url.searchParams.has('_getpages') && !url.searchParams.has('_page_token')) {
      throw problem('La paginación no preserva el identificador de paciente.', 403);
    }
  }
  if (!input.nextUrl) {
    url.searchParams.set('_count', String(Math.min(Math.max(Number(input.pageSize) || 20, 1), config.documentExplorer.maxPageSize)));
    if (identity) url.searchParams.set('patient.identifier', `${identity.system}|${identity.value}`);
    if (resourceType === 'DocumentReference') {
      if (input.status) {
        if (!DOC_STATES.has(input.status)) throw problem('Estado documental desconocido.');
        url.searchParams.set('status', input.status);
      }
      if (input.type) {
        const code = String(input.type || '');
        if (!/^\d{1,9}-\d$/.test(code)) throw problem('Código LOINC no válido.');
        url.searchParams.set('type', `http://loinc.org|${code}`);
      }
    }
  }
  const result = await requestResource(config, url, 'documents.explorer.search', { serverId: server.id, resourceType, globalSearch });
  if (result.resourceType !== 'Bundle' || result.type !== 'searchset') throw problem('El servidor no devolvió un Bundle searchset.', 502);
  const entries = (result.entry || []).filter(entry => entry.resource?.resourceType === resourceType).slice(0, config.documentExplorer.maxPageSize);
  // Never follow remote links automatically: the next URL is revalidated on every request.
  const nextLink = (result.link || []).find(link => link.relation === 'next')?.url || null;
  return { serverId: server.id, serverName: server.name, resourceType, total: Number.isSafeInteger(result.total) ? result.total : null,
    entries: entries.map(e => e.resource), nextUrl: nextLink, count: entries.length, mode: globalSearch ? 'global' : 'patient' };
}
async function readInventoryResource({ config, input }) {
  const server = configuredServer(config, String(input.serverId || ''));
  const resourceType = requiredType(server, input.resourceType);
  const id = String(input.id || '');
  if (!FHIR_ID.test(id)) throw problem('ID de recurso FHIR no válido.');
  const url = new URL(`${server.url}/${resourceType}/${encodeURIComponent(id)}`);
  const resource = await requestResource(config, url, 'documents.explorer.read', { serverId: server.id, resourceType });
  if (resource.resourceType !== resourceType) throw problem('El recurso no coincide con el tipo solicitado.', 502);
  return { serverId: server.id, resource };
}
module.exports = { configuredServer, requiredType, safePageUrl, validatedIdentity, searchInventory, readInventoryResource };
