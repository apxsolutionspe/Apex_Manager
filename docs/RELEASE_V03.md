# APEX_PRIME_X · Entrega candidata v0.3 (2026-10-13)

**Estado:** versión de revisión; no es una publicación productiva de la tienda.

## Módulos desarrollados

| Sistema | Función | Evidencia esperada |
|---|---|---|
| Catálogo + carrito + WhatsApp | Módulos existentes, validados con pruebas API | `pytest` |
| Privacidad | Consentimiento requerido, versión/fecha registrada, borrador declarado y bloqueo por defecto | `test_consent_required_and_recorded`, `test_no_intake_by_default_even_with_demo` |
| Preparación de producción | Readiness pública sin revelar secretos; sin cotizaciones con configuración incompleta | `test_production_gate_*` |
| Panel de gestión | Auditoría de cambios, endpoint protegido y nueva pestaña | `test_audit_authenticated_and_without_personal_data` |
| Continuidad | Backup SQLite consistente, prueba de restauración en memoria, sin sobrescritura | `test_backup_verification_does_not_change_original` |
| Evolución BD | Migración idempotente que conserva los registros anteriores | `test_schema_migration_preserves_old_quotes` |
| QA móvil | Chromium sobre servidor de pruebas con datos ficticios; capturas automáticas | GitHub Actions `QA tienda comercial · Chromium` |

## Criterios de salida para producción: aún no cumplidos

- Identificar al responsable de datos, correo oficial, RUC si corresponde y política de privacidad revisada.
- Introducir catálogo comercial verificado y número de WhatsApp autorizado.
- Elegir alojamiento persistente con cifrado en tránsito y almacenamiento externo de backups.
- Ejecutar y documentar QA real sobre Android/iOS/escritorio; gestionar incidentes.
- Revisar y aprobar el plan de almacenamiento/eliminación de datos, roles/MFA y cambios críticos.
- Habilitar cotizaciones y publicación productiva únicamente con la autorización del titular.

## Alcance y honestidad operativa

Las pruebas unitarias pasan localmente cuando así se indique; la E2E debe verificarse en CI si el navegador local está bloqueado. Los respaldos de prueba usan datos ficticios y no significan que exista ya un respaldo productivo programado. No se ha contratado dominio/hosting, enviado WhatsApp ni configurado cobros.
