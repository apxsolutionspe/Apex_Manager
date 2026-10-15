# APEX PRIME X — continuidad entre conversaciones

**Objetivo:** mantener y ampliar un radar público de oportunidades cripto y DeFi, evaluar condiciones legales y vigilar depósitos de la billetera propia sin custodia. Sin usar fondos iniciales obligatorios, sin entregar claves, sin manipulación de fondos ajenos.

## Dónde está el proyecto

- Repositorio GitHub: https://github.com/apxsolutionspe/Apex_Manager
- Panel de investigación: https://apxsolutionspe.github.io/Apex_Manager/crypto.html
- Observador de MetaMask: https://apxsolutionspe.github.io/Apex_Manager/wallet.html
- Workflow horario: `.github/workflows/apex-crypto-hourly.yml`
- Código de investigación: `apex-global-intelligence-swarm/scripts/crypto-discovery.mjs`
- Clasificador nativo Rust: `apex-global-intelligence-swarm/native/crypto_classifier.rs`
- Monitor privado Ethereum y ERC-20: `apex-global-intelligence-swarm/scripts/private-wallet-observer.mjs` y `scripts/erc20-watch.mjs`
- Reportes públicos: `feed/crypto.json`, `feed/crypto-discovery.json`, `feed/crypto-direct-leads.json`, `feed/crypto-health.json`

## Estado y hechos verificables

- El flujo GitHub Actions está configurado con cron `23 * * * *`, aproximado cada hora. GitHub puede retrasar u omitir alguna ejecución. No es un proceso ininterrumpido.
- La investigación revisa actualmente 24 fuentes oficiales y trabaja con concurrencia acotada de 4 consultas. El porcentaje accesible varía.
- El reporte público no demuestra elegibilidad real de ninguna billetera. Un anuncio de recompensa no es dinero cobrado.
- El secreto de GitHub Actions `APEX_WALLET_ADDRESS` fue configurado por su propietario. **NUNCA** poner dirección, frase semilla o claves privadas en este archivo, logs o feeds públicos.
- El monitor consulta saldos ETH y eventos de entrada de contratos ERC-20 permitidos en Ethereum (USDC, USDT, DAI, LINK, UNI). No firma ni envía transacciones.
- No existe registro privado permanente y auditado de depósitos entre ejecuciones, ni reclamación autónoma de tokens, ni pago automático verificado.
- Ingresos o recompensas **verificados por APEX** en el último estado confirmado: **US$ 0**. Comprobar el dato nuevamente en cada sesión.
- Un cupón Binance limitado a cuentas recién creadas fue retirado de los candidatos activos; no permitir registros múltiples automatizados para eludir requisitos.
- Actualmente no hay evidencias de que APEX haya generado fondos, transferido criptomonedas o reclamado recompensas.

## Continuidad sin perder el estado\n\n- Página de continuación con mensaje copiable y estado público actualizado: https://apxsolutionspe.github.io/Apex_Manager/continuar.html\n- Resumen público generado automáticamente por la vigilancia horaria: https://github.com/apxsolutionspe/Apex_Manager/blob/main/apex-global-intelligence-swarm/feed/apex-handoff.json\n- El límite de longitud de los chats de ChatGPT es de la plataforma y **no puede desactivarse desde APEX**; usa un nuevo chat en el proyecto con el mensaje copiado.\n- El resumen excluye direcciones, cantidades en la billetera, claves y datos personales. No garantiza ingresos ni detecta pagos verificados.\n\n## Cómo continuar en otro chat

1. Abre un chat nuevo en el mismo proyecto.
2. Proporciona la URL de este documento y el repositorio, y pide que verifique **primero** la última ejecución de GitHub Actions y los tres reportes públicos.
3. Pide mejoras concretas en fases; antes de dar por hecha una modificación, exigir CI exitoso y pruebas.
4. Nunca divulgar secretos, aprobar firmas o gastos de la billetera, ni contabilizar como ingresos los anuncios publicados.

Texto sugerido para pegar en el chat nuevo:

> Continúa APEX PRIME X desde https://github.com/apxsolutionspe/Apex_Manager/blob/main/APEX_CONTINUIDAD.md. Revisa el último GitHub Actions y los reportes de feed, continúa tareas técnicas pendientes, corre pruebas y corrige fallos. Objetivo: investigación autónoma de recompensas cripto legítimas sin inversión, clasificación antifraude y supervisión privada de MetaMask. No afirmes ganancias hasta comprobar depósitos o pagos reales y autorizados. No uses claves ni transacciones.

## Próximas fases pendientes

1. **Validar fuentes:** monitor de salud e incidencias, distinguir bloqueo 403/502, HTML excesivo y página accesible sin candidatos.
2. **Mejorar calidad:** limitar falsos positivos, fechas obsoletas, costes de gas, KYC regional y trabajos que no sean recompensa pasiva.
3. **Vigilancia privada longitudinal:** usar almacenamiento cifrado, con clave que controle el propietario; no subir registros personales al repositorio público.
4. **Alertas sin exposición:** notificar solo incidencias verificadas y sin publicar datos de cuentas.
5. **Ingresos reales:** documentar condiciones del emisor, comprobar que el beneficiario puede reclamar y verificar pago oficial; toda acción con firma o gasto exige aprobación del titular.

**Seguridad:** una billetera ajena inactiva, extraviada o supuestamente sin propietario no permite apropiarse legalmente de sus fondos. No operar malware, scraping abusivo, minería con GitHub Actions ni transferencias sin autorización.
