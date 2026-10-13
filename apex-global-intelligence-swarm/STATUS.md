# Estado de entrega — APEX Global Intelligence Swarm v0.1

Fecha: 2026-10-13 (Perú).

## Verificado mediante acciones reales

- Código fuente publicado en `apxsolutionspe/Apex_Manager/apex-global-intelligence-swarm/` sin alterar el programa comercial existente.
- GitHub Actions validó `node --check app.js`, `node --check core.js` y 7 pruebas unitarias (7 aprobadas, 0 fallos): [ejecución](https://github.com/apxsolutionspe/Apex_Manager/actions/runs/38424924962).
- Prueba con Chromium real aprobada: navegación, modal de acceso, configuración, bóveda, controles de emergencia y vista móvil.
- Prueba con Chromium ejecutó un escaneo de fuentes públicas en modo visitante y mostró **20 señales obtenidas en esa ejecución**; no son activos monetarios ni resultados garantizados: [ejecución y capturas](https://github.com/apxsolutionspe/Apex_Manager/actions/runs/38426012957). El artifact `apex-swarm-qa` incluye capturas de escritorio y móvil.
- Supabase/Lovable Cloud: esquema presente, tablas `opportunities`, `scan_runs`, `decisions`, `vault_items`, `audit_log`, `user_settings` con RLS habilitado y políticas por usuario.

## Bloqueo de publicación pública

La fase de pruebas de `.github/workflows/apex-swarm-pages.yml` pasó; `actions/configure-pages@v5` devolvió **404: Pages site not found** porque GitHub Pages está desactivado para este repositorio. Este permiso administrativo no está disponible mediante la conexión API usada.

**Acción única del propietario del repositorio:**
1. Abrir [Settings → Pages](https://github.com/apxsolutionspe/Apex_Manager/settings/pages).
2. Bajo **Build and deployment**, seleccionar **Source → GitHub Actions**.
3. Ir a [Publicar APEX Swarm](https://github.com/apxsolutionspe/Apex_Manager/actions/workflows/apex-swarm-pages.yml), pulsar **Run workflow** en `main`, comprobar que la ejecución termina en verde.
4. Solo después del resultado satisfactorio, comprobar la URL informada por GitHub Pages. Ruta habitual (no verificada todavía): `https://apxsolutionspe.github.io/Apex_Manager/`.

## Limitaciones conocidas

- La automatización funciona mientras la pestaña está abierta; no hay un clúster real de microagentes ni tareas de servidor persistentes 24/7.
- Dos fuentes de consulta pública: GitHub y Hacker News; cobertura parcial, errores de CORS/cuotas posibles.
- La autenticación está conectada al servicio de Supabase con RLS verificado en base; **no se ha realizado aún una prueba de alta y acceso real con una cuenta del propietario**.
- Bóveda = expedientes de investigación; **no custodia criptomonedas, acciones, dinero ni reclamaciones automáticas**.
- No hay rentabilidad asegurada; no se han reclamado o transferido fondos.
- Para producción se requiere seguridad adicional, cuotas centralizadas en servidor, monitoreo, respaldo y revisión legal.
