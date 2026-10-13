# APEX_PRIME_X · Plataforma comercial

**Versión:** `0.3.0` · **Estado:** preproducción técnica / **NO DESPLEGADO PARA CLIENTES** · **Idioma:** español · **Moneda:** soles (PEN).

Plataforma de catálogo + cotizaciones + administración de servicios, optimizada para móvil y creada con componentes de software libre. No integra pasarelas de pago ni envía mensajes automáticamente.

## Funcionalidades implementadas

| Módulo | Alcance actual |
|---|---|
| Catálogo | Filtro por producto/servicio; búsqueda; destacados; productos activos; SKU, stock opcional, precio opcional. |
| Carrito | Agregar, quitar, ajustar cantidades y persistir selección en navegador. |
| Cotizaciones | Formulario de contacto; validación de cantidades y stock en servidor; precios tomados de base de datos; código único; registro persistente. |
| WhatsApp | Mensaje estructurado y vínculo `wa.me` **solo** cuando `WHATSAPP_NUMBER` está configurado. El visitante debe hacer clic para abrir WhatsApp; no hay envíos automáticos. |
| Seguimiento público | Consulta con código de cotización + teléfono utilizado; devuelve estado sin exponer datos personales. |
| Acceso administrativo | Contraseña hasheada PBKDF2; token HMAC expirante; control de acceso a rutas; control de intentos básico. |
| Panel / CRM básico | Indicadores, cotizaciones con estados, productos/servicios editables, órdenes internas y estados de ejecución. |
| Responsive | Maquetación adaptativa, navegación móvil, formularios accesibles y carrito lateral. |

> **Código fuente en GitHub (no despliegue comercial):** el proyecto puede almacenarse públicamente como código; no incluye datos de clientes ni credenciales reales.

> **AVISO:** La base inicial incluye ocho artículos de ejemplo con prefijo `DEMO-`, **sin precios reales** ni stock certificado. Su información no es una oferta comercial definitiva. Antes de publicar se deben retirar o reemplazar, validar datos fiscales, políticas y precios.

## Novedades de la versión 0.3

- **Portal del equipo:** `/equipo`, cuentas individuales de ventas y técnicos, permisos acotados y desactivación inmediata.
- **Asignación de órdenes:** administrador puede asignar técnicos activos; cada técnico actualiza solamente sus propias órdenes.
- **Automatización comercial:** aprobar una cotización que incluya servicios genera una orden interna *una sola vez*.
- **Auditoría interna:** historial de cambios por actor/acción/objeto sin información de clientes en eventos.
- **Consentimiento:** aviso HTTPS aprobado es requisito para registrar solicitudes cuando `DEMO_MODE=false`; conserva evidencia de consentimiento.
- **Preflight:** `/api/readiness` devuelve 503 cuando falta configuración necesaria para entorno real.
- **Backup operativo:** `scripts/backup_sqlite.py` genera una copia consistente con verificación de integridad. Incluye unidad systemd **no activada**.
- **Automatizaciones GitHub:** CI multi-Python, Dependabot semanal, auditoría semanal de dependencias y E2E Chromium en PR.

La interfaz visual E2E no pudo verificarse localmente (navegador bloqueado); el workflow de GitHub deberá comprobarse en Actions antes de considerar completado el QA.

Consulta `docs/EQUIPO_Y_PROCESOS.md`, `docs/AUTOMATIZACIONES.md`, `docs/PRUEBAS_V03.md` y `docs/DESPLIEGUE_CONTROLADO.md`.

## Tecnologías y costes

- **API:** Python 3.12+ / FastAPI (open source).
- **Base de datos:** SQLite (estándar Python). Archivo local, sin servicio externo.
- **Frontend:** HTML5, CSS y JavaScript nativos (sin librerías ni CDN).
- **Tests:** pytest y TestClient (necesario instalar `pytest` y `httpx` para ejecutarlos).
- **Infraestructura:** ejecución local gratuita; Dockerfile disponible para futuro despliegue. Hosting, dominio, backups gestionados y número WhatsApp empresarial pueden tener costes si se contratan; **no** se han contratado aquí.

## Cómo arrancar localmente

Desde la carpeta del proyecto:

```bash
python -m venv .venv
source .venv/bin/activate                  # Linux / macOS
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cp .env.example .env
```

Genera tu contraseña administrativa, introdúcela dos veces y copia la línea resultante **entre comillas simples** a `.env`:

```bash
python scripts/hash_password.py
```

Genera un secreto fuerte y cópialo a la variable `SESSION_SECRET` en `.env`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Rellena también `WHATSAPP_NUMBER=51XXXXXXXXX` con un teléfono **oficial y autorizado**, solo si deseas habilitar el botón comercial. Dejarlo vacío desactiva el enlace sin impedir el registro de cotizaciones.

```bash
bash scripts/start_local.sh
```

En el navegador local:

- `http://127.0.0.1:8000/` — catálogo comercial.
- `http://127.0.0.1:8000/admin` — panel administrativo.
- `http://127.0.0.1:8000/api/docs` — documentación interactiva de la API.

El archivo de base de datos se crea en `data/apex.db` y se excluye de Git. **No** subas `.env` a un repositorio.

## Ejecutar pruebas

```bash
python -m pip install pytest httpx
python -m pytest
node --check frontend/app.js            # Si Node.js está instalado
node --check frontend/admin.js
```

Las pruebas de API utilizan su propia base SQLite temporal y no modifican la base de datos comercial. Los resultados efectivamente observados constan en `docs/PRUEBAS.md`.

## Estructura

```text
backend/
  main.py                API, validaciones y endpoints
  database.py            creación SQLite, datos DEMO
  security.py            hashing, autenticación y tokens
frontend/
  index.html             catálogo y carrito
  app.js                 lógica del carrito, cotización, seguimiento
  admin.html             panel administrativo
  admin.js               operaciones administrativas
  styles.css             diseño responsive y UI
scripts/
  hash_password.py       crea hash PBKDF2
  start_local.sh         inicia en loopback
sources: requirements.txt, Dockerfile, .env.example
tests/test_api.py        pruebas automatizadas
 docs/                   arquitectura, plan y acta de pruebas
```

## Política de cambios y publicación

**El sistema no ha sido publicado en Internet, no se ha enlazado a WhatsApp real ni ha cobrado dinero.** No exponer el servidor local a Internet sin revisión previa. La publicación, conexiones productivas, dominio, proveedores de mensajería, carga de datos reales y cambios destructivos requieren aprobación explícita del titular.

## Limitaciones conocidas / antes de producción

1. **Identidad:** administrador ambiental y cuentas básicas de ventas/técnicos. Falta MFA, cambio de contraseña autónomo, revocación granular de sesiones y auditoría de identidad administrada.
2. **Base de datos:** SQLite funciona para bajo volumen en una sola instancia. Migrar a PostgreSQL con migraciones versionadas cuando haya concurrencia/equipos distribuidos; respaldos y restauración verificada antes de lanzamiento.
3. **Seguridad:** throttling de login, cotizaciones y búsquedas es por proceso; sustituir con límite distribuido, supervisión de abuso y antifraude. Revisar configuración TLS, proxy inverso, cabeceras y monitoreo.
4. **Datos personales:** falta un consentimiento/política de privacidad aprobada, calendario de retención y proceso para derechos del titular; no ingresar clientes reales hasta implementar estas medidas en el entorno definitivo.
5. **Cotización comercial:** precios de ejemplo y servicios personalizados no son ofertas; no hay reserva de stock, pagos, facturación ni notificaciones enviadas.
6. **Accesibilidad / navegador:** el flujo de navegador real completo y pruebas de pantalla asistiva necesitan validación en dispositivos/navegadores del usuario; ver bloqueo en el acta.
7. **Estado interno:** admin puede actualizar estado; no hay avisos automáticos al cliente. El cliente debe consultar con código + teléfono.
8. **Acceso y firma:** no existe integración con Yape, bancos, recibos de servicios, WhatsApp Business API ni terceros; cualquier integración necesita acuerdos y validación legal/operativa.

Consultar también `docs/ARQUITECTURA.md`, `docs/PLAN_FASES.md` y `docs/PRUEBAS.md`.

## Integración continua y siguiente fase

Se agrega `.github/workflows/ci.yml` para comprobar automáticamente los cambios publicados en GitHub. Esta ejecución todavía debe verificarse en la pestaña **Actions** de GitHub. El modo `DEMO_MODE=false` inicia un catálogo vacío y evita publicar contenido ilustrativo por accidente.

Consultar `docs/CHECKLIST_PRODUCCION.md` y `docs/GITHUB.md`.

## Gestión de equipo y QA

Los nuevos usuarios no existen hasta que el propietario los cree desde `/admin` → **Equipo**. Los técnicos solo acceden a sus propias órdenes en `/equipo`. El sistema no contrata ni asigna empleados por sí mismo. Pruebas reales: `docs/PRUEBAS_V03.md`.
