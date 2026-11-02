const DEFAULT_HAPI_FHIR_URL = 'http://localhost:8080/fhir';

function normalizeServerUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('La URL del servidor FHIR debe utilizar HTTP o HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('La URL del servidor FHIR no puede contener credenciales.');
  }
  return parsed.toString().replace(/\/+$/, '');
}

function parseServersJson(value, warn = console.warn) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error('debe ser un arreglo JSON');
    return parsed.map((item, index) => ({
      id: String(item?.id || `configured-${index + 1}`),
      name: String(item?.name || `Servidor FHIR ${index + 1}`),
<<<<<<< HEAD
      url: normalizeServerUrl(item?.url),
=======
      url: normalizeServerUrl(item?.url || item?.baseUrl),
      role: ['general', 'registry', 'repository'].includes(item?.role) ? item.role : 'general',
>>>>>>> origin/master
      locked: true
    }));
  } catch (error) {
    warn(`FHIR_SERVERS_JSON no pudo cargarse: ${error.message}`);
    return [];
  }
}

function parseConfiguredServers(env = process.env, warn = console.warn) {
  const primaryUrl = normalizeServerUrl(env.HAPI_FHIR_URL || DEFAULT_HAPI_FHIR_URL);
  const primary = {
    id: 'configured-default',
    name: String(env.HAPI_FHIR_NAME || 'Servidor FHIR predeterminado'),
    url: primaryUrl,
<<<<<<< HEAD
=======
    role: 'general',
>>>>>>> origin/master
    locked: true
  };
  return [primary, ...parseServersJson(env.FHIR_SERVERS_JSON, warn)]
    .filter((item, index, list) => list.findIndex(candidate => candidate.url === item.url) === index);
}

function getEndpointConfig(env = process.env, warn = console.warn) {
  const fhirServers = parseConfiguredServers(env, warn);
  const hapiFhirUrl = fhirServers[0].url;
  return {
    hapiFhirUrl,
    defaultFhirServerUrl: hapiFhirUrl,
    fhirServers
  };
}

module.exports = {
  DEFAULT_HAPI_FHIR_URL,
  normalizeServerUrl,
  parseServersJson,
  parseConfiguredServers,
  getEndpointConfig
};
