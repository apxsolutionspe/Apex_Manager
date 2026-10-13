# APEX Global Intelligence Swarm v0.1

Proyecto independiente en una subcarpeta de `Apex_Manager`; no modifica ni reemplaza la aplicación existente.

Panel de investigación económica. Obtiene señales públicas de Hacker News y GitHub; muestra el flujo de agentes lógicos, filtros, deduplicación, puntajes de relevancia, aprobaciones humanas y bóveda documental.

**No es un servicio de inversión, billetera o custodia.** Los resultados son señales no verificadas, no saldos ni títulos de propiedad. Jamás solicita frases semilla ni mueve fondos.

La interfaz se ofrece con código abierto HTML/CSS/JavaScript. Cuenta personal opcional a través de Supabase/Lovable Cloud (clave *publicable*, reglas RLS de separación por usuario). Un visitante puede explorar datos en vivo pero no conservar expedientes privados. El modo automático funciona solamente con la pestaña abierta y exige iniciar sesión para registrar historial de forma persistente. No funciona como servicio 24/7.

Para ejecutar localmente: desde esta carpeta `python3 -m http.server 8000`; abrir `http://127.0.0.1:8000`. El proyecto usa un módulo ESM público del cliente Supabase; requiere acceso a Internet para iniciar sesión.

Para desplegar gratis: activar en GitHub `Settings > Pages > Build and deployment > Source = GitHub Actions`, luego ejecutar el flujo `Publicar APEX Swarm` si GitHub no lo ejecutó automáticamente. URL esperada *solo después de éxito verificado*: `https://apxsolutionspe.github.io/Apex_Manager/`.

**Limitaciones:** las consultas públicas están sujetas a CORS, cuotas, disponibilidad y cambios de API; pueden fallar y el sistema mostrará el error sin generar resultados ficticios. La relevancia es heurística, no probabilidad de beneficio. La bóveda guarda **metadatos y evidencia descriptiva**, no activos económicos.

## Pruebas

`node --test tests/core.test.mjs` y `node --check app.js`. Pruebas de navegador manual: escanear, filtrar, revisar, aprobar, archivar, exportar, automatizar, pausar y detener.

## Seguridad

Solo fuentes públicas permitidas. No hace escaneo de dispositivos, descubrimiento de IP, acceso a servidores ajenos ni explotación. Para producción: auditoría externa de RLS, límites de uso por usuario en servidor, gestión de datos y cumplimiento de las políticas de proveedores.
