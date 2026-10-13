# Acta de pruebas · APEX_PRIME_X v0.1.0

**Fecha:** 13 de octubre de 2026. **Entorno:** contenedor Linux del asistente, Python 3.13, pytest 9.0.2, FastAPI 0.128.2, Node.js 22.16.0. **Base de datos de pruebas:** SQLite temporal aislada, no datos reales.

## Pruebas automatizadas realmente ejecutadas

Comando: `python -m pytest`

**Resultado: 10 pruebas pasaron.**

Casos: salud de servicio y carga de catálogo DEMO; filtrado por tipo; protección de rutas administrativas; contraseñas PBKDF2 y tokens expirados/alterados; límites de intento; registro de cotización y preparación de WhatsApp; rechazo de entradas no válidas, cantidades y artículos inexistentes; registro/edición/ocultamiento de catálogo y preservación de precio histórico; cambios de estado y alta/seguimiento de servicios; operación sin credenciales ni teléfono; consulta pública de estado con código/teléfono y privacidad de la respuesta.

Verificación estática: `python -m compileall backend` y `node --check frontend/app.js` / `node --check frontend/admin.js` se ejecutaron sin errores de sintaxis.

## Bloqueos e incertidumbres

- **E2E gráfico con Chromium:** intentamos iniciar navegador automatizado Playwright y abrir `http://127.0.0.1:8765`, direcciones externas de prueba y un archivo local. El navegador respondió `net::ERR_BLOCKED_BY_ADMINISTRATOR` para todas; por tanto **no se ejecutó exitosamente ninguna prueba gráfica del sitio**, ni se generaron capturas verificadas.
- **Compatibilidad móvil real:** el CSS contiene media queries para móvil/tablet, pero el diseño aún requiere comprobación con Chrome/Safari en equipos reales.
- **Riesgos productivos:** no se ha realizado pentest, auditoría de privacidad, prueba de concurrencia, backups/restore verificados ni despliegue HTTPS.
- **Acciones externas:** no se publicó un sitio ni se contactó clientes, integró un servicio bancario, cargó un teléfono real o envió mensajes.

## Resultado de aceptación del MVP

**APTO PARA PRUEBAS LOCALES DEL FUNCIONAMIENTO DE API Y PROTOTIPO. NO APTO AÚN PARA PRODUCCIÓN.**

Se recomienda validar manualmente en el navegador del propietario: filtros, búsqueda, carrito, cotización, validación de teléfono, consulta de seguimiento, inicio/cierre de sesión, alta y edición de productos y cambios de estado. Un eventual fallo deberá corregirse antes de habilitar usuarios reales.
