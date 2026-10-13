# APEX Global Intelligence Swarm v0.1

Proyecto independiente en una subcarpeta de `Apex_Manager`; no modifica ni reemplaza la aplicación existente.

Panel de investigación económica. Obtiene señales públicas de Hacker News y GitHub; muestra el flujo de agentes lógicos, filtros, deduplicación, puntajes de relevancia, aprobaciones humanas y bóveda documental.

**No es un servicio de inversión, billetera o custodia.** Los resultados son señales no verificadas, no saldos ni títulos de propiedad. Jamás solicita frases semilla ni mueve fondos.

La interfaz se ofrece con código abierto HTML/CSS/JavaScript. Cuenta personal opcional a través de Supabase/Lovable Cloud (clave *publicable*, reglas RLS de separación por usuario). Un visitante puede explorar datos en vivo pero no conservar expedientes privados. Hay dos modalidades: **radar público programado** mediante GitHub Actions (consulta dos APIs y actualiza la web aproximadamente cada seis horas sin depender del navegador, sujeto a límites y demoras de GitHub); y **ciclos personales** disparados en el navegador (automatización únicamente con pestaña abierta). El radar público no accede a datos privados, no genera fondos ni guarda expedientes en tu cuenta.

Para ejecutar localmente: desde esta carpeta `python3 -m http.server 8000`; abrir `http://127.0.0.1:8000`. El proyecto usa un módulo ESM público del cliente Supabase; requiere acceso a Internet para iniciar sesión.

Para desplegar gratis: activar en GitHub `Settings > Pages > Build and deployment > Source = GitHub Actions`, luego revisar el flujo `APEX Swarm · QA, vista previa y publicación` si GitHub no lo ejecutó automáticamente. URL desplegada: `https://apxsolutionspe.github.io/Apex_Manager/` (GitHub Actions confirmó publicación exitosa).

**Limitaciones:** las consultas públicas están sujetas a CORS, cuotas, disponibilidad y cambios de API; pueden fallar y el sistema mostrará el error sin generar resultados ficticios. La relevancia es heurística, no probabilidad de beneficio. La bóveda guarda **metadatos y evidencia descriptiva**, no activos económicos.

## Pruebas

`node --test tests/core.test.mjs` y `node --check app.js`. Pruebas de navegador manual: escanear, filtrar, revisar, aprobar, archivar, exportar, automatizar, pausar y detener.

## Seguridad

Solo fuentes públicas permitidas. No hace escaneo de dispositivos, descubrimiento de IP, acceso a servidores ajenos ni explotación. Para producción: auditoría externa de RLS, límites de uso por usuario en servidor, gestión de datos y cumplimiento de las políticas de proveedores.

## Activación de cuenta privada

1. Abrir el sitio y pulsar **Entrar / Cuenta**.
2. Si ya existe una cuenta pendiente, usar **Reenviar confirmación** con el correo registrado y comprobar la bandeja de entrada y spam. Solo su propietario debe abrir el enlace de confirmación.
3. También se puede solicitar **Enviar enlace de acceso**, sin compartir contraseña, o recuperar acceso con **Recuperar contraseña**.
4. El usuario crea su propia contraseña en el navegador o tras una recuperación verificada. **Ninguna contraseña debe escribirse en chats, issues ni archivos públicos.**
5. Una vez confirmada la dirección, iniciar sesión para guardar expedientes. Cada cuenta tiene aislamiento RLS. Si el proveedor de autenticación rechaza la URL de retorno de GitHub Pages, se debe configurar la lista de URLs de redirección permitidas en el administrador del servicio de autenticación antes de dar por completada la activación.

El sistema no puede confirmar automáticamente que una persona controla una dirección de correo. Tampoco existe una contraseña recuperable en texto claro: la recuperación se realiza por correo del titular.

## Radar automático sin navegador

- Archivo de salida durante el despliegue: `feed/latest.json` (público, sin información de cuentas).
- Planificación de GitHub Actions: `17 */6 * * *` (UTC). GitHub puede retrasar o cancelar algunas ejecuciones programadas.
- Motor: `scripts/refresh-feed.mjs`; solo consulta hosts aprobados, valida el formato, deduplica y publica hasta 40 señales.
- La primera ejecución comprobada devolvió 25 registros de GitHub y 25 de Hacker News; 40 señales de lectura pública se guardaron en el artefacto desplegado. No se reclamaron ni adquirieron activos financieros.
- Para automatizar los **expedientes privados** con navegador cerrado hace falta un componente de servidor autenticado, permisos mínimos y revisión de amenazas. No está implementado en v0.1.
