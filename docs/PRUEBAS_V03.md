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

## No confirmado en este entorno

- Chromium local: **bloqueado** por política del navegador (`net::ERR_BLOCKED_BY_ADMINISTRATOR` incluso sobre `data:`). No afirmar que E2E pasó localmente.
- GitHub Actions E2E y auditoría de dependencias: **requieren observar la ejecución de la nueva PR**.
- Rendimiento bajo carga, accesibilidad con lector de pantalla, Safari real, cumplimiento jurídico, pruebas de intrusión.
- Funcionamiento en hosting real, backups programados y disponibilidad del servicio: no se ha desplegado.

Los nuevos archivos `.github/workflows/browser.yml` y `.github/workflows/security.yml` activan automatización de comprobaciones del repositorio, **no publicaciones en producción**.
