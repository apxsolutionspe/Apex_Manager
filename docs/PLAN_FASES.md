# Plan de ejecución por fases

| Fase | Objetivo y entregables | Estado al 13-10-2026 | Aprobación requerida |
|---|---|---|---|
| 0 · Definición | Alcance comercial, módulos, stack gratuito, flujos y matriz de riesgos. | **Realizado** para un MVP sin datos reales. | Confirmar branding, WhatsApp, RUC, servicios reales y política comercial. |
| 1 · Base funcional | Catálogo, filtros, carrito, formulario, BD persistente, panel con autenticación, seguimiento, gestión de servicios. | **Implementado localmente**. | No se requiere para inspección local; sí para usar datos reales. |
| 2 · Verificación | API, validaciones, control de acceso, registro, estados, uso móvil y navegador. | **Pruebas API ejecutadas**; prueba Chromium de extremo a extremo bloqueada por política del entorno. | Probar móvil/desktop del propietario antes de habilitar uso comercial. |
| 3 · Preparación para producción | Sustitución de datos DEMO, políticas, TLS, respaldos, migraciones, monitoreo, 2FA, roles, QA multiplataforma. | **Pendiente**. | **Sí** antes de conectar datos o clientes reales. |
| 4 · Despliegue | Dominio, alojamiento, secretos en servidor, configuración WhatsApp verificada y publicación. | **No realizado**. | **Sí**, aprobación explícita previa a publicar. |
| 5 · Crecimiento | Inventario real, facturación e-commerce, consentimientos, CRM avanzado, dashboards, soporte multisede. | **Propuesta futura**. | **Sí**, según coste y riesgo. |

## Priorización para obtener clientes sin inversión

1. Reemplazar ocho registros DEMO por servicios ofrecidos, descripciones finales e identidad visual validada.
2. Usar el catálogo local para comprobar recorrido de cotización y alinear el contacto comercial.
3. Cumplir checklist de privacidad y seguridad antes de capturar datos de clientes en producción.
4. Tras aprobación, llevar a un alojamiento gestionado / servidor y habilitar un dominio.
5. Medir tiempo de respuesta, cotizaciones por servicio, cotizaciones aprobadas y órdenes cerradas (nunca etiquetarlas como ventas cobradas).

## Decisiones pendientes del negocio

- Número WhatsApp oficial en formato internacional.
- Datos de contacto, RUC (si procede) y documentación comercial del negocio.
- Catálogo final, precios referenciales o «a cotizar», disponibilidad y términos.
- Política de privacidad, retención de datos y consentimiento.
- Dominio, alojamiento, plan de copias y personas con acceso al panel.

Sin estas decisiones, el MVP se mantiene intencionalmente **sin publicación**.
