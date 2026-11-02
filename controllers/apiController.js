const fhir = require('../services/fhirServerService');
const { buildGuidedDocument } = require('../services/guidedDocumentService');
<<<<<<< HEAD
=======
const documents = require('../services/documentMediatorService');
const explorer = require('../services/documentExplorerService');
>>>>>>> origin/master
const { readLogs, appendLog } = require('../services/logger');
const { sendJson, readJsonBody } = require('../http/json');

function createSettingsResolver(config) {
  return async function getSettings(body = {}) {
    const requestedUrl = String(body.serverUrl || config.hapiFhirUrl).replace(/\/+$/, '');
    const configured = config.fhirServers.find(item => item.url === requestedUrl);
    const serverUrl = configured ? configured.url : await fhir.validateRemoteFhirUrl(requestedUrl);
    return { serverUrl: serverUrl.replace(/\/+$/, ''), token: body.token || config.bearerToken };
  };
}

function createApiController(config) {
  const getSettings = createSettingsResolver(config);
  const readBody = req => readJsonBody(req, config.maxBodySize);
  const withSettings = async req => {
    const input = await readBody(req);
    return { input, settings: await getSettings(input) };
  };

  const routes = new Map([
<<<<<<< HEAD
=======
    ['GET /api/health', async ({ res }) => sendJson(res, 200, {
      ok: true, service: 'conectasalud-lab', version: '1.9.0'
    })],
>>>>>>> origin/master
    ['GET /api/config', async ({ res }) => sendJson(res, 200, {
      ok: true,
      hapiFhirUrl: config.hapiFhirUrl,
      defaultFhirServerUrl: config.defaultFhirServerUrl,
      fhirServers: config.fhirServers,
<<<<<<< HEAD
      guideUrl: config.guideUrl,
      guideVersion: config.guideVersion,
      sourceId: config.sourceId,
      scope: config.scope
=======
      documentExplorer: { allowGlobal: config.documentExplorer.allowGlobal },
      identifierSystems: config.identifierSystems,
      guideUrl: config.guideUrl,
      guideVersion: config.guideVersion,
      scope: config.scope,
      documentTypes: require('../services/documentProfiles').DOCUMENT_TYPES
>>>>>>> origin/master
    })],
    ['POST /api/fhir/test', async ({ req, res }) => {
      const { settings } = await withSettings(req);
      sendJson(res, 200, { ok: true, result: await fhir.testFHIRServer(settings.serverUrl, settings.token) });
    }],
    ['POST /api/fhir/validate', async ({ req, res }) => {
<<<<<<< HEAD
      const { input, settings } = await withSettings(req);
      sendJson(res, 200, { ok: true, result: await fhir.validateFHIRResource({ ...settings, resource: input.resource }) });
=======
      const input = await readBody(req);
      sendJson(res, 200, { ok: true, result: await fhir.validateFHIRResource({
        serverUrl: config.validationUrl,
        token: config.validationBearerToken,
        resource: input.resource
      }) });
>>>>>>> origin/master
    }],
    ['POST /api/fhir/fetch', async ({ req, res }) => {
      const { input, settings } = await withSettings(req);
      sendJson(res, 200, { ok: true, ...await fhir.fetchFhirResource({ ...settings, url: input.url }) });
    }],
    ['POST /api/fhir/resources/search', async ({ req, res }) => {
      const { input, settings } = await withSettings(req);
      sendJson(res, 200, { ok: true, result: await fhir.searchManagedResources({ ...settings, resourceType: input.resourceType }) });
    }],
    ['POST /api/fhir/resources/create', async ({ req, res }) => {
      const { input, settings } = await withSettings(req);
      sendJson(res, 200, { ok: true, result: await fhir.createManagedResource({ ...settings, resourceType: input.resourceType, resource: input.resource }) });
    }],
    ['POST /api/fhir/patients/search', async ({ req, res }) => {
      const { input, settings } = await withSettings(req);
      sendJson(res, 200, { ok: true, result: await fhir.searchPatients({ ...settings, criteria: input.criteria }) });
    }],
    ['POST /api/guided/build', async ({ req, res }) => {
      const { input, settings } = await withSettings(req);
      sendJson(res, 200, { ok: true, bundle: await buildGuidedDocument({ ...settings, input: input.input }) });
    }],
<<<<<<< HEAD
    ['POST /api/mhd/iti65', async ({ req, res }) => {
      const { input, settings } = await withSettings(req);
      sendJson(res, 200, { ok: true, result: await fhir.provideDocumentIti65({
        ...settings, resource: input.resource, sourceId: input.sourceId || config.sourceId
      }) });
    }],
    ['POST /api/mhd/iti67', async ({ req, res }) => {
      const { input, settings } = await withSettings(req);
      sendJson(res, 200, { ok: true, result: await fhir.findDocumentReferences({ ...settings, patientIdentifier: input.patientIdentifier }) });
    }],
    ['POST /api/mhd/iti68', async ({ req, res }) => {
      const { input, settings } = await withSettings(req);
      sendJson(res, 200, { ok: true, result: await fhir.retrieveDocument({ ...settings, retrieveUrl: input.retrieveUrl }) });
=======
    ['POST /api/documents/transaction/prepare', async ({ req, res }) => {
      const input = await readBody(req);
      sendJson(res, 200, { ok: true, result: documents.preparePublication(input.resource, {
        sourceId: input.sourceId
      }) });
    }],
    ['POST /api/documents/transaction/publish', async ({ req, res }) => {
      const input = await readBody(req);
      sendJson(res, 200, { ok: true, result: await documents.publishPreparedTransaction({
        config: config.documentMediator, transaction: input.transaction
      }) });
    }],
    ['POST /api/documents/prepare', async ({ req, res }) => {
      const input = await readBody(req);
      sendJson(res, 200, { ok: true, result: documents.prepareDocument(input.document) });
    }],
    ['POST /api/documents/publish', async ({ req, res }) => {
      const input = await readBody(req);
      sendJson(res, 200, { ok: true, result: await documents.publishDocument({
        config: config.documentMediator, document: input.document
      }) });
    }],
    ['POST /api/documents/search', async ({ req, res }) => {
      const input = await readBody(req);
      sendJson(res, 200, { ok: true, result: await documents.searchDocuments({
        config: config.documentMediator,
        patientSystem: input.patientSystem,
        patientValue: input.patientValue,
        type: input.type,
        status: input.status || 'current'
      }) });
    }],
    ['POST /api/documents/retrieve', async ({ req, res }) => {
      const input = await readBody(req);
      sendJson(res, 200, { ok: true, result: await documents.retrieveDocument({
        config: config.documentMediator, documentIdOrUrl: input.documentIdOrUrl
      }) });
    }],
    ['POST /api/documents/explorer/search', async ({ req, res }) => {
      const input = await readBody(req);
      sendJson(res, 200, { ok: true, result: await explorer.searchInventory({ config, input }) });
    }],
    ['POST /api/documents/explorer/read', async ({ req, res }) => {
      const input = await readBody(req);
      sendJson(res, 200, { ok: true, result: await explorer.readInventoryResource({ config, input }) });
>>>>>>> origin/master
    }],
    ['GET /api/logs', async ({ requestUrl, res }) => {
      const limit = Math.min(Math.max(Number(requestUrl.searchParams.get('limit') || 200), 1), 500);
      sendJson(res, 200, { ok: true, logs: readLogs(limit) });
    }]
  ]);

  return async function handleApi(req, res) {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const route = routes.get(`${req.method} ${requestUrl.pathname}`);
    if (!route) {
      sendJson(res, 404, { ok: false, error: 'Endpoint fuera del alcance actual de ConectaSalud Lab.' });
      return;
    }
    try {
      await route({ req, res, requestUrl });
    } catch (error) {
      const statusCode = error?.statusCode || error?.response?.status || 500;
      appendLog({
        level: 'error', action: 'api.error', message: 'Error procesando una solicitud.',
        method: req.method, url: req.url, status: statusCode,
        context: { pathname: requestUrl.pathname }, error
      });
<<<<<<< HEAD
      sendJson(res, statusCode, { ok: false, error: error.message, details: error?.response?.data || null });
=======
      sendJson(res, statusCode, { ok: false, error: error.message, details: error?.details || error?.response?.data || null });
>>>>>>> origin/master
    }
  };
}

module.exports = { createSettingsResolver, createApiController };
