const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  validateDocumentBundle, publishDocument, searchDocuments,
  resolveDocumentId, retrieveDocument
} = require('../services/documentMediatorService');
const { DOCUMENT_TYPES, PATIENT_PROFILE } = require('../services/documentProfiles');

function bundle(type = DOCUMENT_TYPES.nps) {
  return {
    resourceType: 'Bundle', id: 'document-1', type: 'document',
    meta: { profile: [type.bundleProfile] },
    identifier: { system: 'https://example.org/documents', value: 'DOC-1' },
    entry: [
      { resource: {
        resourceType: 'Composition', id: 'composition-1',
        meta: { profile: [type.compositionProfile] }, status: 'final',
        type: { coding: [type.loinc] }, subject: { reference: 'Patient/p1' },
        date: '2026-10-22T12:00:00Z', author: [{ reference: 'Organization/o1' }], title: 'Prueba'
      } },
      { resource: {
        resourceType: 'Patient', id: 'p1', meta: { profile: [PATIENT_PROFILE] },
        identifier: [{ system: 'https://example.org/cedula', value: '00100000001' }]
      } }
    ]
  };
}

test('acepta los cuatro Bundles documentales y exige sus perfiles/códigos', () => {
  for (const type of Object.values(DOCUMENT_TYPES)) {
    assert.equal(validateDocumentBundle(bundle(type)).key, type.key);
  }
  const invalidProfile = bundle();
  invalidProfile.entry[0].resource.meta.profile = ['https://example.org/Composition'];
  assert.throws(() => validateDocumentBundle(invalidProfile), /CompositionDONPS/);
  const invalidLoinc = bundle();
  invalidLoinc.entry[0].resource.type.coding = [{ system: 'http://loinc.org', code: '99999-9' }];
  assert.throws(() => validateDocumentBundle(invalidLoinc), /LOINC 60591-5/);
});

test('rechaza BundleTransaccDO, documentos sin identifier y Composition fuera de la primera entrada', () => {
  const transaction = bundle(); transaction.type = 'transaction';
  assert.throws(() => validateDocumentBundle(transaction), /type=document/);
  const noIdentifier = bundle(); delete noIdentifier.identifier;
  assert.throws(() => validateDocumentBundle(noIdentifier), /identifier/);
  const wrongOrder = bundle(); wrongOrder.entry.reverse();
  assert.throws(() => validateDocumentBundle(wrongOrder), /primera entrada/);
});

let server;
let baseUrl;
let requests;
const documentId = `doc-${'a'.repeat(40)}`;

test.before(async () => {
  requests = [];
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    const body = raw ? JSON.parse(raw) : null;
    requests.push({ method: req.method, pathname: url.pathname, params: Object.fromEntries(url.searchParams), authorization: req.headers.authorization, body });
    res.setHeader('content-type', 'application/json');
    if (url.pathname === '/auth/token') return res.end(JSON.stringify({ access_token: 'jwt-local-de-prueba', token_type: 'Bearer', expires_in: 900 }));
    if (req.method === 'POST' && url.pathname === '/transaction') return res.end(JSON.stringify({ status: 'completed', documentId }));
    if (url.pathname === `/documents/${documentId}`) return res.end(JSON.stringify(bundle()));
    return res.end(JSON.stringify({ resourceType: 'Bundle', type: 'searchset', entry: [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

function config() {
  return {
    baseUrl, timeoutMs: 5000, tlsRejectUnauthorized: true,
    tokenUrl: `${baseUrl}/auth/token`, clientId: 'conectasalud-lab', clientSecret: 'secreto-simulado',
    publishPath: '/transaction', searchPath: '/DocumentReference',
    searchPatientIdentifierParam: 'patient.identifier', searchStatusParam: 'status', searchTypeParam: 'type',
    retrievePathTemplate: '/documents/{documentId}'
  };
}

test('publica un BundleTransaccDO a través de POST /transaction con JWT', async () => {
  const result = await publishDocument({ config: config(), document: bundle() });
  assert.equal(result.status, 200);
  assert.equal(result.result.documentId, documentId);
  const sent = requests.at(-1);
  assert.equal(sent.pathname, '/transaction');
  assert.equal(sent.authorization, 'Bearer jwt-local-de-prueba');
  assert.equal(sent.body.type, 'transaction');
  assert.deepEqual(sent.body.entry.map(item => item.resource.resourceType), ['List', 'DocumentReference', 'Bundle', 'Patient']);
});

test('busca ITI-67 con patient.identifier=system|value, status y type LOINC', async () => {
  const result = await searchDocuments({ config: config(), patientSystem: 'https://example.org/id', patientValue: '001', type: '11502-2' });
  assert.equal(result.bundle.type, 'searchset');
  assert.equal(requests.at(-1).pathname, '/DocumentReference');
  assert.deepEqual(requests.at(-1).params, {
    'patient.identifier': 'https://example.org/id|001',
    status: 'current', type: 'http://loinc.org|11502-2'
  });
});

test('recupera únicamente IDs o URLs del mediador mediante ITI-68', async () => {
  assert.equal(resolveDocumentId(`${baseUrl}/documents/${documentId}`, config()), documentId);
  assert.throws(() => resolveDocumentId('doc-invalido', config()), /40 caracteres hexadecimales/);
  assert.throws(() => resolveDocumentId(`https://otro.example/documents/${documentId}`, config()), /no pertenece/);
  const result = await retrieveDocument({ config: config(), documentIdOrUrl: documentId });
  assert.equal(result.bundle.type, 'document');
  assert.equal(requests.at(-1).pathname, `/documents/${documentId}`);
  assert.equal(requests.at(-1).authorization, 'Bearer jwt-local-de-prueba');
});
