# Validación y limitaciones conocidas

La generación didáctica de recursos FHIR **no garantiza conformidad nacional**. Antes de indicar que los documentos cumplen una guía de implementación, valide los perfiles y sus dependencias completas en el servidor correspondiente.

Verificaciones identificadas en la auditoría de casos guiados:

- **IPS/NPS:** revisar todas las secciones obligatorias heredadas del perfil IPS y sus referencias.
- **Notificación epidemiológica:** documentar correctamente el evento clínico, observaciones y documento anexo; no reducir los recursos requeridos a texto y PDF.
- **Oncología:** modelar diagnóstico, patología, estadio y tratamiento con los recursos correspondientes; no solo narrativa.
- **Identidad:** verificar concordancia entre Patient del documento y los metadatos antes de publicar; el mediador no es un sustituto de las consultas al MPI.
- **Validación:** revisar restricciones FHIRPath, cardinalidades, enlaces, códigos y terminologías de perfiles vigentes.

La búsqueda por identificador y el emparejamiento demográfico son alternativas de identificación de pacientes, no pasos necesariamente secuenciales. La resolución final depende del MPI y de la política de revisión de posibles coincidencias.

Pruebas automatizadas: `npm run verify`; pruebas de integración con la infraestructura real deben ejecutarse únicamente en un entorno autorizado.
