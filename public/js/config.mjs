export const GUIDE_BASE = 'https://digital.msp.gob.do/fhir/conectaton/StructureDefinition';
export const USE_CASES = [
  { key: 'nps', track: 1, label: 'Continuidad asistencial · NPS / IPS', profile: `${GUIDE_BASE}/BundleNPSDO` },
  { key: 'notif', track: 2, label: 'Evento epidemiológico', profile: `${GUIDE_BASE}/BundleNotifDO` },
  { key: 'onco', track: 3, label: 'Registro Nacional de Cáncer', profile: `${GUIDE_BASE}/BundleOncoDO` }
];
export const TRANSACTION_PROFILE = `${GUIDE_BASE}/BundleTransaccDO`;
export const CUSTOM_SERVERS_KEY = 'conectasalud-lab.custom-fhir-servers.v1';
export const SELECTED_SERVER_KEY = 'conectasalud-lab.selected-fhir-server.v1';

export const PAGE_COPY = {
  home: ['Inicio', 'Practica los tres casos de uso mediante el Perfil MHD de IHE.'],
  resources: ['Recursos base', 'Crea y consulta recursos FHIR en el sandbox seleccionado.'],
  guided: ['Casos guiados', 'Construye el documento clínico de cualquiera de los tres tracks nacionales.'],
  editor: ['Editor y validador FHIR', 'Edita, interpreta y valida cualquier recurso FHIR sin cambiar de pantalla.'],
  iti65: ['Publicar · ITI-65', 'Construye o envía el Provide Document Bundle de la guía dominicana.'],
  queries: ['Consultar · ITI-67/68', 'Localiza referencias documentales y recupera documentos clínicos publicados.'],
  servers: ['Servidores FHIR', 'Selecciona el sandbox que utilizarán la validación y las transacciones del Perfil MHD de IHE.'],
  activity: ['Actividad técnica', 'Revisa solicitudes, respuestas, errores y tiempos de ejecución.']
};

export const RESOURCE_COPY = {
  Organization: ['Organizaciones', 'Nueva organización'],
  Patient: ['Pacientes', 'Nuevo paciente'],
  Practitioner: ['Profesionales', 'Nuevo profesional'],
  PractitionerRole: ['Roles profesionales', 'Nuevo rol profesional']
};

export const RESOURCE_FIELDS = {
  Organization: [
    ['name', 'Nombre', 'text', true], ['identifierValue', 'Identificador', 'text', true],
    ['identifierSystem', 'Sistema del identificador', 'url', true, 'https://digital.msp.gob.do/identifiers/organization'],
    ['phone', 'Teléfono', 'tel'], ['email', 'Correo', 'email'], ['address', 'Dirección', 'text']
  ],
  Patient: [
    ['given', 'Nombres', 'text', true], ['family', 'Primer apellido', 'text', true], ['secondFamily', 'Segundo apellido', 'text'],
    ['identifierValue', 'Número de identificación', 'text', true], ['identifierSystem', 'Sistema del identificador', 'url', true, 'https://digital.msp.gob.do/fhir/sid/cedula'],
    ['identifierType', 'Tipo de identificación', 'text', true, 'CED'], ['gender', 'Sexo administrativo', 'select', false, '', [['female', 'Femenino'], ['male', 'Masculino'], ['other', 'Otro'], ['unknown', 'Desconocido']]],
    ['birthDate', 'Fecha de nacimiento', 'date'], ['phone', 'Teléfono', 'tel'], ['email', 'Correo', 'email'], ['address', 'Dirección', 'text']
  ],
  Practitioner: [
    ['given', 'Nombres', 'text', true], ['family', 'Primer apellido', 'text', true], ['secondFamily', 'Segundo apellido', 'text'],
    ['identifierValue', 'Identificador profesional', 'text', true], ['identifierType', 'Tipo de identificación', 'text', true, 'PRN'],
    ['phone', 'Teléfono', 'tel'], ['email', 'Correo', 'email'], ['gender', 'Sexo administrativo', 'select', false, '', [['female', 'Femenino'], ['male', 'Masculino'], ['other', 'Otro'], ['unknown', 'Desconocido']]]
  ],
  PractitionerRole: [
    ['practitionerId', 'Profesional', 'relation', true, 'Practitioner'], ['organizationId', 'Organización', 'relation', true, 'Organization'],
    ['roleCode', 'Código del rol', 'text', false, 'doctor'], ['roleDisplay', 'Descripción del rol', 'text', false, 'Médico'],
    ['specialtyCode', 'Código de especialidad', 'text'], ['specialtyDisplay', 'Especialidad', 'text']
  ]
};
