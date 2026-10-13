# Checklist de aprobación para producción — APEX_PRIME_X

**Estado:** pendiente. La publicación del código en GitHub NO equivale a publicar la web para clientes.

## Cumplimiento y negocio

- [ ] Confirmar denominación, RUC, correo, WhatsApp oficial y responsables del negocio.
- [ ] Verificar catálogo, inventario real, precios, zonas atendidas y términos de servicio.
- [ ] Aprobar aviso de privacidad, consentimiento, finalidad de datos y política de retención conforme a obligaciones aplicables en Perú.
- [ ] Implementar procedimiento para acceso, rectificación y eliminación de datos del cliente.

## Seguridad y confiabilidad

- [ ] Configurar secretos fuertes en el alojamiento, nunca en Git.
- [ ] Redactar y probar políticas de backup + restauración de SQLite; evaluar migración a PostgreSQL.
- [ ] Revisar tasas de solicitudes y protección compartida entre procesos, cabeceras HTTPS y alertas.
- [ ] Implementar roles, auditoría de acciones y MFA si el panel atenderá múltiples operadores.
- [ ] Revisar vulnerabilidades de dependencias y ejecutar pruebas E2E en Chrome móvil, Safari y Firefox.
- [ ] Aprobar estrategia de sesiones, expiración y revocación de accesos.

## Publicación bajo aprobación explícita

- [ ] Elegir alojamiento gratuito compatible con persistencia y secreto almacenado.
- [ ] Verificar dominio, TLS, HTTPS y configuración de proxy inverso.
- [ ] Deshabilitar DEMO_MODE, cargar catálogo real y probar cotizaciones con datos sintéticos.
- [ ] Establecer monitoreo y plan de recuperación.
- [ ] Obtener autorización antes de exponer formularios a clientes reales.
