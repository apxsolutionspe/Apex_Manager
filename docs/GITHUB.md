# GitHub y flujo de colaboración

El repositorio contiene **código fuente**, no una tienda comercial en producción.

## Estrategia

- Rama principal: `main` como versión revisada.
- Cambios futuros: `feature/<nombre>` + pull request.
- CI en cada push/PR: pytest, `compileall` y comprobaciones JavaScript.
- Mantener `.env`, `data/`, claves privadas y archivos de clientes fuera de Git.
- No activar GitHub Pages para este backend FastAPI: Pages solo sirve contenido estático.
- Antes de desplegar: completar `docs/CHECKLIST_PRODUCCION.md` y obtener aprobación.

## Pruebas locales

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
node --check frontend/app.js
node --check frontend/admin.js
```
