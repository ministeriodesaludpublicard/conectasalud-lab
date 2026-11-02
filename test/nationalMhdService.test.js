const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PROFILES,
  identifyNationalUseCase,
  buildNationalMhdTransaction,
  prepareIti65Payload
} = require('../services/nationalMhdService');

function documentBundle(profile) {
  return {
    resourceType: 'Bundle',
    id: 'documento-prueba',
    meta: { profile: [profile] },
    type: 'document',
    timestamp: '2026-08-25T12:00:00Z',
    entry: [
      {
        fullUrl: 'urn:uuid:composition-1',
        resource: {
          resourceType: 'Composition', id: 'composition-1', status: 'final',
          type: { coding: [{ system: 'http://loinc.org', code: '34105-7', display: 'Resumen clínico' }] },
          subject: { reference: 'urn:uuid:patient-1' }, date: '2026-08-25T12:00:00Z',
          author: [{ reference: 'urn:uuid:organization-1' }], title: 'Documento de prueba', section: []
        }
      },
      {
        fullUrl: 'urn:uuid:patient-1',
        resource: {
          resourceType: 'Patient', id: 'patient-1',
          meta: { profile: [PROFILES.patient] },
          identifier: [{ system: 'https://example.org/cedula', value: '00100000001' }]
        }
      },
      {
        fullUrl: 'urn:uuid:organization-1',
        resource: { resourceType: 'Organization', id: 'organization-1', name: 'Hospital de prueba' }
      }
    ]
  };
}

test('reconoce los tres casos de uso nacionales por meta.profile', () => {
  for (const useCase of [PROFILES.nps, PROFILES.notif, PROFILES.onco]) {
    assert.equal(identifyNationalUseCase(documentBundle(useCase.document)).key, useCase.key);
  }
});

test('construye BundleTransaccDO para ITI-65 con List, DocumentReference, documento y Patient', () => {
  const transaction = buildNationalMhdTransaction(documentBundle(PROFILES.nps.document), { sourceId: 'urn:oid:1.2.3.4' });
  assert.equal(transaction.resourceType, 'Bundle');
  assert.equal(transaction.type, 'transaction');
  assert.deepEqual(transaction.meta.profile, [PROFILES.transaction]);
  assert.deepEqual(transaction.entry.map(entry => entry.resource.resourceType), ['List', 'DocumentReference', 'Bundle', 'Patient']);
  assert.ok(transaction.entry.every(entry => entry.request.method === 'POST'));
  assert.equal(transaction.entry[0].resource.meta.profile[0], PROFILES.list);
  assert.equal(transaction.entry[1].resource.meta.profile[0], PROFILES.nps.documentReference);
  assert.equal(transaction.entry[2].resource.meta.profile[0], PROFILES.nps.document);
  assert.equal(transaction.entry[0].resource.extension[0].valueIdentifier.value, 'urn:oid:1.2.3.4');
});

test('ITI-65 actualiza un Patient existente y crea uno nuevo según el fullUrl documental', () => {
  const existing = documentBundle(PROFILES.nps.document);
  existing.entry[0].resource.subject.reference = 'https://fhir.example/Patient/patient-1';
  existing.entry[1].fullUrl = 'https://fhir.example/Patient/patient-1';
  const existingTransaction = buildNationalMhdTransaction(existing, { sourceId: 'urn:oid:1.2.3.4' });
  const existingPatientEntry = existingTransaction.entry.find(entry => entry.resource.resourceType === 'Patient');
  assert.deepEqual(existingPatientEntry.request, { method: 'PUT', url: 'Patient/patient-1' });
  assert.equal(existingPatientEntry.fullUrl, 'https://fhir.example/Patient/patient-1');

  const newTransaction = buildNationalMhdTransaction(documentBundle(PROFILES.nps.document), { sourceId: 'urn:oid:1.2.3.4' });
  const newPatientEntry = newTransaction.entry.find(entry => entry.resource.resourceType === 'Patient');
  assert.deepEqual(newPatientEntry.request, { method: 'POST', url: 'Patient' });
  assert.match(newPatientEntry.fullUrl, /^urn:uuid:/);
});

test('usa los perfiles DocumentReference específicos para vigilancia y RENAC', () => {
  const notif = buildNationalMhdTransaction(documentBundle(PROFILES.notif.document), { sourceId: 'urn:oid:1.2.3.4' });
  const onco = buildNationalMhdTransaction(documentBundle(PROFILES.onco.document), { sourceId: 'urn:oid:1.2.3.4' });
  assert.equal(notif.entry[1].resource.meta.profile[0], PROFILES.notif.documentReference);
  assert.equal(notif.entry[1].resource.type.coding[0].code, '68991-9');
  assert.equal(onco.entry[1].resource.meta.profile[0], PROFILES.onco.documentReference);
  assert.equal(onco.entry[1].resource.type.coding[0].code, '115562-1');
});

test('rechaza un Bundle document ajeno a los tres perfiles nacionales', () => {
  assert.throws(
    () => buildNationalMhdTransaction(documentBundle('http://hl7.org/fhir/StructureDefinition/Bundle')),
    /BundleNPSDO, BundleOncoDO o BundleNotifDO/
  );
});

test('acepta una BundleTransaccDO ya construida sin modificarla', () => {
  const input = {
    resourceType: 'Bundle', id: 'transaction-1', type: 'transaction',
    meta: { profile: [PROFILES.transaction] },
    entry: [{ resource: { resourceType: 'Patient', id: 'patient-1' }, request: { method: 'POST', url: 'Patient' } }]
  };
  const result = prepareIti65Payload(input);
  assert.equal(result.generated, false);
  assert.deepEqual(result.transaction, input);
  assert.notEqual(result.transaction, input);
});

test('ITI-65 rechaza recursos simples aunque el editor sí pueda interpretarlos', () => {
  assert.throws(() => prepareIti65Payload({ resourceType: 'Patient' }), /solo puede publicar un Bundle/);
});

<<<<<<< HEAD
test('exige un sourceId institucional real al construir ITI-65', () => {
  assert.throws(
    () => buildNationalMhdTransaction(documentBundle(PROFILES.nps.document), { sourceId: '' }),
    /Configura MHD_SOURCE_ID/
  );
=======
test('agrega el sourceId institucional si está configurado y no inventa uno si falta', () => {
  const withSource = buildNationalMhdTransaction(documentBundle(PROFILES.nps.document), { sourceId: 'urn:oid:1.2.3.4' });
  assert.equal(withSource.entry[0].resource.extension[0].valueIdentifier.value, 'urn:oid:1.2.3.4');
  const withoutSource = buildNationalMhdTransaction(documentBundle(PROFILES.nps.document), { sourceId: '' });
  if (!process.env.MHD_SOURCE_ID) assert.equal(withoutSource.entry[0].resource.extension, undefined);
>>>>>>> origin/master
});
