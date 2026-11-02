const { v4: uuidv4 } = require('uuid');
const { readManagedResource } = require('./fhirServerService');

<<<<<<< HEAD
const BASE = 'https://digital.msp.gob.do/fhir/conectaton/StructureDefinition';
const CASES = {
  nps: { bundle: `${BASE}/BundleNPSDO`, composition: `${BASE}/CompositionDO`, code: '34105-7', display: 'Summarization of episode note', title: 'Resumen de Paciente' },
  notif: { bundle: `${BASE}/BundleNotifDO`, composition: `${BASE}/CompositionDONotif`, code: '68991-9', display: 'Case notification panel', title: 'Notificación individual de caso' },
  onco: { bundle: `${BASE}/BundleOncoDO`, composition: `${BASE}/CompositionDOOnco`, code: '115562-1', display: 'Oncology Clinical Document', title: 'Resumen oncológico' }
=======
const { CANONICAL_BASE: BASE, DOCUMENT_TYPES } = require('./documentProfiles');
const CASES = {
  nps: { bundle: DOCUMENT_TYPES.nps.bundleProfile, composition: DOCUMENT_TYPES.nps.compositionProfile, ...DOCUMENT_TYPES.nps.loinc, title: 'Resumen de Paciente' },
  lab: { bundle: DOCUMENT_TYPES.lab.bundleProfile, composition: DOCUMENT_TYPES.lab.compositionProfile, ...DOCUMENT_TYPES.lab.loinc, title: 'Informe de laboratorio' },
  notif: { bundle: DOCUMENT_TYPES.notif.bundleProfile, composition: DOCUMENT_TYPES.notif.compositionProfile, ...DOCUMENT_TYPES.notif.loinc, title: 'Notificación individual de caso' },
  onco: { bundle: DOCUMENT_TYPES.onco.bundleProfile, composition: DOCUMENT_TYPES.onco.compositionProfile, ...DOCUMENT_TYPES.onco.loinc, title: 'Resumen oncológico' }
>>>>>>> origin/master
};

function xml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function narrative(parts) {
  return { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${parts.filter(Boolean).map(item => `<p>${xml(item)}</p>`).join('')}</div>` };
}

function clean(value, max = 1000) { return String(value || '').trim().slice(0, max); }
function reference(base, resource) { return `${base}/${resource.resourceType}/${resource.id}`; }
function coding(system, code, display) { return { coding: code ? [{ system, code: clean(code, 100), display: clean(display, 300) }] : undefined, text: clean(display, 300) }; }

<<<<<<< HEAD
function section(title, code, resources, text) {
  const result = {
    title,
    code: { coding: [{ system: 'http://loinc.org', code, display: title }] },
=======
function section(title, code, resources, text, system = 'http://loinc.org') {
  const result = {
    title,
    code: { coding: [{ system, code, display: title }] },
>>>>>>> origin/master
    text: narrative([text || (resources.length ? resources.map(item => item.code?.text || item.medicationCodeableConcept?.text).filter(Boolean).join('; ') : 'Sin información reportada')])
  };
  if (resources.length) result.entry = resources.map(item => ({ reference: `urn:uuid:${item.id}` }));
  else result.emptyReason = { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason', code: 'nilknown', display: 'Nil Known' }] };
  return result;
}

function condition(data, patientRef, practitionerRef) {
  if (!clean(data.display)) return null;
  return {
    resourceType: 'Condition', id: uuidv4(), meta: { profile: [`${BASE}/ConditionDO`] },
    text: narrative([data.display, data.detail]),
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    code: coding('http://hl7.org/fhir/sid/icd-10', data.code, data.display), subject: { reference: patientRef },
    recorder: { reference: practitionerRef }, recordedDate: new Date().toISOString()
  };
}

function allergy(data, patientRef, practitionerRef) {
  if (!clean(data.display)) return null;
  return {
    resourceType: 'AllergyIntolerance', id: uuidv4(), meta: { profile: [`${BASE}/AllergyIntoleranceDO`] },
    text: narrative([data.display, data.detail]),
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] },
    code: coding('http://snomed.info/sct', data.code, data.display), patient: { reference: patientRef }, recorder: { reference: practitionerRef }
  };
}

function medication(data, patientRef) {
  if (!clean(data.display)) return null;
  return {
    resourceType: 'MedicationStatement', id: uuidv4(), meta: { profile: [`${BASE}/MedicationStatementDO`] },
    text: narrative([data.display, data.detail]), status: 'active',
    medicationCodeableConcept: coding('http://snomed.info/sct', data.code, data.display),
    subject: { reference: patientRef }, dosage: clean(data.detail) ? [{ text: clean(data.detail) }] : undefined
  };
}

function binaryFromPdf(pdf) {
  if (!pdf?.data || pdf.contentType !== 'application/pdf') throw Object.assign(new Error('Este caso de uso requiere cargar el documento PDF correspondiente.'), { statusCode: 400 });
  const data = String(pdf.data).replace(/^data:application\/pdf;base64,/, '');
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(data) || data.length > 20 * 1024 * 1024) throw Object.assign(new Error('El contenido PDF no es válido o supera el límite permitido.'), { statusCode: 400 });
  const header = Buffer.from(data.replace(/\s/g, ''), 'base64').subarray(0, 1024).toString('latin1');
  if (!header.includes('%PDF-')) throw Object.assign(new Error('El archivo adjunto no contiene la firma de un PDF válido.'), { statusCode: 400 });
  return { resourceType: 'Binary', id: uuidv4(), meta: { profile: [`${BASE}/BinaryDO`] }, contentType: 'application/pdf', data };
}

<<<<<<< HEAD
function buildNewPatient(input = {}) {
  if (!clean(input.given) || !clean(input.family) || !clean(input.identifierValue)) {
    throw Object.assign(new Error('Para crear el paciente en ITI-65 completa nombres, apellido e identificación.'), { statusCode: 400 });
=======
function laboratoryReport(input, patientRef, organizationRef, binary) {
  const issued = input.encounterDate || new Date().toISOString();
  return {
    resourceType: 'DiagnosticReport', id: uuidv4(), meta: { profile: [`${BASE}/DiagnosticReportDO`] },
    text: narrative([input.labTestDisplay || 'Informe de laboratorio', input.labResultText]),
    status: 'final',
    code: coding('http://loinc.org', input.labTestCode || '11502-2', input.labTestDisplay || 'Laboratory report'),
    subject: { reference: patientRef }, effectiveDateTime: issued, issued,
    performer: [{ reference: organizationRef }],
    conclusion: clean(input.labResultText, 2000) || undefined,
    presentedForm: [{
      contentType: 'application/pdf', language: 'es', url: `urn:uuid:${binary.id}`,
      title: clean(input.pdf?.name, 200) || 'Informe de laboratorio', creation: issued
    }]
  };
}

function buildNewPatient(input = {}) {
  if (!clean(input.given) || !clean(input.family) || !clean(input.identifierValue)) {
    throw Object.assign(new Error('Para incluir un paciente nuevo completa nombres, apellido e identificación.'), { statusCode: 400 });
>>>>>>> origin/master
  }
  return {
    resourceType: 'Patient', id: uuidv4(), meta: { profile: [`${BASE}/PatientDO`] }, active: true,
    identifier: [{
      type: { coding: [{ system: 'https://digital.msp.gob.do/fhir/conectaton/CodeSystem/CSIdentificadoresPersona', code: clean(input.identifierType || 'CED', 30) }] },
      system: clean(input.identifierSystem || 'https://digital.msp.gob.do/fhir/sid/cedula', 300), value: clean(input.identifierValue, 120)
    }],
    name: [{
      ...(clean(input.secondFamily) ? { extension: [{ url: `${BASE}/SegundoApellidoDO`, valueString: clean(input.secondFamily, 120) }] } : {}),
      family: clean(input.family, 120), given: [clean(input.given, 120)]
    }],
    gender: ['female', 'male', 'other', 'unknown'].includes(input.gender) ? input.gender : 'unknown',
    birthDate: clean(input.birthDate, 10) || undefined,
    telecom: [input.phone && { system: 'phone', value: clean(input.phone, 80) }, input.email && { system: 'email', value: clean(input.email, 200) }].filter(Boolean)
  };
}

async function buildGuidedDocument({ serverUrl, token, input = {} }) {
  const useCase = CASES[input.useCase];
<<<<<<< HEAD
  if (!useCase) throw Object.assign(new Error('Selecciona uno de los tres casos de uso.'), { statusCode: 400 });
=======
  if (!useCase) throw Object.assign(new Error('Selecciona uno de los cuatro tipos documentales.'), { statusCode: 400 });
>>>>>>> origin/master
  const patientIsNew = input.patientMode === 'new';
  const [patientResult, practitionerResult, organizationResult] = await Promise.all([
    patientIsNew ? Promise.resolve({ resource: buildNewPatient(input.newPatient) }) : readManagedResource({ serverUrl, token, resourceType: 'Patient', id: input.patientId }),
    readManagedResource({ serverUrl, token, resourceType: 'Practitioner', id: input.practitionerId }),
    readManagedResource({ serverUrl, token, resourceType: 'Organization', id: input.organizationId })
  ]);
  const patient = patientResult.resource;
  const practitioner = practitionerResult.resource;
  const organization = organizationResult.resource;
  const patientRef = patientIsNew ? `urn:uuid:${patient.id}` : reference(serverUrl, patient);
  const practitionerRef = reference(serverUrl, practitioner);
  const organizationRef = reference(serverUrl, organization);
  const clinical = [];
  const sections = [];
  const diagnosis = condition(input.diagnosis || {}, patientRef, practitionerRef);
<<<<<<< HEAD
=======
  if (['notif', 'onco'].includes(input.useCase) && !diagnosis) {
    throw Object.assign(new Error('La guía nacional requiere un diagnóstico para este caso de uso.'), { statusCode: 400 });
  }
>>>>>>> origin/master

  if (input.useCase === 'nps') {
    const allergyResource = allergy(input.allergy || {}, patientRef, practitionerRef);
    const medicationResource = medication(input.medication || {}, patientRef);
    if (diagnosis) clinical.push(diagnosis);
    if (allergyResource) clinical.push(allergyResource);
    if (medicationResource) clinical.push(medicationResource);
    sections.push(
      section('Problemas activos', '11450-4', diagnosis ? [diagnosis] : [], input.diagnosis?.detail),
      section('Alergias e intolerancias', '48765-2', allergyResource ? [allergyResource] : [], input.allergy?.detail),
      section('Medicamentos', '10160-0', medicationResource ? [medicationResource] : [], input.medication?.detail)
    );
<<<<<<< HEAD
  } else if (input.useCase === 'notif') {
    if (diagnosis) clinical.push(diagnosis);
    sections.push(
      section('Datos de la enfermedad', '99998-9', diagnosis ? [diagnosis] : [], input.diagnosis?.detail),
      section('Signos y síntomas', '99998-9', [], clean(input.symptoms))
    );
    const binary = binaryFromPdf(input.pdf);
    clinical.push(binary);
    sections.push(section('Documento PDF', '99999-9', [binary], 'Formulario Único de Notificación de Caso adjunto.'));
  } else {
    if (diagnosis) clinical.push(diagnosis);
    if (diagnosis) sections.push(section('Datos oncológicos', '11450-4', [diagnosis], [input.stage, input.tumorSite, input.treatment].filter(Boolean).join(' · ')));
=======
  } else if (input.useCase === 'lab') {
    const binary = binaryFromPdf(input.pdf);
    binary.securityContext = { reference: patientRef };
    const report = laboratoryReport(input, patientRef, organizationRef, binary);
    clinical.push(report, binary);
    sections.push(
      section('Informe de laboratorio', '11502-2', [report], input.labResultText || 'Informe final de laboratorio.'),
      section('Documento PDF', '99999-9', [binary], 'Informe de laboratorio adjunto.')
    );
  } else if (input.useCase === 'notif') {
    if (diagnosis) clinical.push(diagnosis);
    sections.push(
      section('Datos de la enfermedad', 'evento', [diagnosis], input.diagnosis?.detail, `${BASE.replace('/StructureDefinition', '')}/CodeSystem/CSSeccionesNotificacionDO`),
      section('Observaciones', 'observaciones', [], clean(input.symptoms), `${BASE.replace('/StructureDefinition', '')}/CodeSystem/CSSeccionesNotificacionDO`)
    );
    const binary = binaryFromPdf(input.pdf);
    clinical.push(binary);
    sections.push(section('Documento PDF', 'documento-pdf', [binary], 'Formulario Único de Notificación de Caso adjunto.', `${BASE.replace('/StructureDefinition', '')}/CodeSystem/CSSeccionesNotificacionDO`));
  } else {
    if (diagnosis) clinical.push(diagnosis);
    sections.push(section('Diagnóstico oncológico', 'diagnostico', [diagnosis], [input.stage, input.tumorSite, input.treatment].filter(Boolean).join(' · '), `${BASE.replace('/StructureDefinition', '')}/CodeSystem/CSSeccionesOncoDO`));
>>>>>>> origin/master
    const binary = binaryFromPdf(input.pdf);
    clinical.push(binary);
    sections.push(section('Documento PDF', '99999-9', [binary], 'Resumen oncológico adjunto.'));
  }

  const composition = {
    resourceType: 'Composition', id: uuidv4(), meta: { profile: [useCase.composition] }, status: 'final',
    type: { coding: [{ system: 'http://loinc.org', code: useCase.code, display: useCase.display }] },
    subject: { reference: patientRef }, date: input.encounterDate || new Date().toISOString(),
<<<<<<< HEAD
    author: [{ reference: practitionerRef }], title: useCase.title, custodian: { reference: organizationRef },
=======
    author: [{ reference: input.useCase === 'lab' ? organizationRef : practitionerRef }], title: useCase.title, custodian: { reference: organizationRef },
>>>>>>> origin/master
    event: clean(input.encounterReason) ? [{ code: [{ text: clean(input.encounterReason) }] }] : undefined,
    section: sections,
    text: narrative([useCase.title, input.encounterReason, input.symptoms, input.stage && `Etapa: ${input.stage}`, input.tumorSite && `Sitio: ${input.tumorSite}`, input.treatment])
  };
  const bundleId = uuidv4();
  const entries = [
    { fullUrl: `urn:uuid:${composition.id}`, resource: composition },
    { fullUrl: patientRef, resource: patient },
    ...clinical.map(resource => ({ fullUrl: `urn:uuid:${resource.id}`, resource })),
    { fullUrl: practitionerRef, resource: practitioner },
    { fullUrl: organizationRef, resource: organization }
  ];
  return {
    resourceType: 'Bundle', id: bundleId, meta: { profile: [useCase.bundle] },
    identifier: { system: 'urn:ietf:rfc:3986', value: `urn:uuid:${bundleId}` },
    type: 'document', timestamp: new Date().toISOString(), entry: entries
  };
}

<<<<<<< HEAD
module.exports = { CASES, buildGuidedDocument };
=======
module.exports = { CASES, buildGuidedDocument, laboratoryReport };
>>>>>>> origin/master
