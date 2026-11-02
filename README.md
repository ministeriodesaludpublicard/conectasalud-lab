# ConectaSalud Lab

Laboratorio web **FHIR R4** para preparar, interpretar, validar, publicar, buscar y recuperar documentos clínicos durante los ejercicios de interoperabilidad en salud de República Dominicana.

## Funcionalidades

- Edición, visualización y validación de recursos FHIR y de documentos clínicos.
- Formularios guiados de IPS/NPS, laboratorio, notificación epidemiológica y oncología.
- Publicación documental mediante `POST /transaction` (ITI-65), utilizando OpenHIM y el mediador documental.
- Búsqueda de `DocumentReference` (ITI-67) y recuperación por `GET /documents/{id}` (ITI-68).
- Explorador de registros y repositorios FHIR configurados, limitado por paciente por defecto.
- Autenticación institucional por JWT gestionada por el backend, según su configuración.

> Los perfiles y ejemplos didácticos no acreditan por sí solos conformidad con la guía nacional; esa conformidad debe verificarse con el validador y los paquetes de implementación vigentes.

## Arquitectura del proyecto

- `server.js`, `app.js`: servidor web y API.
- `config/`, `lib/`, `http/`: configuración, funciones comunes y utilidades HTTP.
- `controllers/`, `services/`: lógica de negocio, FHIR, documentos, explorador y mediación.
- `public/`: interfaz activa (`main.mjs` y módulos de `js/`).
- `test/`, `scripts/`: pruebas y verificación de sintaxis.
- `docs/`: instalación, seguridad, límites conocidos y referencias operativas.

## Instalación local

Requiere **Node.js 20 o superior**.

```bash
git clone <URL_DEL_REPOSITORIO>
cd conectasalud-lab
npm ci
cp .env.example .env
# Editar .env: URLs, identificadores y secretos privados
npm run verify
npm start
```

La aplicación escucha en `http://localhost:3445` por defecto. Compruebe `GET /api/health`.

## Comandos

```bash
npm run check    # Sintaxis JavaScript
npm test         # Pruebas automáticas
npm run verify   # Sintaxis y pruebas
npm start        # Iniciar servidor
```

## Configuración y seguridad

- Mantenga `.env`, claves y registros de ejecución fuera del repositorio.
- Configure TLS válido (`OPENHIM_TLS_REJECT_UNAUTHORIZED=true`) en entornos expuestos.
- **La API del Lab no implementa por sí sola autenticación de usuarios finales**. Proteja web y API detrás de un proxy autenticado, VPN o control de acceso equivalente antes de publicarlas.
- Mantenga `DOCUMENT_EXPLORER_ALLOW_GLOBAL=false` en ambientes compartidos.
- No exponga el emisor de JWT ni sus credenciales en `public/`.

Consulte [documentación](docs/README.md) y [despliegue](docs/operations/deployment.md).

## Publicación en GitHub

Antes de publicar, ejecute `npm run verify`, inspeccione `git status --short` y `git diff --cached --name-only`, y confirme que `.env`, `logs/`, `generated/` y credenciales no están en el índice. Consulte [seguridad](docs/operations/security.md).
