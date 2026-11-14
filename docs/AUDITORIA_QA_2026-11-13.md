# Acta técnica de QA integral — APEX PRIME X

**Fecha:** 13/11/2026. **Repositorio:** apxsolutionspe/Apex_Manager.  
**Ambiente:** GitHub Actions (Ubuntu, FastAPI en localhost, datos sintéticos y SQLite efímero).  
**Commit validado:** `248c2ce228772325f1f3bcea10bed379fe0a0999`.  
**Estado:** las pruebas de cotización y seguimiento pasan; la venta con pago sigue sin implementarse.

## Evidencia automatizada, no transaccional

- [QA integral en pull request #54](https://github.com/apxsolutionspe/Apex_Manager/actions/runs/43472843746): **success**, tres motores.
- [QA comercial Chromium](https://github.com/apxsolutionspe/Apex_Manager/actions/runs/43472842337): **success**.
- [CI Pytest](https://github.com/apxsolutionspe/Apex_Manager/actions/runs/43472841974): **success**.
- La suite `tests/browser_customer_journey.py` ejecuta un navegador real en 4 viewports: 320x640, 390x844, 768x1024, 1440x900. Matriz 3×4 = 12 combinaciones.
- Verifica HTTPS local no (el test usa HTTP solo en localhost), respuesta de catálogo, desbordamiento horizontal, errores JS, cabeceras CSP/X-Frame-Options, carrito, cotización, seguimiento por código/teléfono, acceso de administración bloqueado sin autorización, login QA, cambio de estado y actualización del seguimiento.
- Evidencia visual y métricas en artefactos de GitHub Actions (retención 7 días).
- Defecto corregido: ancho de encabezado a 320px, que antes generaba `scrollWidth=329/330 > 320` en Chromium/Firefox. Regla responsive integrada en `frontend/styles.css`.

## Latencia observada — API local en runner de CI

Cada cifra procede de **35 solicitudes secuenciales** contra FastAPI local por endpoint y navegador. Son latencias de una máquina de pruebas, no de Internet pública ni p95 bajo concurrencia.

| Motor | Endpoint | Mediana (ms) | p95 (ms) | Errores |
|---|---|---:|---:|---:|
| Chromium | /api/health | 1.44 | 4.60 | 0 |
| Chromium | /api/products | 1.92 | 2.13 | 0 |
| Chromium | /api/config | 1.50 | 1.79 | 0 |
| Firefox | /api/health | 2.01 | 5.05 | 0 |
| Firefox | /api/products | 2.71 | 3.49 | 0 |
| Firefox | /api/config | 1.94 | 2.41 | 0 |
| WebKit | /api/health | 2.15 | 4.02 | 0 |
| WebKit | /api/products | 2.64 | 2.99 | 0 |
| WebKit | /api/config | 1.92 | 2.32 | 0 |

## Recorrido existente vs. venta solicitada

**Validado:** catálogo → carrito → formulario con consentimiento sintético → cotización registrada → seguimiento → cambio de estado administrado → seguimiento actualizado.  
**No existe todavía:** cuenta de comprador con correo verificado, promociones y cupones en el servidor, carrito con checkout pagado, pasarela transaccional, facturación ni confirmación de cobro.

CatálogoExpress en GitHub Pages es un generador de catálogos HTML y pedidos voluntarios mediante WhatsApp, no una tienda con cuentas y pagos. Una cotización aprobada **no equivale a pago acreditado**.

## Condiciones de no publicación comercial

1. Datos legales, privacidad y Libro de Reclamaciones validados para Perú.
2. Catálogo y precios reales aprobados, condiciones comerciales y envío/entrega.
3. Servidor público con HTTPS, almacenamiento durable, respaldos y restauración ensayada.
4. Identidad de clientes segura, correo verificado y opt-in separado para marketing.
5. Promociones aplicadas en backend con reglas verificables y auditoría.
6. Pago integrado con proveedor autorizado, webhook autenticado, idempotencia y conciliación.
7. Accesibilidad WCAG, pruebas de carga, dispositivos físicos y análisis de seguridad.
8. Autorización del responsable antes de capturar datos o iniciar cobros reales.

**Resultado de salida a producción: NO GO.** QA de cotización ≠ certificación de e-commerce listo.

## Enlaces

- Pull request: https://github.com/apxsolutionspe/Apex_Manager/pull/54
- Checklist de producción: https://github.com/apxsolutionspe/Apex_Manager/blob/main/docs/CHECKLIST_PRODUCCION.md
- Normativa de datos Perú: https://www.gob.pe/institucion/anpd/normas-legales/6554453-16-2024-jus
- Libro de Reclamaciones: https://consumidor.gob.pe/libro-de-reclamaciones/
