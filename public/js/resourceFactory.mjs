import { GUIDE_BASE } from './config.mjs';

const profile = name => `${GUIDE_BASE}/${name}`;
const personIdentifierSystem = 'https://digital.msp.gob.do/fhir/conectaton/CodeSystem/CSIdentificadoresPersona';

export function buildManagedResource(type, data) {
  const telecom = [data.phone && { system: 'phone', value: data.phone }, data.email && { system: 'email', value: data.email }].filter(Boolean);
  const address = data.address ? [{ text: data.address }] : undefined;
  const secondFamilyExtension = data.secondFamily
    ? { extension: [{ url: profile('SegundoApellidoDO'), valueString: data.secondFamily }] }
    : {};

  if (type === 'Organization') return {
    resourceType: type, meta: { profile: [profile('OrganizationDO')] }, active: true,
    identifier: [{ system: data.identifierSystem, value: data.identifierValue }], name: data.name, telecom, address
  };
  if (type === 'Patient') return {
    resourceType: type, meta: { profile: [profile('PatientDO')] }, active: true,
    identifier: [{ type: { coding: [{ system: personIdentifierSystem, code: data.identifierType }] }, system: data.identifierSystem, value: data.identifierValue }],
    name: [{ ...secondFamilyExtension, family: data.family, given: [data.given] }],
    gender: data.gender, birthDate: data.birthDate || undefined, telecom, address
  };
  if (type === 'Practitioner') return {
    resourceType: type, meta: { profile: [profile('PractitionerDO')] }, active: true,
    identifier: [{ type: { coding: [{ system: personIdentifierSystem, code: data.identifierType }] }, value: data.identifierValue }],
    name: [{ ...secondFamilyExtension, family: data.family, given: [data.given] }], gender: data.gender, telecom
  };
  if (type === 'PractitionerRole') return {
    resourceType: type, active: true,
    practitioner: { reference: `Practitioner/${data.practitionerId}` },
    organization: { reference: `Organization/${data.organizationId}` },
    code: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/practitioner-role', code: data.roleCode, display: data.roleDisplay }], text: data.roleDisplay }],
    specialty: data.specialtyDisplay ? [{ coding: data.specialtyCode ? [{ system: 'http://snomed.info/sct', code: data.specialtyCode, display: data.specialtyDisplay }] : undefined, text: data.specialtyDisplay }] : undefined
  };
  throw new Error(`Tipo de recurso no administrable: ${type}`);
}
