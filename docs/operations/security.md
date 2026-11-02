# Configuración, seguridad y publicación

## Separación de entornos

Use `.env.example` exclusivamente como plantilla. Personalice `.env` fuera de Git: servidor FHIR, validador, canales OpenHIM, emisores JWT y credenciales. No envíe `.env` por correo ni lo incorpore a incidencias.

Variables de mayor sensibilidad: `OPENHIM_CLIENT_SECRET`, `OPENHIM_PASSWORD`, `OPENHIM_PUBLISH_PASSWORD`, `ITI65_TEST_TOKEN`, `OPENHIM_JWT`, `FHIR_BEARER_TOKEN`, `FHIR_VALIDATION_BEARER_TOKEN`, `MPI_PASSWORD` y los tokens del explorador.

- No exponer `OPENHIM_TOKEN_URL` ni los secretos de autenticación al navegador.
- Utilizar TLS válido (`OPENHIM_TLS_REJECT_UNAUTHORIZED=true`) y proteger API y web tras autenticación de usuarios; los canales de OpenHIM por sí solos no autentican al usuario web del laboratorio.
- `DOCUMENT_EXPLORER_ALLOW_GLOBAL=false` debe mantenerse fuera de entornos administrativamente controlados.
- No versionar direcciones de infraestructura, inventarios institucionales, archivos clínicos, logs, respaldos ni certificados.
- Evitar tokens en parámetros de consulta, trazas, capturas y reportes de errores.

## Antes de confirmar un commit

```bash
git status --short
git diff --cached --name-only
git check-ignore -v .env SERVIDORES.json logs/conectasalud-lab.log
```

Si un secreto ya se subió a Git, **añadirlo a `.gitignore` no lo elimina del historial**: revoque o rote la credencial y gestione la retirada del historial por el procedimiento autorizado.

## Limitación conocida

El acceso a la API web de Lab requiere controles externos de autenticación/autorización; no asuma que el JWT institucional sustituye el control de usuarios finales.
