import fs from 'node:fs';
import path from 'node:path';

/** Carga opcional de .env, sin sobreescribir variables que ya existen en el entorno. */
export function loadDotEnv(file = path.join(process.cwd(), '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z_0-9]*)=(.*)\s*$/);
    if (!match || Object.hasOwn(process.env, match[1])) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

const ROLES = new Set(['general', 'registry', 'repository']);
function parseArrayEnv(key) {
  const raw = process.env[key];
  if (!raw?.trim()) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error(`${key} debe ser un arreglo JSON`);
  return data;
}

export function validateBaseUrl(value) {
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) {
    throw new Error('URL FHIR inválida: use http(s), sin credenciales, query ni fragmento');
  }
  return url.toString().replace(/\/$/, '');
}

export function readConfig() {
  let raw = parseArrayEnv('FHIR_SERVERS_JSON');
  if (!raw.length && process.env.HAPI_FHIR_URL) raw = [{ id: 'general', name: 'FHIR general', role: 'general', baseUrl: process.env.HAPI_FHIR_URL }];
  const seen = new Set();
  const servers = raw.map((s, i) => {
    const id = String(s.id ?? `fhir-${i + 1}`);
    const roles = Array.isArray(s.roles) ? s.roles : [s.role ?? 'general'];
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || seen.has(id)) throw new Error(`Id de servidor inválido o duplicado: ${id}`);
    if (!roles.length || roles.some(r => !ROLES.has(r))) throw new Error(`Rol inválido para ${id}`);
    seen.add(id);
    const baseUrl = validateBaseUrl(s.baseUrl ?? s.url);
    const retrievalOrigins = (s.retrievalOrigins ?? []).map(origin => {
      const u = new URL(validateBaseUrl(origin));
      if (u.pathname !== '/' && u.pathname !== '') throw new Error(`retrievalOrigins debe ser origen puro: ${origin}`);
      return u.origin;
    });
    return { id, name: String(s.name ?? id), roles: [...new Set(roles)], baseUrl, retrievalOrigins,
      tokenEnv: typeof s.tokenEnv === 'string' && /^[A-Z_][A-Z_0-9]*$/.test(s.tokenEnv) ? s.tokenEnv : null };
  });
  const configured = parseArrayEnv('IDENTIFIER_SYSTEMS_JSON');
  const identifiers = configured.length ? configured : [
    { id: 'cedula', name: 'Cédula de identidad (RD)', system: 'https://digital.msp.gob.do/fhir/sid/cedula', country: 'DOM' },
    { id: 'passport', name: 'Pasaporte', system: '', country: 'DOM' },
    { id: 'institutional', name: 'Identificador institucional', system: '', country: 'DOM' },
  ];
  return { servers, identifiers: identifiers.map(x => ({ id: String(x.id), name: String(x.name), system: String(x.system ?? ''), country: String(x.country ?? '') })) };
}

export function publicServers(config) {
  return config.servers.map(({ id, name, roles, baseUrl }) => ({ id, name, roles, baseUrl }));
}

export function serverByRole(config, id, role) {
  const server = config.servers.find(s => s.id === id && s.roles.includes(role));
  if (!server) throw Object.assign(new Error(`Servidor de tipo ${role} no configurado`), { statusCode: 400 });
  return server;
}
