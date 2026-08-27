# ConectaSalud Lab

**Laboratorio didáctico del [Perfil MHD de IHE](https://profiles.ihe.net/ITI/MHD/index.html) para la Conectatón Nacional de Interoperabilidad en Salud Digital de la República Dominicana.**

## Alcance actual

Esta versión se concentra exclusivamente en:

- **ITI-65**: publicar documentos clínicos mediante `BundleTransaccDO`.
- **ITI-67**: consultar índices documentales (`DocumentReferenceDO`).
- **ITI-68**: recuperar el Bundle documental seleccionado.

La interfaz y las reglas se alinean con la [Guía FHIR DO de la Conectatón Nacional](https://igrepdom.netlify.app/) publicada y con los tres tracks de la agenda oficial:

1. Continuidad asistencial - documento NPS/IPS (`BundleNPSDO`).
2. Notificación de evento de importancia epidemiológica (`BundleNotifDO`).
3. Registro Nacional de Cáncer (`BundleOncoDO`).

## Editor y validador FHIR

El editor admite cualquier recurso FHIR JSON, desde `Patient`, `Organization` o `DocumentReference` hasta Bundles documentales o transaccionales.

- Permite pegar JSON, cargar un archivo `.json` u obtener un recurso desde su URL HTTP/HTTPS.
- Interpreta el recurso en una columna contigua sin cambiar de pantalla.
- Identifica explícitamente cada URL declarada en `meta.profile` como **Perfil FHIR**.
- Presenta un resumen didáctico y, debajo, todos los campos y valores del recurso sin el límite anterior de 180 elementos.
- Presenta `Composition` mediante una cabecera clínica y tarjetas separadas para cada sección, narrativa y referencia.
- Presenta de forma segura la narrativa XHTML de `text.div`, incluida la narrativa de los recursos contenidos en un Bundle.
- Detecta los recursos `Binary` incluidos directamente o dentro de un Bundle y habilita **Visualizar PDF** cuando declaran `contentType: application/pdf`.
- Permite revisar el PDF en un visor modal y descargarlo sin enviar su contenido Base64 a servicios externos.
- Verifica la firma interna `%PDF-` antes de visualizar o incorporar el archivo al caso guiado.
- Carga el PDF mediante el visor nativo del navegador sin aplicar al marco la restricción `sandbox`, que impide renderizar documentos PDF en Chromium.
- Ejecuta `POST /{resourceType}/$validate` contra el HAPI FHIR configurado.
- Convierte el `OperationOutcome` en una lista legible con severidad, diagnóstico y ruta del error.

## Servidores FHIR

El selector del encabezado determina el servidor utilizado por la prueba de conectividad, `$validate` e ITI-65/67/68 del [Perfil MHD de IHE](https://profiles.ihe.net/ITI/MHD/index.html). La pantalla **Servidores FHIR** permite agregar sandboxes personalizados, que se conservan en el navegador del participante.

Al cambiar de servidor, la aplicación descarta los catálogos y resultados que pertenecen al sandbox anterior. Si la pantalla activa es **Recursos base** o **Casos guiados**, vuelve a consultar automáticamente pacientes, profesionales y organizaciones. También invalida la validación y los resultados ITI-65/67/68 anteriores. El JSON del editor se conserva para no perder trabajo, pero debe ejecutarse `$validate` nuevamente contra el servidor seleccionado.

La aplicación no depende de una dirección FHIR específica. El administrador define el servidor inicial mediante `HAPI_FHIR_URL` y puede registrar servidores adicionales mediante `FHIR_SERVERS_JSON`. Cada participante también puede agregar sandboxes desde **Servidores FHIR**; esas preferencias se conservan localmente en su navegador.

Una distribución preparada para un evento puede incluir sandboxes preconfigurados. En una instalación nueva se selecciona `HAPI_FHIR_URL`; si el navegador conserva una selección que todavía existe, la aplicación respeta esa preferencia.

El editor acepta recursos simples, pero ITI-65 solo se habilita para:

- `Bundle.type=document` con `meta.profile` igual a `BundleNPSDO`, `BundleNotifDO` o `BundleOncoDO`; o
- `Bundle.type=transaction` con el perfil `BundleTransaccDO`.

Cuando recibe un Bundle documental, ConectaSalud Lab construye la transacción nacional con `ListDO`, el `DocumentReferenceDO` específico del caso, el documento y `PatientDO`.

`ListDO` se mantiene como metadato del Submission Set publicado mediante ITI-65. Lo que se excluye del alcance es la búsqueda independiente de listas mediante ITI-66.

## Requisitos

- [Git](https://git-scm.com/) para clonar y actualizar el proyecto.
- [Node.js](https://nodejs.org/) 20 o superior y npm.
- Acceso desde el backend a un servidor FHIR R4.
- Perfiles y terminologías de la Guía FHIR DO instalados en el servidor para validar conformidad nacional.
- [PM2](https://pm2.keymetrics.io/) solo si se requiere ejecución persistente.

## Instalación desde GitHub

```bash
git clone <URL_DEL_REPOSITORIO> conectasalud-lab
cd conectasalud-lab
npm ci
cp .env.example .env
npm run verify
npm start
```

En Windows PowerShell, use `Copy-Item .env.example .env` en lugar de `cp`. También puede descargar el ZIP desde GitHub, extraerlo e instalarlo con los mismos comandos a partir de `npm ci`.

La aplicación estará disponible en `http://localhost:3445` si conserva el puerto de ejemplo. Para detenerla, presione `Ctrl+C`.

## Configuración por variables de entorno

Copie `.env.example` como `.env` y ajuste:

```env
PORT=3445
MAX_BODY_SIZE_MB=20
HAPI_FHIR_NAME=Servidor FHIR local
HAPI_FHIR_URL=http://localhost:8080/fhir
FHIR_SERVERS_JSON=
FHIR_BEARER_TOKEN=
FHIR_FETCH_ALLOWED_HOSTS=
MHD_SOURCE_ID=
FHIR_GUIDE_URL=https://igrepdom.netlify.app/
FHIR_GUIDE_VERSION=
LOG_DIR=
GENERATED_DIR=
```

| Variable | Uso |
|---|---|
| `PORT` | Puerto HTTP de la aplicación. |
| `MAX_BODY_SIZE_MB` | Tamaño máximo aceptado para JSON y PDF codificado en Base64. |
| `HAPI_FHIR_NAME` | Nombre visible del servidor inicial. |
| `HAPI_FHIR_URL` | URL base del servidor FHIR inicial. |
| `FHIR_SERVERS_JSON` | Arreglo JSON opcional de servidores adicionales administrados. |
| `FHIR_BEARER_TOKEN` | Token Bearer opcional usado por el backend. |
| `FHIR_FETCH_ALLOWED_HOSTS` | Hosts internos adicionales autorizados para cargar por URL. |
| `MHD_SOURCE_ID` | Identificador real de la institución para el Submission Set de ITI-65. |
| `FHIR_GUIDE_URL` / `FHIR_GUIDE_VERSION` | Referencia visible de la guía aplicada. |
| `LOG_DIR` / `GENERATED_DIR` | Directorios opcionales para datos de ejecución. |

`MHD_SOURCE_ID` no tiene un valor ficticio predeterminado. ITI-65 se rechaza con un mensaje claro hasta que la institución configure su OID, URI o URN. No publique `.env`, tokens ni credenciales en GitHub.

Para preconfigurar varios sandboxes, el JSON debe estar en una sola línea:

```env
FHIR_SERVERS_JSON=[{"id":"sandbox-a","name":"Sandbox A","url":"https://fhir-a.example.org/fhir"},{"id":"sandbox-b","name":"Sandbox B","url":"https://fhir-b.example.org/fhir"}]
```

El servidor FHIR debe tener instalados los perfiles y terminologías de la Guía FHIR DO para que `$validate` pueda comprobar la conformidad nacional. Si el servidor solo conoce FHIR base, la validación no podrá resolver los perfiles dominicanos.

La recuperación por URL bloquea direcciones privadas y reservadas por defecto. El host definido en `HAPI_FHIR_URL` se autoriza automáticamente. Para permitir otros nodos internos de la Conectatón, agregue únicamente sus hosts, separados por coma:

```env
FHIR_FETCH_ALLOWED_HOSTS=10.20.0.15,fhir.institucion.local
```

## Recursos base y autoría guiada

La pantalla **Recursos base** consulta y crea directamente en el servidor activo:

- `OrganizationDO`;
- `PatientDO`;
- `PractitionerDO`.

Cada pestaña muestra un contador circular con el total informado por el servidor para ese tipo de recurso. Los tres totales se vuelven a consultar al entrar en la pantalla, al actualizar el listado, después de crear un recurso y al cambiar de sandbox.

`PractitionerRole` no forma parte de la administración de **Recursos base**. El editor conserva la capacidad de interpretar y validar ese tipo de recurso cuando venga incluido en un JSON o Bundle FHIR.

No se crea un recurso ficticio `User`: la gestión de usuarios y autenticación no forma parte del modelo clínico FHIR.

La pantalla **Casos guiados** genera el JSON de los tres casos nacionales:

- NPS/IPS: condiciones, alergias y medicamentos;
- evento epidemiológico: enfermedad, signos y síntomas, y el PDF de notificación; y
- RENAC: diagnóstico, etapa, sitio tumoral, tratamiento y el PDF oncológico.

En los casos de evento epidemiológico y RENAC, el PDF puede visualizarse inmediatamente después de seleccionarlo. El mismo documento vuelve a estar disponible para visualización y descarga desde la interpretación del `Binary` generado y después de recuperar el Bundle mediante ITI-68.

Para un paciente existente, la pantalla ya no descarga el catálogo completo. Presenta una búsqueda tipo MPI mediante parámetros FHIR `identifier`, `given`, `family`, `birthdate` y `gender`, muestra candidatos demográficos y obliga a seleccionar uno. La consulta se ejecuta contra el servidor activo y se reinicia al cambiar de sandbox. Los parámetros corresponden a la búsqueda de `Patient` en FHIR R4 y toman como referencia funcional el [perfil PDQm de IHE](https://profiles.ihe.net/ITI/PDQm/index.html).

Esta búsqueda no debe confundirse con un MPI productivo: ConectaSalud Lab no calcula coincidencias probabilísticas ni ejecuta `$match`; presenta los resultados literales devueltos por el servidor. El paciente también puede capturarse como nuevo. En ese caso queda dentro del Bundle con un `urn:uuid` y la ITI-65 lo crea mediante `POST Patient`. Si ya existe, ITI-65 utiliza `PUT Patient/{id}` para evitar un duplicado.

## Arquitectura del proyecto

| Ruta | Responsabilidad |
|---|---|
| `config/` | Lectura y normalización de configuración. |
| `controllers/` | Contratos y orquestación de la API HTTP. |
| `http/` | Cuerpo JSON y entrega segura de archivos estáticos. |
| `services/` | Operaciones FHIR, documentos guiados, MHD y actividad técnica. |
| `public/main.mjs` | Estado de pantalla y coordinación de eventos. |
| `public/js/` | Configuración, utilidades, cliente API y fábrica de recursos del navegador. |
| `test/` | Contratos, reglas FHIR, seguridad y portabilidad. |

`server.js` es únicamente el punto de arranque. `app.js` construye el servidor con dependencias configurables, lo que permite probarlo sin abrir un proceso permanente.

## Despliegue con PM2

Desde cualquier ubicación del repositorio:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 logs conectasalud-lab --lines 100
```

`ecosystem.config.js` utiliza su propia ubicación como directorio de trabajo y respeta las variables de `.env`; no contiene una ruta absoluta ni fija el puerto.

## Actualización desde GitHub

```bash
git pull --ff-only
npm ci
npm run verify
pm2 restart conectasalud-lab --update-env
```

Revise `.env.example` después de actualizar por si se incorporaron variables nuevas. No copie `node_modules`, `logs` ni `generated` desde una versión anterior.

## Publicación en GitHub

`.gitignore` excluye dependencias, `.env`, logs, documentos generados, cobertura, editores y ZIP locales. Antes del primer `push`, confirme que `git status` no muestre secretos ni datos clínicos:

```bash
git init
git add .
git status
git commit -m "Publicar ConectaSalud Lab"
git branch -M main
git remote add origin <URL_DEL_REPOSITORIO>
git push -u origin main
```

## Alcance excluido en esta etapa

La interfaz no expone generación desde SQL Server, PDQm, ICVP, QR/VHL, interconsulta, ITI-66 ni transacciones distintas de ITI-65/67/68. La creación de recursos base y documentos guiados existe para preparar esos tres intercambios del [Perfil MHD de IHE](https://profiles.ihe.net/ITI/MHD/index.html).
