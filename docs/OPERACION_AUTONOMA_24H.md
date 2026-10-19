# APEX PRIME X — operación comercial automática sin gasto

**Fecha de configuración:** 19 de octubre de 2026, Perú.

## Objetivo y criterios

Mantener APEX disponible para recibir solicitudes, investigar oportunidades de ingresos verificables, corregir fallos del embudo comercial y trabajar con el menor número posible de intervenciones del propietario. La ejecución **no es un proceso perpetuo en un servidor propio**, ni existe garantía de facturación, empleo, depósitos, conversiones o disponibilidad sin fallos.

1. **Embudo de ventas:** página pública de servicios y demo CotizaPro deben permanecer accesibles en móvil y enlazar al WhatsApp comercial publicado (+51 931 797 758). El interesado inicia la conversación. No enviar mensajes no solicitados.
2. **Monitoreo cada 2 horas:** GitHub Actions ejecuta los siete roles multiagente y, por separado, comprueba HTTP 200 + elementos de contacto de la página servicios y CotizaPro. La frecuencia es nominal y GitHub puede retrasar o suspender tareas programadas por políticas/cuotas/inactividad.
3. **Investigación de recompensas:** únicamente uso de API GitHub pública de lectura y fuentes oficiales, deduplicación, filtro de estafas, máximo de tres búsquedas por ciclo. Solo se cuenta dinero recibido con comprobante validado.
4. **Cripto:** conservar radar existente; nunca contratar deuda, staking, gas, trading ni transferir monedas. No solicitar claves privadas o frases semilla.
5. **Publicaciones:** Metricool llegó al límite con ERROR en los posts del 19-10-2026. Detener altas mientras haya bloqueo, comprobar su contador de publicaciones en el panel y no asumir que PENDING significa publicación efectiva. Buscar ventas con la web y contacto orgánico, sin gastar en anuncios ni elevar plan.
6. **Atención entrante:** clasificar mensajes voluntarios comerciales, no contestar publicidad ni correos sospechosos; nunca enviar un precio no autorizado, datos sensibles, información financiera o contratos automáticos. Evitar mensajes repetidos.
7. **Documentación y alertas:** conservar el informe técnico del workflow como artefacto 14 días; revisar fallos de pruebas y de salud. Los informes no son extractos bancarios.

## Entradas públicas

- Servicios: https://apxsolutionspe.github.io/Apex_Manager/servicios.html
- CotizaPro: https://apxsolutionspe.github.io/Apex_Manager/productos/cotizapro/
- Email comercial publicado en CotizaPro: apx.solutions.pe@gmail.com

## Pruebas y recuperación

- `node --test apex-global-intelligence-swarm/tests/sales-health.test.mjs`
- `node apex-global-intelligence-swarm/scripts/sales-health.mjs`
- Workflow: `.github/workflows/apex-multiagent.yml`.
- `artifacts/sales-health.json` queda como archivo de evidencia en la ejecución programada. Si falla HTTP, los enlaces o las pruebas, el job falla y GitHub puede emitir avisos según la configuración de notificaciones del usuario.
- No se guarda información privada de visitantes, solicitudes ni billeteras en repositorios públicos.

**Fuera de alcance:** creación masiva de cuentas, auto-replicación en servicios ajenos, campañas de spam, compras de inventario con dinero propio, inversiones, pagos, facturación tributaria o ingreso ficticio. Requieren integraciones comerciales/financieras legítimas que todavía no están conectadas.
