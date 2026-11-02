# Despliegue y actualización de ConectaSalud Lab

## Requisitos

Node.js 20+, npm, acceso seguro a FHIR/OpenHIM/validador y un proxy HTTPS autenticado si el laboratorio se expone a usuarios.

## Primera instalación

```bash
npm ci
cp .env.example .env
# Configurar .env con los valores específicos del entorno; chmod 600 .env en Linux
npm run verify
npm start
```

Para ejecutar con PM2 desde la raíz del repositorio:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 status
curl -fsS http://127.0.0.1:3445/api/health
```

## Actualización

1. Conserve un respaldo privado y probado de `.env` y un punto de reversión del despliegue actual (fuera del repositorio).
2. Revise `git status --short` y descarte/guarde los cambios locales antes de actualizar.
3. Descargue la versión aprobada y ejecute `npm ci`.
4. Mantenga los secretos en `.env`, no en archivos del código o ejemplos.
5. Ejecute `npm run verify`; si falla, no continúe.
6. Reinicie mediante `pm2 restart conectasalud-lab --update-env` y confirme el estado/health endpoint.

No copie scripts de modificación del mediador documental al repositorio de ConectaSalud Lab.

## Rutas funcionales

- Publicación: `POST /transaction` vía OpenHIM al mediador documental.
- Búsqueda: `GET /DocumentReference` con `patient.identifier`, `status` y filtro opcional `type`.
- Recuperación: `GET /documents/{id}`.
- La autenticación institucional se realiza mediante un emisor JWT configurado únicamente en el backend.

**La exposición pública sin autenticación adicional no es segura**: revise [seguridad](security.md).
