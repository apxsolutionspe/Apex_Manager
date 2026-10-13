# Equipo y operaciones de APEX_PRIME_X (versión 0.3)

> Estructura **implementada como capacidad técnica**. No se han contratado personas ni creado usuarios reales.

## Roles, funciones y límites de acceso

| Perfil | Responsabilidad | Acceso habilitado |
| --- | --- | --- |
| Administrador | Aprueba catálogo, asigna trabajos y administra personal | Catálogo, clientes, cotizaciones, órdenes, equipo, auditoría |
| Ventas | Responde cotizaciones y actualiza su estado | Lista reciente de cotizaciones y su estado; sin acceso a catálogo, cuentas ni todas las órdenes |
| Técnico | Ejecuta el trabajo asignado y registra avance | Solo órdenes asignadas a su usuario; sin acceso global a cotizaciones |
| Cliente | Consulta solicitud propia | Código de cotización + teléfono; sin acceso al panel |

**Seguridad:** credenciales individuales con PBKDF2, expiración de 8 h, tokens solo en memoria del navegador. El administrador puede desactivar inmediatamente cuentas; un cambio de contraseña **no invalida tokens anteriores** sin desactivar la cuenta. Falta MFA, revocación de sesiones granular, rate limiting compartido y auditoría externa.

## Proceso comercial establecido

1. **Interés:** cliente revisa catálogo, carrito y envía una solicitud. En entorno no-demo solo se registra si se configuró la URL de un aviso real de privacidad y el usuario lo acepta.
2. **Registro:** se crea un código `COT-...` y una instantánea de artículos y precios. El cliente puede abrir WhatsApp *manualmente* si el número ha sido aprobado y configurado.
3. **Ventas:** comercial cambia la cotización a contactado, cotizado, aprobado o rechazado. No hay promesa automática de inventario, plazo ni aprobación de pago.
4. **Automatización:** cuando se aprueba una cotización que incluya un servicio, el servidor crea **una** orden interna pendiente y sin técnico asignado. El mecanismo evita duplicados para la misma cotización.
5. **Asignación:** administrador asigna la orden a un técnico activo desde el panel. Nadie se asigna automáticamente sin política humana aprobada.
6. **Ejecución:** técnico ingresa por `/equipo`, ve solo sus órdenes, actualiza el estado y deja comentarios operativos.
7. **Control:** administrador consulta indicadores, órdenes sin asignar y registro de eventos; cliente consulta estado de cotización.

## Plantilla de puestos para cuando el negocio contrate personal

- Responsable comercial: seguimiento de solicitudes, precios finales, comunicación de condiciones.
- Coordinador de operaciones: valida requisitos técnicos, agenda visitas y asigna técnicos.
- Técnico de campo / remoto: diagnóstico, ejecución, cierre documentado y reporte de incidencias.
- Responsable de plataforma: actualizaciones, control de accesos, backups, seguridad y disponibilidad.

Una misma persona puede cubrir varios puestos al iniciar; **los permisos de la aplicación actualmente no son equivalentes** a una organización con roles y jerarquías complejas.

## SLA sugeridos (NO habilitados ni comprometidos)

- Primera respuesta comercial: siguiente jornada hábil.
- Clasificación de urgencia técnica: según capacidad y contrato confirmado.
- Registro de cierre: al terminar cada servicio.

Para activar notificaciones de SLA, recordatorios a responsables y asignación automática, primero se requiere un horario de atención oficial, personas designadas y consentimiento para mensajería.
