const CANONICAL_BASE = 'https://digital.msp.gob.do/fhir/conectaton/StructureDefinition';

const DOCUMENT_TYPES = {
  nps: {
    key: 'nps', mediatorType: 'IPS', label: 'Resumen de Paciente (NPS / IPS)',
    bundleProfile: `${CANONICAL_BASE}/BundleNPSDO`,
    compositionProfile: `${CANONICAL_BASE}/CompositionDONPS`,
    loinc: { system: 'http://loinc.org', code: '60591-5', display: 'Patient summary Document' }
  },
  lab: {
    key: 'lab', mediatorType: 'LAB', label: 'Informe de laboratorio',
    bundleProfile: `${CANONICAL_BASE}/BundleLabDO`,
    compositionProfile: `${CANONICAL_BASE}/CompositionDOLab`,
    loinc: { system: 'http://loinc.org', code: '11502-2', display: 'Laboratory report' }
  },
  notif: {
    key: 'notif', mediatorType: 'ECR', label: 'Notificación individual de caso',
    bundleProfile: `${CANONICAL_BASE}/BundleNotifDO`,
    compositionProfile: `${CANONICAL_BASE}/CompositionDONotif`,
    loinc: { system: 'http://loinc.org', code: '68991-9', display: 'Case notification panel' }
  },
  onco: {
    key: 'onco', mediatorType: 'CANCER', label: 'Registro Nacional de Cáncer (RENAC)',
    bundleProfile: `${CANONICAL_BASE}/BundleOncoDO`,
    compositionProfile: `${CANONICAL_BASE}/CompositionDOOnco`,
    loinc: { system: 'http://loinc.org', code: '115562-1', display: 'Oncology Clinical Document' }
  }
};

const PATIENT_PROFILE = `${CANONICAL_BASE}/PatientDO`;

function profilesOf(resource) {
  return Array.isArray(resource?.meta?.profile) ? resource.meta.profile : [];
}

function identifyDocumentType(bundle) {
  const profiles = profilesOf(bundle);
  const byProfile = Object.values(DOCUMENT_TYPES).find(item => profiles.includes(item.bundleProfile));
  if (byProfile) return byProfile;
  const composition = (bundle?.entry || []).find(e => e.resource?.resourceType === 'Composition')?.resource;
  const coding = composition?.type?.coding || [];
  return Object.values(DOCUMENT_TYPES).find(item => coding.some(c => c.system === item.loinc.system && c.code === item.loinc.code)) || null;
}

module.exports = { CANONICAL_BASE, DOCUMENT_TYPES, PATIENT_PROFILE, profilesOf, identifyDocumentType };
