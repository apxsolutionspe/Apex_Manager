# Preparación de despliegue — nunca desplegar sin autorización

## Paso 1 · Completar datos aprobados

- Nombre comercial, RUC si corresponde, contacto, horario y zonas atendidas.
- WhatsApp autorizado, URL definitiva de aviso de privacidad, formulario de consentimiento y plazo de conservación.
- Precios reales, catálogo real y control de stock; no usar valores DEMO como oferta.

## Paso 2 · Infraestructura con costes conocidos

- Seleccionar servidor/hosting con almacenamiento persistente. **Los servicios gratuitos efímeros pueden borrar SQLite al reiniciar**.
- Configurar HTTPS, dominio, nombre de host confiable, roles y secretos *fuera* de Git.
- Crear backups diarios fuera del mismo disco o servidor y probar restauración. Las plantillas systemd incluidas no están activadas.
- Restringir API de administración, revisar MFA, limitación distribuida y monitoreo.

## Paso 3 · Preparación y pruebas

- Poner `DEMO_MODE=false`, `PRIVACY_NOTICE_URL=https://...` (URL real), `SESSION_SECRET` largo, `ADMIN_PASSWORD_HASH` válido y WhatsApp si procede.
- Revisar `/api/readiness`; 200 significa **configuración base presente**, no auditoría completa.
- Cargar catálogo real desde administración y verificar una cotización sintética con consentimiento.
- Ejecutar pruebas Python, navegadores en Actions y control de acceso en dispositivo real.
- Obtener aprobación explícita para desplegar y exponer datos de clientes.

## Comandos de backup manual

```sh
python scripts/backup_sqlite.py --db ./data/apex.db --out ./backups
```

Los archivos backup pueden contener nombres, teléfonos y contenido de cotizaciones: cifrarlos y restringir lectura, definir retención, comprobar restauración fuera del entorno principal. **No subir backups ni `.env` a GitHub**.

Las unidades `deploy/apex-backup.service` y `deploy/apex-backup.timer` son *ejemplos de operación* para un servidor Linux ubicado en `/srv/apex-prime-x` con usuario `apex`. Deben adaptarse, auditarse y habilitarse manualmente en el servidor real. No activan backup al publicar en GitHub.
