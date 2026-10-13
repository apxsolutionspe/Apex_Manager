# APEX Swarm · Validación y despliegue controlado

**Alcance:** solo el sitio estático `apex-global-intelligence-swarm/`. La tienda APEX_PRIME_X usa FastAPI y SQLite; GitHub Pages **no** puede alojar ese backend ni su base de datos.

## Evolución del bloqueo (13 de octubre de 2026)

1. El flujo de Pages fallaba originalmente en `actions/configure-pages@v5` (HTTP 404). Los tests JavaScript sí pasaban.
2. Otro commit en `main` habilitó el uso de Pages. **GitHub Actions confirmó una ejecución de despliegue exitosa**: https://github.com/apxsolutionspe/Apex_Manager/actions/runs/38430736538
3. El PR #7 se actualizó para conservar la configuración de despliegue **ya verificada como exitosa** y añadir un job de pruebas y un artefacto de vista previa.
4. La comprobación posterior a la fusión aún es necesaria: no basta con confiar en una ejecución histórica.

## Flujo automatizado

- En cada pull request que modifique APEX Swarm o este workflow: pruebas JavaScript y artefacto `apex-swarm-preview` durante 7 días, **sin despliegue**.
- En cada push a `main` que afecte a esos archivos o ejecución manual: las mismas pruebas; si pasan, se ejecuta la publicación del sitio estático mediante las acciones GitHub Pages configuradas. Los permisos elevados se conceden solo al job de despliegue.
- El workflow **no habilita Pages por API** y no requiere token personal. Para gestionar su visibilidad: https://github.com/apxsolutionspe/Apex_Manager/settings/pages
- Revisa las ejecuciones y sus artefactos: https://github.com/apxsolutionspe/Apex_Manager/actions/workflows/apex-swarm-pages.yml

## Criterios de aceptación

- [ ] CI del pull request exitosa en Python 3.12/3.13.
- [ ] Job de vista previa del pull request exitoso y paquete disponible.
- [ ] Pull request fusionado sin conflictos.
- [ ] CI de `main` exitosa con el SHA fusionado.
- [ ] Job de Pages posterior a la fusión exitoso, y URL pública verificada mediante HTTP(S).
- [ ] Las políticas de privacidad y controles de datos personales se revisan antes de usar datos de usuarios reales.

## Restricciones

El sitio APEX Swarm no es una tienda comercial ni un sistema de custodia financiera. No guardar credenciales privadas ni datos de clientes en artefactos o repositorios. La presencia de pruebas unitarias y una publicación exitosa **no equivale a una auditoría integral de seguridad**. El servicio no ejecuta procesamiento 24/7 automáticamente cuando el navegador está cerrado.
