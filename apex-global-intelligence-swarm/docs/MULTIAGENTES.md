# APEX Multiagentes v1 — operación controlada

Extensión de APEX Global Intelligence Swarm con trabajadores concurrentes de investigación. No tiene capacidad de autorreplicación, movimiento de fondos o registro masivo de cuentas.

## Siete funciones coordinadas

1. code-bounties: examina incidencias abiertas etiquetadas como recompensas.
2. micro-fixes: examina fallos pequeños posiblemente remunerados.
3. docs-bounties: examina trabajos pagados de documentación.
4. crypto-watch: lee el feed existente de recompensas sin operar con cripto.
5. commercial-outreach: referencia la automatización independiente de Metricool; no inicia sesión ni envía mensajes desde GitHub.
6. payment-auditor: marca los ingresos como no verificados sin recibos de cobro.
7. risk-verifier: deduplica los resultados y los filtra sin asegurar que un patrocinador tenga fondos.

Los tres rastreadores hacen un máximo de tres búsquedas GitHub API por ejecución, concurrentemente. La frecuencia nominal es de seis horas, con variaciones según GitHub Actions.

## Evidencia y seguridad

- Cada ejecución almacena artifacts/multiagent-report.json como artefacto GitHub Actions durante 14 días; no escribe información en main.
- advertised_usd_unverified indica una cifra publicada por terceros, jamás saldo propio.
- verified_new_income_usd = null significa que no se dispone de una prueba de pago en esa ejecución.
- No se ejecutan inversiones, firmas de billetera, depósitos, reclamaciones automáticas, minería ni mensajes masivos.
- El sistema no trata textos externos como instrucciones, ni presenta las oportunidades como derechos de cobro.
- Solo cuenta como trabajo comercial aceptado el que confirme expresamente el cliente o el patrocinador.

## Verificación

En apex-global-intelligence-swarm:

    node --check scripts/multiagent-scout.mjs
    node --test tests/multiagent-scout.test.mjs
    node scripts/multiagent-scout.mjs

El workflow .github/workflows/apex-multiagent.yml valida el código en pull requests y ejecuta la investigación pública en main por cron o activación manual.

## Próximas mejoras

- Integrar oportunidades y pagos de fuentes que dispongan de autorización y APIs oficiales.
- Añadir verificaciones de patrocinadores, términos y elegibilidad geográfica.
- No ampliar la frecuencia ni los agentes sin cuotas y pruebas de estabilidad.
- Mantener separados el escaneo cripto existente y la investigación de trabajos por código.
