# Desbloqueo controlado de GitHub Pages · APEX Swarm

**Alcance:** únicamente la interfaz estática de `apex-global-intelligence-swarm/`. **No** publica el backend FastAPI de la tienda comercial ni conecta WhatsApp, pagos o la base de datos comercial.

## Diagnóstico real

El 13/10/2026 el workflow `Publicar APEX Swarm` pasó sus 7 pruebas JavaScript y falló en `actions/configure-pages@v5` con **HTTP 404 (Pages aún no configurado)**. Ningún paso de despliegue posterior se ejecutó. La causa se documentó en la incidencia #5.

## Qué automatiza el workflow corregido

1. Valida sintaxis y ejecuta `npm test`.
2. Crea un artefacto descargable `apex-swarm-preview` con **solo** HTML, CSS y JavaScript públicos; retención de 7 días.
3. Antes de desplegar, consulta la configuración Pages en modo solo lectura.
4. Si Pages no existe (404), **no publica**, deja instrucciones en el resumen de GitHub Actions y mantiene la validación disponible.
5. Si Pages tiene origen `workflow`, publica el artefacto validado de manera automática desde `main`. Los pull requests nunca despliegan.
6. No crea ni solicita tokens personales, no activa Pages automáticamente y no altera la configuración administrativa del repositorio.

## ÚNICA operación administrativa manual para habilitar publicación

**Requiere decisión y aprobación expresa del propietario, porque la interfaz pasará a ser pública.**

1. Abre **https://github.com/apxsolutionspe/Apex_Manager/settings/pages** con tu sesión de GitHub.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Después de aplicar ese cambio, abre **https://github.com/apxsolutionspe/Apex_Manager/actions/workflows/apex-swarm-pages.yml** y elige **Run workflow** en la rama `main` si no hay una ejecución automática nueva.
4. Comprueba en el workflow que los jobs **Probar**, **Revisar Pages** y **Publicar** terminen correctamente y visita la URL indicada por el despliegue. Nunca se debe declarar un despliegue exitoso solo porque `npm test` aprobó.
5. Si es necesario revertir la exposición pública, ve a **Settings → Pages** y despublica el sitio según las opciones de GitHub.

> Activar Pages **no** resuelve el alojamiento persistente de la tienda comercial: FastAPI/SQLite necesitan un servidor/servicio con persistencia, HTTPS, secretos y backups.

## Verificación y limitaciones

- Antes de habilitar Pages, descarga **apex-swarm-preview** desde la ejecución de Actions para inspeccionar el paquete estático; no es una URL pública.
- Las pruebas unitarias no prueban permisos, RLS, integraciones externas ni accesibilidad en móviles. Continuar QA visual y pruebas en usuario anónimo y autenticado.
- El proyecto APEX Swarm muestra señales públicas: no realiza custodia, transferencias ni acredita propiedad sobre activos.
- No almacenar contraseñas, claves privadas ni datos personales de clientes en GitHub Actions artifacts.
- No habilitar seguimiento operativo 24/7 sin un backend, políticas de uso de fuentes y controles de coste.

## Fuentes oficiales
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://github.com/actions/configure-pages/blob/main/action.yml
