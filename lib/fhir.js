import { validateBaseUrl } from './config.js';

export class FhirRequestError extends Error {
  constructor(message, code = 502) { super(message); this.statusCode = code; }
}

/** Mantiene páginas y búsquedas dentro de la base FHIR asignada, nunca en un host arbitrario. */
export function resolveFhirUrl(server, pathOrNext) {
  const base = new URL(server.baseUrl + '/');
  const target = pathOrNext.startsWith('http://') || pathOrNext.startsWith('https://')
    ? new URL(pathOrNext) : new URL(pathOrNext, base);
  if (target.protocol !== base.protocol || target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) {
    throw new FhirRequestError('La URL no pertenece al servidor configurado', 400);
  }
  if (target.username || target.password || target.hash) throw new FhirRequestError('URL inválida', 400);
  return target;
}

/** URLs ITI-68 son opacas; solo se permiten orígenes configurados explícitamente. */
export function resolveRetrievalUrl(server, docUrl) {
  const u = new URL(docUrl, server.baseUrl + '/');
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.hash) throw new FhirRequestError('URL documental inválida', 400);
  const root = new URL(validateBaseUrl(server.baseUrl));
  const allowedOrigin = u.origin === root.origin || (server.retrievalOrigins ?? []).includes(u.origin);
  if (!allowedOrigin) throw new FhirRequestError('El documento apunta fuera del repositorio configurado. Declare el origen en retrievalOrigins si es legítimo.', 400);
  return u;
}

function authHeaders(server, url, accept) {
  const headers = { Accept: accept };
  // Nunca filtramos un token configurado para un servidor hacia otro origen.
  if (new URL(server.baseUrl).origin === url.origin) {
    const token = (server.tokenEnv && process.env[server.tokenEnv]) || process.env.FHIR_BEARER_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function requestFhir(server, url, { accept = 'application/fhir+json', maxBytes = 12 * 1024 * 1024, timeoutMs = 15000 } = {}) {
  const response = await fetch(url, {
    headers: authHeaders(server, url, accept), redirect: 'manual', signal: AbortSignal.timeout(timeoutMs)
  });
  if (response.status >= 300 && response.status < 400) throw new FhirRequestError('Redirección no seguida por seguridad. Configure el destino final.', 502);
  const limit = Number(response.headers.get('content-length'));
  if (limit > maxBytes) { await response.body?.cancel(); throw new FhirRequestError('Respuesta demasiado grande', 413); }
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response.body ?? []) {
      size += chunk.length;
      if (size > maxBytes) throw new FhirRequestError('Respuesta demasiado grande', 413);
      chunks.push(chunk);
    }
  } catch (err) { await response.body?.cancel().catch(() => {}); throw err; }
  const body = Buffer.concat(chunks);
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  if (!response.ok) {
    let reason = body.toString('utf8').slice(0, 500);
    try {const oo = JSON.parse(reason); reason = oo.issue?.map(x => x.diagnostics || x.details?.text).filter(Boolean).join('; ') || reason;} catch {}
    throw new FhirRequestError(`Servidor FHIR HTTP ${response.status}: ${reason}`, response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  return { body, contentType, status: response.status };
}

export function asFhirBundle({ body }) {
  let data;
  try { data = JSON.parse(body.toString('utf8')); } catch { throw new FhirRequestError('El servidor no devolvió JSON válido'); }
  if (data.resourceType !== 'Bundle' || data.type !== 'searchset') throw new FhirRequestError('Se esperaba un Bundle FHIR de búsqueda');
  return data;
}

export function nextLink(bundle) {
  return bundle.link?.find(link => link.relation === 'next')?.url ?? null;
}

export function safeSummary(resource) {
  const r = resource || {};
  return {
    id: r.id || '', resourceType: r.resourceType || '',
    status: r.status || '',
    subject: r.subject?.reference || r.subject?.identifier?.value || '',
    title: r.description || r.type?.text || r.type?.coding?.[0]?.display || r.type?.coding?.[0]?.code || r.id || 'Documento',
    type: r.type?.coding?.[0]?.code || '', date: r.date || r.content?.[0]?.attachment?.creation || '',
    repository: r.content?.[0]?.attachment?.url || '', contentType: r.content?.[0]?.attachment?.contentType || '',
    identifier: r.masterIdentifier?.value || r.identifier?.[0]?.value || '',
    // El cliente usa URL opaca, que siempre vuelve a validarse al recuperar.
    attachmentUrl: r.content?.[0]?.attachment?.url || ''
  };
}

export function searchParams({ value, system, patient, status = 'current', type, count = 25 }) {
  const q = new URLSearchParams();
  if (patient) {
    if (!/^Patient\/[A-Za-z0-9._-]{1,100}$/.test(patient)) throw new FhirRequestError('Referencia del paciente inválida. Formato: Patient/{id}', 400);
    q.set('patient', patient);
  } else {
    if (!value || !system) throw new FhirRequestError('Indique el identificador y su sistema, o una referencia Patient/{id}', 400);
    if (String(value).length > 128 || String(system).length > 350 || /[|\n\r]/.test(system) || /[|\n\r]/.test(value)) throw new FhirRequestError('Identificador no válido', 400);
    q.set('patient.identifier', `${system}|${value}`);
  }
  if (!['current', 'superseded', 'entered-in-error'].includes(status)) throw new FhirRequestError('Estado documental inválido', 400);
  q.set('status', status);
  if (type) {
    if (type.length > 120) throw new FhirRequestError('Tipo documental demasiado largo', 400);
    q.set('type', type);
  }
  q.set('_count', String(Math.min(50, Math.max(1, Number(count) || 25))));
  return q;
}
