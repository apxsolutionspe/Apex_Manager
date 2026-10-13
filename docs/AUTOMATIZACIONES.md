# Matriz de automatizaciones — situación verificable

| Automatización | Código | Activación | Qué hace / qué no hace |
| --- | --- | --- | --- |
| CI API + sintaxis Python/JS | `.github/workflows/ci.yml` | `push` y `pull_request` | Ejecuta pruebas en Python 3.12/3.13. No valida un sitio productivo. |
| E2E Chromium | `.github/workflows/browser.yml` | PR / push / manual | Prueba flujos públicos y panel con datos sintéticos. **Resultado por verificar en Actions**. |
| Análisis de vulnerabilidades | `.github/workflows/security.yml` | PR con deps, push con deps, lunes y manual | Ejecuta `pip-audit`. Si falla, investigar; no silenciar CVEs. |
| Actualizaciones de dependencias | `.github/dependabot.yml` | Semanal en GitHub | Propone PRs; **no mezcla ni despliega automáticamente**. |
| Orden desde cotización | API `approve_service_quote` | Cotización de servicio aprobada | Crea orden interna idempotente, sin técnico asignado. |
| Auditoría | Tabla `audit_events` | Cambios de productos, cotizaciones, usuarios y órdenes | Registra actor/acción/objeto sin datos de cliente en eventos. |
| Guardarraíl de privacidad | API `/api/quotes` | Modo real (`DEMO_MODE=false`) | Rechaza datos si falta URL HTTPS del aviso o consentimiento. No reemplaza asesoría legal. |
| Verificación de preparación | API `/api/readiness` | Consulta manual/monitoreo externo | Responde 503 si faltan parámetros indispensables. **No es prueba de seguridad**. |
| Backup SQLite | `scripts/backup_sqlite.py` | Manual o timer aprobado | Copia consistente + `integrity_check`. No elimina ni sube respaldos a la nube. |
| Backup periódico | `deploy/apex-backup.timer` | **NO ACTIVADO** | Plantilla systemd para instalación posterior en un servidor administrado. |

**No implementado:** WhatsApp automático por API oficial, boletines a clientes, recordatorios enviados, facturación, pagos/Yape, recuperación ante incidentes remotos, correo transaccional, hosting en producción ni copia de seguridad de un servidor inexistente. Estas integraciones requieren números, permisos, proveedores y aprobación del titular.

## Actuar cuando falle un flujo

1. Abrir la pestaña `Actions` del repositorio y localizar el job rojo.
2. Abrir logs y distinguir error de test, vulnerabilidad o error de instalación.
3. Crear rama correctiva y PR, ejecutar CI y revisar el diff.
4. Evitar mezclar automáticamente código defectuoso o desplegarlo.
5. Antes de cargar clientes reales, probar backups/restauración y checklist de producción.
