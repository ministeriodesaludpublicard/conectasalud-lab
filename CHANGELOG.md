# Historial de cambios

## 1.9.2 — Reorganización para repositorio (noviembre de 2026)
- Documentación consolidada en `README.md`, `CHANGELOG.md` y `docs/`.
- Plantilla `.env.example` genérica, sin direcciones institucionales ni secretos.
- Se excluyen de la distribución los registros, el archivo `.env` y notas de infraestructura.
- Se retiran scripts de parcheo ajenos al laboratorio y la interfaz JS antigua no utilizada.
- Las pruebas de `tests/` se unifican en `test/`; se mantiene la ejecución de pruebas de ambos módulos.
- La publicación ITI-65, búsqueda ITI-67 y recuperación ITI-68 mantienen sus rutas existentes.

## 1.9.2 — Verificación de pruebas y contratos
- Contratos de publicación, búsqueda y recuperación revisados.
- Validación del perfil y código de Composition frente al tipo documental.
- Verificaciones de carga de Patient y de identificadores documentales.

## 1.9.1 — Etiquetas de casos de uso
- Se corrige la presentación de etiquetas de IPS/NPS (Track 1), ECR (Track 2) y ONCO (Track 3).
- Laboratorio aparece como informe clínico, no como track independiente.

## 1.9.0 — Explorador documental
- Explorador integrado por servidor configurado para DocumentReference, Bundle y Binary.
- Búsqueda por paciente, filtros, paginación y control de acceso del explorador.

## 1.8.x — Intercambio mediado
- JWT institucional automático en el backend.
- Construcción y publicación de transacción FHIR para ITI-65.
- Búsqueda ITI-67 por `GET /DocumentReference` y recuperación ITI-68 por `/documents/{id}`.

## 1.7.x — Funcionalidad inicial
- Editor, validador y formularios guiados FHIR; servicios desacoplados mediante OpenHIM.
