export const GUIDE_BASE = 'https://digital.msp.gob.do/fhir/conectaton/StructureDefinition';
export const USE_CASES = [
  { key: 'nps', track: 1, label: 'Continuidad asistencial · NPS / IPS', profile: `${GUIDE_BASE}/BundleNPSDO`, composition: `${GUIDE_BASE}/CompositionDONPS`, code: '60591-5' },
  { key: 'lab', track: null, label: 'Informe de laboratorio', profile: `${GUIDE_BASE}/BundleLabDO`, composition: `${GUIDE_BASE}/CompositionDOLab`, code: '11502-2' },
  { key: 'notif', track: 2, label: 'Evento epidemiológico · eCR', profile: `${GUIDE_BASE}/BundleNotifDO`, composition: `${GUIDE_BASE}/CompositionDONotif`, code: '68991-9' },
  { key: 'onco', track: 3, label: 'Registro Nacional de Cáncer · RENAC', profile: `${GUIDE_BASE}/BundleOncoDO`, composition: `${GUIDE_BASE}/CompositionDOOnco`, code: '115562-1' }
];
export const CUSTOM_SERVERS_KEY = 'conectasalud-lab.custom-fhir-servers.v1';
export const SELECTED_SERVER_KEY = 'conectasalud-lab.selected-fhir-server.v1';

export const PAGE_COPY = {
  home: ['Inicio', 'Crea, valida e intercambia los cuatro documentos clínicos de la Guía FHIR DO.'],
  resources: ['Recursos base', 'Crea y consulta recursos FHIR en el sandbox seleccionado.'],
  guided: ['Casos guiados', 'Construye documentos clínicos nacionales conformes con la guía vigente.'],
  editor: ['Editor y validador FHIR', 'Edita, interpreta y valida cualquier recurso FHIR sin cambiar de pantalla.'],
  iti65: ['Publicar documento', 'Envía el Bundle documental al mediador nacional mediante OpenHIM.'],
  queries: ['Consultar documentos', 'Busca índices documentales y recupera el Bundle publicado.'],
  servers: ['Servidores FHIR', 'Administra sandboxes generales, registros de índices y repositorios documentales.'],
  activity: ['Actividad técnica', 'Revisa solicitudes, respuestas, errores y tiempos de ejecución.']
};

export const RESOURCE_COPY = {
  Organization: ['Organizaciones', 'Nueva organización'],
  Patient: ['Pacientes', 'Nuevo paciente'],
  Practitioner: ['Profesionales', 'Nuevo profesional']
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
  ]
};
