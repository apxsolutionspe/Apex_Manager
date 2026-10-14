// APEX — public, read-only crypto reward research. Never claims assets or signs transactions.
export const CAMPAIGNS=Object.freeze([
  {id:'binance-learn-btc-2026-10',title:'Binance Academy: Bitcoin Learn & Earn (octubre 2026)',provider:'Binance',
   url:'https://www.binance.com/en/support/announcement/detail/5fc0f803346b4b5085b0e1c5d16d8b2c',
   starts:'2026-10-01T00:00:00Z',ends:null,kind:'aprendizaje',
   eligibility:'Solo usuarios nuevos registrados después del 1 de octubre de 2026; KYC; quiz; 5.000 cupos mensuales.',
   benefit:'Vale de 0,00001 BTC para cada usuario que cumpla todas las condiciones, sujeto a disponibilidad.',
   action:'Participación personal necesaria; no se pueden crear cuentas automáticas ni responder cuestionarios mediante bots.',
   checkText:['Bitcoin','0.00001 BTC','2026-10-01'],requires_prior_assets:false,requires_human_action:true,requires_kyc:true,limited_supply:true},
  {id:'binance-wotd-2026-10-12',title:'Binance Word of the Day — octubre 12–18',provider:'Binance',
   url:'https://www.binance.com/en-TR/support/announcement/detail/68a378b9faae45d9972fc2b223eaa22c',
   starts:'2026-10-12T00:00:00Z',ends:'2026-10-18T23:59:00Z',kind:'educacion',
   eligibility:'Se requieren respuestas correctas y cuenta elegible; la recompensa básica se separa de la categoría adicional que exige operar USD 50.',
   benefit:'Participación eventual en un fondo compartido de USDC, sin importe individual garantizado.',
   action:'Requiere participación personal, condiciones de jurisdicción y posible KYC; el bot no juega ni opera.',
   checkText:['Word of the Day','2026-10-18','USDC'],requires_prior_assets:false,requires_human_action:true,requires_kyc:true,limited_supply:true},
  {id:'binance-community-2026-10',title:'Binance Community Voice — opiniones sobre IA',provider:'Binance',
   url:'https://www.binance.com/en/support/announcement/detail/8fd1fe0094b34442b322c177894666bf',
   starts:'2026-10-12T12:00:00Z',ends:'2026-10-18T23:59:00Z',kind:'concurso',
   eligibility:'Cuenta verificada, publicación auténtica en X y participación en Discord; 25 ganadores seleccionados, restricciones geográficas.',
   benefit:'20 USDC por ganador seleccionado, no reparto automático entre todos los participantes.',
   action:'Requiere trabajo individual real y elección del organizador; no spam ni cuentas falsas.',
   checkText:['Community Voice','500 USDC','2026-10-18'],requires_prior_assets:false,requires_human_action:true,requires_kyc:true,limited_supply:true}
]);
const ALLOWED_HOSTS=new Set(['www.binance.com','binance.com']);
export function allowedCampaignUrl(raw){try{const u=new URL(raw);return u.protocol==='https:' && ALLOWED_HOSTS.has(u.hostname) && !u.username && !u.password && /^\/(?:en|en-TR)\/support\/announcement\/detail\/[a-f0-9]{32}$/.test(u.pathname)}catch{return false}}
export function publicCampaignView(c,now=new Date()){
  if(!allowedCampaignUrl(c.url)) throw Error('Fuente fuera de la lista oficial permitida');
  const t=now.getTime(); if(!Number.isFinite(t))throw Error('Fecha no válida');
  const starts=Date.parse(c.starts), ends=c.ends?Date.parse(c.ends):null;
  const status=t<starts?'programada':(ends!==null&&t>ends?'plazo_finalizado':'plazo_por_confirmar');
  return {id:c.id,title:c.title,provider:c.provider,source_url:c.url,kind:c.kind,observed_at:now.toISOString(),
    status,eligibility:c.eligibility,benefit_announced:c.benefit,next_step:c.action,
    requires_prior_assets:c.requires_prior_assets,requires_human_action:c.requires_human_action,
    requires_kyc:c.requires_kyc,limited_supply:c.limited_supply,
    official_page_access:'no_comprobado',possible_reward_not_guaranteed:true,
    eligible_wallet_verified:false,amount_received_verified:0,automatic_claim_possible:false};
}
export function validateRadar(x){return x?.schema==='apex-crypto-watch-v1'&&Array.isArray(x.opportunities)&&x.economics?.verified_income_usd===0}
export function makeRadar(records,now=new Date()){
  const opportunities=records.map(x=>({...publicCampaignView(x,now)}));
  return {schema:'apex-crypto-watch-v1',generated_at:now.toISOString(),mode:'solo_investigacion_publica',
    statement:'No se reclaman activos perdidos o ajenos. Las oportunidades no son titularidad ni dinero cobrado.',
    economics:{verified_income_usd:0,verified_withdrawals:0,verified_tokens_received:0},
    stats:{monitored:opportunities.length,closed_by_date:opportunities.filter(x=>x.status==='plazo_finalizado').length,eligible_wallets_verified:0},opportunities};
}
