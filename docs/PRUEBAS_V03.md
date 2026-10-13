# Evidencia de QA de APEX_PRIME_X v0.3 — actualización 13/10/2026

## Ejecutado localmente

- `python -m pytest -q`: **18 pruebas aprobadas** en Python 3.13.
- `python -m compileall -q backend scripts`: compilación sintáctica correcta.
- `node --check frontend/app.js`, `frontend/admin.js`, `frontend/team.js`: sintaxis JavaScript correcta.
- Probada migración idempotente SQLite y persistencia de productos.
- Probados permisos de administrador, ventas, técnico; desactivación de cuentas; asignación exclusiva.
- Probado flujo automático: aprobación de cotización de servicio → orden pendiente única.
- Probados backups con `sqlite3.backup()` más `PRAGMA integrity_check` y restauración de datos sintéticos.
- Probado control de privacidad en modo no-demo, evidencia de aceptación y `/api/readiness`.

## Ejecutado en GitHub Actions (rama feature, sin despliegue)

- CI en Python 3.12 y 3.13: **aprobada**, 18 pruebas API (ejecución 38422722169).
- Chromium/Playwright: **2 pruebas smoke aprobadas** con recorrido móvil de cotización y acceso admin/equipo (ejecución 38422722627).
- `pip-audit` con versiones actualizadas de FastAPI y Starlette: **aprobado**, sin vulnerabilidades reportadas en esa ejecución (38422722334).
- Se descubrió y corrigió un error real: el formulario cliente mostraba un error JS tras recibir HTTP 201. Corregido usando una referencia estable al formulario; se corrigió el mismo patrón en alta de órdenes.
- La validación local con Chromium sigue **bloqueada** por la política del entorno (`net::ERR_BLOCKED_BY_ADMINISTRATOR`); los E2E sí se ejecutaron en GitHub.

## No confirmado

- Rendimiento bajo carga, accesibilidad con lector de pantalla, Safari real, cumplimiento jurídico, pruebas de intrusión.
- Funcionamiento en hosting real, backups programados y disponibilidad del servicio: no se ha desplegado.

Los nuevos archivos `.github/workflows/browser.yml` y `.github/workflows/security.yml` activan automatización de comprobaciones del repositorio, **no publicaciones en producción**.
