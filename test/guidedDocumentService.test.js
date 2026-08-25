const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { CASES, buildGuidedDocument } = require('../services/guidedDocumentService');

let server;
let serverUrl;

test.before(async () => {
  const resources = {
    '/Patient/p1': { resourceType: 'Patient', id: 'p1', meta: { profile: ['https://digital.msp.gob.do/fhir/conectaton/StructureDefinition/PatientDO'] }, identifier: [{ value: '001' }], name: [{ family: 'Pérez', given: ['María'] }] },
    '/Practitioner/dr1': { resourceType: 'Practitioner', id: 'dr1', meta: { profile: ['https://digital.msp.gob.do/fhir/conectaton/StructureDefinition/PractitionerDO'] }, identifier: [{ value: 'PRN-1' }], name: [{ family: 'Díaz', given: ['Ana'] }] },
    '/Organization/o1': { resourceType: 'Organization', id: 'o1', meta: { profile: ['https://digital.msp.gob.do/fhir/conectaton/StructureDefinition/OrganizationDO'] }, identifier: [{ system: 'https://example.org/org', value: 'O1' }], name: 'Hospital' }
  };
  server = http.createServer((req, res) => {
    const resource = resources[req.url];
    res.writeHead(resource ? 200 : 404, { 'content-type': 'application/fhir+json' });
    res.end(JSON.stringify(resource || { resourceType: 'OperationOutcome' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  serverUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => new Promise(resolve => server.close(resolve)));

function baseInput(useCase) {
  return { useCase, patientMode: 'existing', patientId: 'p1', practitionerId: 'dr1', organizationId: 'o1', encounterReason: 'Prueba guiada', diagnosis: { code: 'I10', display: 'Diagnóstico de prueba' } };
}

test('genera los tres Bundles documentales nacionales', async () => {
  const nps = await buildGuidedDocument({ serverUrl, input: baseInput('nps') });
  const pdf = { contentType: 'application/pdf', data: Buffer.from('%PDF-1.4\n%%EOF').toString('base64') };
  const notif = await buildGuidedDocument({ serverUrl, input: { ...baseInput('notif'), symptoms: 'Fiebre', pdf } });
  const onco = await buildGuidedDocument({ serverUrl, input: { ...baseInput('onco'), stage: 'II', pdf } });
  assert.equal(nps.meta.profile[0], CASES.nps.bundle);
  assert.equal(notif.meta.profile[0], CASES.notif.bundle);
  assert.equal(onco.meta.profile[0], CASES.onco.bundle);
  assert.ok(notif.entry.some(entry => entry.resource.resourceType === 'Binary'));
  assert.ok(onco.entry.some(entry => entry.resource.resourceType === 'Binary'));
});

test('permite incorporar un PatientDO nuevo para crearlo en ITI-65', async () => {
  const bundle = await buildGuidedDocument({
    serverUrl,
    input: {
      ...baseInput('nps'), patientMode: 'new', patientId: undefined,
      newPatient: { given: 'Juan', family: 'López', identifierValue: '002', identifierType: 'CED', gender: 'male' }
    }
  });
  const patientEntry = bundle.entry.find(entry => entry.resource.resourceType === 'Patient');
  assert.match(patientEntry.fullUrl, /^urn:uuid:/);
  assert.equal(patientEntry.resource.name[0].family, 'López');
});

test('rechaza un adjunto declarado como PDF cuando no contiene la firma PDF', async () => {
  await assert.rejects(
    buildGuidedDocument({
      serverUrl,
      input: { ...baseInput('notif'), pdf: { contentType: 'application/pdf', data: Buffer.from('contenido de texto').toString('base64') } }
    }),
    /firma de un PDF válido/
  );
});
