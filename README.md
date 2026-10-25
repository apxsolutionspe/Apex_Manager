# APEX_PRIME_X · Plataforma comercial

## Productos digitales públicos · APEX PRIME X

APEX ofrece **dos herramientas gratuitas y funcionales** desarrolladas en HTML/JavaScript, además de servicios profesionales personalizados bajo presupuesto. **No requieren inversión, registro ni pago para probarlas.**

- [**CotizaPro** — preparar cotizaciones, materiales, horas e importes en soles](https://apxsolutionspe.github.io/Apex_Manager/productos/cotizapro/)
- [**CatálogoExpress** — crear y descargar un catálogo con carrito y pedidos iniciados por WhatsApp](https://apxsolutionspe.github.io/Apex_Manager/productos/catalogoexpress/)
- [**Solicitar soluciones tecnológicas y personalización a APEX PRIME X**](https://apxsolutionspe.github.io/Apex_Manager/servicios.html)
- [**Escribir por WhatsApp al contacto comercial publicado de APEX**](https://wa.me/51931797758?text=Hola%20APEX%20PRIME%20X%2C%20quisiera%20cotizar%20un%20proyecto%20digital.)

Estas son herramientas web estáticas, distintas de la API y del panel administrativo local descritos a continuación. **No existe una pasarela de cobro integrada ni clientes/pagos garantizados**. Los importes de ejemplo de las demos no son tarifas comerciales de APEX.

---

**Versión:** `0.2.0` · **Estado:** prototipo funcional local / **NO DESPLEGADO PARA CLIENTES** · **Idioma:** español · **Moneda:** soles (PEN).

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

En sistemas POSIX, una base **nueva** se crea con permisos `0600` y su directorio final nuevo con `0700` para proteger los contactos almacenados. Por seguridad, el programa **no modifica los permisos de bases ni directorios preexistentes**: antes de usar datos reales, el operador debe verificar manualmente sus permisos y los de cualquier carpeta compartida. En Windows, revisar las ACL del directorio.

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

1. **Identidad:** un solo administrador, sin 2FA ni gestión de múltiples usuarios. Incorporar autenticación gestionada, roles, recuperación, eventos de auditoría y rotación/revocación de sesiones.
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

## V0.3: protección de datos, auditoría y continuidad (rama de revisión)

**Esta versión está preparada para revisión técnica y no habilita clientes reales por sí sola.**

- `QUOTE_INTAKE_ENABLED=false` por defecto: el formulario de registro aparece deshabilitado mientras se prepara el lanzamiento. Para pruebas sintéticas locales puede usarse `QUOTE_INTAKE_ENABLED=true` con `APP_ENV=development` y base de datos de prueba.
- Se exige `consent: true` explícito para registrar cualquier cotización. Se conserva `consent_at` y `privacy_notice_version` junto al registro. Las cotizaciones anteriores siguen existiendo mediante una migración SQLite no destructiva; su consentimiento anterior no se presupone.
- `/privacidad` muestra un **borrador no aprobado** en pruebas. En producción, debe configurarse la URL HTTPS de una política publicada y aprobada (`PRIVACY_POLICY_URL`) y su versión (`PRIVACY_NOTICE_VERSION`).
- Con `APP_ENV=production`, `/api/ready` comprueba credenciales administrativas, catálogo real sin DEMO, número WhatsApp, salida de DEMO, recepción autorizada y aprobación de privacidad. Mientras falte alguna comprobación, la API **rechaza** la creación de cotizaciones con `503`.
- `admin_audit` guarda la acción, entidad, identificador y cambio de estado, **sin copiar** notas, correos ni teléfonos. En el panel aparece la pestaña **Auditoría**. En una expansión multiusuario deberán añadirse identidades individuales y almacenamiento inmutable.
- `scripts/backup_sqlite.py` realiza un respaldo consistente con el mecanismo de backup de SQLite y verifica una restauración en memoria con `PRAGMA integrity_check`. No guarda claves en el backup; **el archivo sí contiene datos personales** y debe cifrarse y almacenarse fuera del repositorio.

### Respaldo verificado y recuperación

```bash
# Desde el directorio del proyecto, con una base existente
python scripts/backup_sqlite.py create --db ./data/apex.db --directory ./backups
python scripts/backup_sqlite.py verify --file ./backups/NOMBRE_DEL_RESPALDO.sqlite3
```

El script genera nombres únicos y crea archivos privados (600) en un directorio privado (700). Si el directorio ya existe con permisos de grupo u otros usuarios, **rechaza el respaldo sin cambiar sus permisos**: crea uno nuevo o ajusta explícitamente los permisos a 700. Nunca apuntes `--directory` a un directorio compartido como `/tmp`. **No automatiza ni prueba la restauración destructiva de la base activa**; para recuperación real se requiere parar la API, conservar copia de la base original, validar el backup elegido y ejecutar un plan supervisado. Configurar una tarea programada de respaldo solo después de elegir alojamiento persistente y almacenamiento externo cifrado.

### Activación comercial (solo después de la aprobación)

```env
APP_ENV=production
DEMO_MODE=false
QUOTE_INTAKE_ENABLED=true
PRIVACY_NOTICE_APPROVED=true
PRIVACY_POLICY_URL=https://URL-APROBADA-DE-TU-NEGOCIO/politica-de-privacidad
PRIVACY_NOTICE_VERSION=VERSION_APROBADA
WHATSAPP_NUMBER=51XXXXXXXXX
ADMIN_PASSWORD_HASH=HASH_PBKDF2_REAL
SESSION_SECRET=SECRETO_LARGO_ALEATORIO
```

Todos los valores anteriores son **marcadores**, no credenciales o URLs reales. Requiere catálogo verificado y consentimiento legal del propietario. Comprueba `/api/ready`: HTTP `200` significa que el servicio pasó **estas comprobaciones de configuración**, no una auditoría legal, de infraestructura ni ciberseguridad.

### Ejecución de pruebas

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
node --check frontend/app.js
node --check frontend/admin.js
# E2E automatizada en GitHub Actions: .github/workflows/qa-store-browser.yml
```

La E2E utiliza únicamente datos ficticios contra un servidor local de prueba y guarda capturas en el artefacto de CI. Si Chromium no puede navegar por restricciones del entorno, no se declara la E2E como aprobada hasta revisar su ejecución real en Actions.
