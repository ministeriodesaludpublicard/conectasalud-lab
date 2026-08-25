const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const CANONICAL_BASE = 'https://digital.msp.gob.do/fhir/conectaton/StructureDefinition';
const PROFILES = {
  transaction: `${CANONICAL_BASE}/BundleTransaccDO`,
  list: `${CANONICAL_BASE}/ListDO`,
  patient: `${CANONICAL_BASE}/PatientDO`,
  nps: {
    key: 'nps',
    label: 'Resumen de Paciente',
    document: `${CANONICAL_BASE}/BundleNPSDO`,
    documentReference: `${CANONICAL_BASE}/DocumentReferenceDO`,
    type: { system: 'http://loinc.org', code: '34105-7', display: 'Summarization of episode note' }
  },
  onco: {
    key: 'onco',
    label: 'Registro Nacional de Cáncer (RENAC)',
    document: `${CANONICAL_BASE}/BundleOncoDO`,
    documentReference: `${CANONICAL_BASE}/DocumentReferenceDOOnco`,
    type: { system: 'http://loinc.org', code: '115562-1', display: 'Oncology Clinical Document' }
  },
  notif: {
    key: 'notif',
    label: 'Vigilancia epidemiológica',
    document: `${CANONICAL_BASE}/BundleNotifDO`,
    documentReference: `${CANONICAL_BASE}/DocumentReferenceDONotif`,
    type: { system: 'http://loinc.org', code: '68991-9', display: 'Case notification panel' }
  }
};

const GENERATED_DIR = path.resolve(process.env.GENERATED_DIR || path.join(__dirname, '..', 'generated'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getProfiles(resource) {
  return Array.isArray(resource?.meta?.profile) ? resource.meta.profile : [];
}

function identifyNationalUseCase(resource) {
  const profiles = getProfiles(resource);
  return [PROFILES.nps, PROFILES.onco, PROFILES.notif]
    .find(useCase => profiles.includes(useCase.document)) || null;
}

function findDocumentEntry(bundle, resourceType) {
  return (bundle.entry || []).find(entry => entry?.resource?.resourceType === resourceType) || null;
}

function ensureFhirId(resource) {
  resource.id = resource.id || uuidv4();
  return resource.id;
}

function ensureDocumentEntryFullUrls(documentBundle) {
  for (const entry of documentBundle.entry || []) {
    if (!entry?.resource) continue;
    ensureFhirId(entry.resource);
    entry.fullUrl = entry.fullUrl || `urn:uuid:${entry.resource.id}`;
  }
}

function getEntryReference(entry, fallbackType) {
  if (!entry?.resource) return null;
  return entry.fullUrl || `${fallbackType || entry.resource.resourceType}/${ensureFhirId(entry.resource)}`;
}

function getCompositionType(documentBundle, useCase) {
  if (useCase.key === 'notif' || useCase.key === 'onco') {
    return clone(useCase.type);
  }
  const composition = findDocumentEntry(documentBundle, 'Composition')?.resource;
  const coding = composition?.type?.coding?.find(item => item?.system && item?.code);
  return coding
    ? { system: coding.system, code: coding.code, display: coding.display }
    : clone(useCase.type);
}

function buildNationalMhdTransaction(documentBundle, options = {}) {
  if (!documentBundle || documentBundle.resourceType !== 'Bundle' || documentBundle.type !== 'document') {
    throw new Error('ITI-65 requiere un Bundle FHIR con type=document.');
  }

  if (!Array.isArray(documentBundle.entry) || documentBundle.entry.length === 0) {
    throw new Error('El documento no contiene entradas FHIR.');
  }

  const useCase = identifyNationalUseCase(documentBundle);
  if (!useCase) {
    throw new Error('El Bundle debe declarar en meta.profile uno de los perfiles nacionales: BundleNPSDO, BundleOncoDO o BundleNotifDO.');
  }

  const document = clone(documentBundle);
  ensureFhirId(document);
  document.meta = document.meta || {};
  document.meta.profile = [useCase.document];
  document.identifier = document.identifier || {
    system: 'urn:ietf:rfc:3986',
    value: `urn:uuid:${uuidv4()}`
  };
  document.timestamp = document.timestamp || new Date().toISOString();
  ensureDocumentEntryFullUrls(document);

  const compositionEntry = findDocumentEntry(document, 'Composition');
  const patientEntry = findDocumentEntry(document, 'Patient');
  if (!compositionEntry || !patientEntry) {
    throw new Error('El Bundle documental debe incluir Composition y Patient.');
  }

  if (document.entry[0]?.resource?.resourceType !== 'Composition') {
    throw new Error('En un Bundle document, Composition debe ser la primera entrada.');
  }

  const patient = clone(patientEntry.resource);
  ensureFhirId(patient);
  patient.meta = patient.meta || {};
  if (!getProfiles(patient).includes(PROFILES.patient)) {
    patient.meta.profile = [...getProfiles(patient), PROFILES.patient];
  }

  const patientExists = /^https?:\/\//i.test(String(patientEntry.fullUrl || '')) && Boolean(patient.id);
  const patientFullUrl = patientExists ? patientEntry.fullUrl : `urn:uuid:${uuidv4()}`;
  const documentFullUrl = `urn:uuid:${uuidv4()}`;
  const documentReferenceFullUrl = `urn:uuid:${uuidv4()}`;
  const listFullUrl = `urn:uuid:${uuidv4()}`;
  const now = document.timestamp || new Date().toISOString();
  const documentReferenceId = uuidv4();
  const listId = uuidv4();
  const sourceId = String(options.sourceId || process.env.MHD_SOURCE_ID || '').trim();
  if (!sourceId) {
    const error = new Error('Configura MHD_SOURCE_ID con el identificador OID o URI de la institución antes de ejecutar ITI-65.');
    error.statusCode = 400;
    throw error;
  }

  const documentReference = {
    resourceType: 'DocumentReference',
    id: documentReferenceId,
    meta: { profile: [useCase.documentReference] },
    masterIdentifier: {
      system: 'urn:ietf:rfc:3986',
      value: `urn:uuid:${documentReferenceId}`
    },
    status: 'current',
    type: { coding: [getCompositionType(document, useCase)] },
    subject: { reference: patientFullUrl },
    date: now,
    content: [{
      attachment: {
        contentType: 'application/fhir+json',
        url: documentFullUrl
      }
    }]
  };

  const submissionSet = {
    resourceType: 'List',
    id: listId,
    meta: { profile: [PROFILES.list] },
    extension: [{
      url: 'https://profiles.ihe.net/ITI/MHD/StructureDefinition/ihe-sourceId',
      valueIdentifier: { value: sourceId }
    }],
    status: 'current',
    mode: 'working',
    code: {
      coding: [{
        system: 'https://profiles.ihe.net/ITI/MHD/CodeSystem/MHDlistTypes',
        code: 'submissionset'
      }]
    },
    subject: { reference: patientFullUrl },
    date: now,
    entry: [{ item: { reference: documentReferenceFullUrl } }]
  };

  return {
    resourceType: 'Bundle',
    id: uuidv4(),
    meta: { profile: [PROFILES.transaction] },
    type: 'transaction',
    timestamp: now,
    entry: [
      { fullUrl: listFullUrl, resource: submissionSet, request: { method: 'POST', url: 'List' } },
      { fullUrl: documentReferenceFullUrl, resource: documentReference, request: { method: 'POST', url: 'DocumentReference' } },
      { fullUrl: documentFullUrl, resource: document, request: { method: 'POST', url: 'Bundle' } },
      {
        fullUrl: patientFullUrl,
        resource: patient,
        request: patientExists
          ? { method: 'PUT', url: `Patient/${encodeURIComponent(patient.id)}` }
          : { method: 'POST', url: 'Patient' }
      }
    ]
  };
}

function prepareIti65Payload(resource, options = {}) {
  if (!resource || resource.resourceType !== 'Bundle') {
    throw new Error('ITI-65 solo puede publicar un Bundle FHIR. El editor y $validate sí admiten cualquier resourceType.');
  }

  if (resource.type === 'transaction') {
    if (!getProfiles(resource).includes(PROFILES.transaction)) {
      throw new Error('El Bundle transaction debe declarar el perfil nacional BundleTransaccDO.');
    }
    if (!Array.isArray(resource.entry) || resource.entry.length === 0) {
      throw new Error('El BundleTransaccDO no contiene entradas para procesar.');
    }
    return { transaction: clone(resource), useCase: 'transaction', generated: false };
  }

  const useCase = identifyNationalUseCase(resource);
  return {
    transaction: buildNationalMhdTransaction(resource, options),
    useCase: useCase?.key || null,
    useCaseLabel: useCase?.label || null,
    generated: true
  };
}

function saveSubmittedTransaction(transaction) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `iti65-do-${timestamp}-${transaction.id || 'transaction'}.json`;
  fs.writeFileSync(path.join(GENERATED_DIR, fileName), `${JSON.stringify(transaction, null, 2)}\n`, 'utf8');
  return { fileName, relativePath: `generated/${fileName}` };
}

module.exports = {
  CANONICAL_BASE,
  PROFILES,
  identifyNationalUseCase,
  buildNationalMhdTransaction,
  prepareIti65Payload,
  saveSubmittedTransaction
};
