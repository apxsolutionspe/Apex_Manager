// Intentionally no wallet signing, authentication, automatic claims or transaction requests.
const metrics=document.getElementById('metrics');
const results=document.getElementById('results');
const updated=document.getElementById('updated');
let data,filter='todas';
const metric=(caption,value)=>{const div=document.createElement('div');div.className='metric';const x=document.createElement('span');x.textContent=caption;const y=document.createElement('strong');y.textContent=String(value);div.append(x,y);return div};
const info=(label,value)=>{const d=document.createElement('div');d.className='info';const a=document.createElement('b'),b=document.createElement('span');a.textContent=label;b.textContent=value;d.append(a,b);return d};
function draw(){
 const all=data.opportunities||[];metrics.replaceChildren(metric('Campañas vigiladas',data.stats.monitored),metric('Fuentes oficiales consultadas',data.stats.checked_public_sources),metric('Billeteras elegibles verificadas',0),metric('Ingresos realmente cobrados','US$ 0'));
 const listed=all.filter(x=>filter==='todas'||x.status===filter);results.replaceChildren();
 for(const x of listed){const article=document.createElement('article');article.className='item';const pill=document.createElement('span');pill.className='pill'+(x.status==='plazo_finalizado'?' closed':'');pill.textContent=x.status==='plazo_finalizado'?'Plazo terminado':x.status==='plazo_por_confirmar'?'Cupo y vigencia por confirmar':x.status;const h=document.createElement('h2');h.textContent=x.title;article.append(pill,h);
 article.append(info('Beneficio anunciado',x.benefit_announced),info('Condiciones',x.eligibility),info('Intervención',x.next_step),info('Comprobación web',x.official_page_access||'sin datos'));
 if(x.history)article.append(info('Historial de fuente',String(x.history.source_matches)+' coincidencias de '+String(x.history.checked_runs)+' consultas; no equivale a ganancias.'));
 if(Number.isFinite(x.research_priority))article.append(info('Prioridad de revisión',String(x.research_priority)+'/50. '+String(x.research_reason||'')));
 const note=document.createElement('div');note.className='danger';note.textContent='Sin elegibilidad ni cobro verificado. No permite reclamo automático.';article.append(note);
 try{const u=new URL(x.source_url);if(u.protocol==='https:'&&['www.binance.com','binance.com'].includes(u.hostname)){const a=document.createElement('a');a.href=u.href;a.rel='noopener noreferrer';a.target='_blank';a.textContent='Ver bases oficiales ↗';article.append(a)}}catch{}
 results.append(article)}
 if(!listed.length){const d=document.createElement('div');d.className='empty';d.textContent='No hay campañas en este estado. No se simulan recompensas.';results.append(d)}
 updated.textContent='Última exploración en la nube: '+new Date(data.generated_at).toLocaleString('es-PE')+
  '. Historial de consultas: '+String(data.research_history?.runs?.length||0)+
  '. Consultas periódicas, no un proceso ininterrumpido ni ganancias garantizadas.';
}
for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{filter=b.dataset.filter;for(const c of document.querySelectorAll('[data-filter]'))c.setAttribute('aria-pressed',String(c===b));if(data)draw()});
// Prefer the hourly GitHub data; use Pages snapshot when the raw endpoint is unavailable.
let error=null;
for(const url of [
 'https://raw.githubusercontent.com/apxsolutionspe/Apex_Manager/main/apex-global-intelligence-swarm/feed/crypto.json',
 './feed/crypto.json'
]){
 try{
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
  const json=await r.json();if(json.schema!=='apex-crypto-watch-v1'||!Array.isArray(json.opportunities)||json.economics?.verified_income_usd!==0)throw Error('Datos públicos no válidos');
  data=json;draw();error=null;break;
 }catch(e){error=e}
}
if(error){results.textContent='La consulta pública aún no está disponible: '+String(error.message||error);metrics.replaceChildren(metric('Estado','sin información'))}

function drawDiscovery(d){
 const container=document.getElementById('discovery');
 const metrics=document.getElementById('discovery-metrics');
 const updated=document.getElementById('discovery-updated');
 if(!container||!metrics||!updated)return;
 const list=Array.isArray(d.opportunities)?d.opportunities.slice(0,50):[];
 metrics.replaceChildren(
  metric('Fuentes oficiales bajo seguimiento',d.stats.official_pages_checked),
  metric('Páginas accesibles',d.stats.pages_read),
  metric('Anuncios sin derecho de cobro comprobado',list.length),
  metric('Recompensas gratuitas confirmadas','0')
 );
 const allowed=new Set(['www.binance.com','www.coinbase.com','blog.kraken.com','www.okx.com',
  'blog.uniswap.org','aave.com','optimism.io','gov.uniswap.org','gov.optimism.io']);
 const descriptions={
  security_warning:'Señal de seguridad: no conectar billetera ni compartir secretos.',
  requires_capital_or_activity_review:'Puede exigir dinero, operaciones o activos: no es una recompensa gratuita comprobada.',
  manual_action_or_conditions:'Puede exigir solicitud, concurso, verificación o participación personal.',
  eligibility_not_verified:'Anuncio informativo: elegibilidad y gratuidad pendientes de confirmar.'
 };
 const nowYear=new Date().getUTCFullYear();
 const historic=x=>{
  const years=String(x.title).match(/\b20\d{2}\b/g)||[];
  return years.some(y=>Number(y)<nowYear);
 };
 list.sort((a,b)=>Number(b.review_priority||0)-Number(a.review_priority||0) || Number(historic(a))-Number(historic(b)));
 container.replaceChildren();
 for(const x of list){
  const article=document.createElement('article');article.className='item';
  const state=document.createElement('span');state.className='pill'+(historic(x)?' closed':'');
  state.textContent=historic(x)?'Referencia con año anterior':'Anuncio sin vigencia comprobada';
  const heading=document.createElement('h2');heading.textContent=String(x.title).slice(0,180);
  article.append(state,heading);
  article.append(info('Origen',String(x.source)),
   info('Categoría',String(x.review_group||'investigación pendiente')),
   info('Control de riesgo',descriptions[x.screening]||'Evaluación pendiente'),
   info('Evaluación',String(x.review_reason||'Sin elegibilidad ni importe acreditado confirmado')));
  const note=document.createElement('div');note.className='danger';note.textContent='No hay derecho de cobro confirmado. No existe transferencia automática.';
  article.append(note);
  try{
   const url=new URL(x.url);
   if(url.protocol==='https:'&&allowed.has(url.hostname)&&x.screening!=='security_warning'){
    const link=document.createElement('a');link.href=url.href;link.rel='noopener noreferrer';link.target='_blank';
    link.textContent='Consultar anuncio en su origen ↗';article.append(link);
   }
  }catch{}
  container.append(article);
 }
 if(!list.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No se identificaron anuncios aptos para investigación en la última exploración. Ningún activo fue cobrado.';container.append(empty)}
 updated.textContent='Última actualización: '+new Date(d.generated_at).toLocaleString('es-PE')+
  '. Nuevos anuncios observados: '+String(d.stats.new_candidate_count||0)+'. Ninguna oportunidad se considera cobrable sin verificación. No incluye datos de tu billetera.';
}
for(const url of [
 'https://raw.githubusercontent.com/apxsolutionspe/Apex_Manager/main/apex-global-intelligence-swarm/feed/crypto-discovery.json',
 './feed/crypto-discovery.json'
]){
 try{
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Error HTTP '+r.status);
  const d=await r.json();
  if(d.schema!=='apex-crypto-discovery-v1'||!Array.isArray(d.opportunities)||
     d.stats?.confirmed_eligible!==0||d.stats?.verified_deposits!==0)throw Error('Informe incompatible');
  drawDiscovery(d);break;
 }catch(e){
  document.getElementById('discovery').textContent='La exploración DeFi no está disponible ahora. Ningún resultado fue asumido.';
 }
}


async function loadConditionalLeads(){
 const container=document.getElementById('conditional-leads');
 if(!container)return;
 for(const uri of [
  'https://raw.githubusercontent.com/apxsolutionspe/Apex_Manager/main/apex-global-intelligence-swarm/feed/crypto-direct-leads.json',
  './feed/crypto-direct-leads.json'
 ]){
  try{
   const response=await fetch(uri,{cache:'no-store'});
   if(!response.ok)throw Error('status');
   const report=await response.json();
   if(report.schema!=='apex-direct-crypto-leads-v1'||report.summary?.verified_income_usd!==0||
    report.summary?.received_tokens!==0||!Array.isArray(report.data))throw Error('incompatible report');
   container.replaceChildren();
   for(const entry of report.data.slice(0,8)){
    const panel=document.createElement('article');panel.className='item';
    const header=document.createElement('h2');header.textContent=String(entry.title);
    const pill=document.createElement('span');pill.className='pill';
    pill.textContent='Elegibilidad personal y cupo sin verificar';
    panel.append(pill,header);
    panel.append(info('Anuncio',String(entry.announced_reward)),
     info('Condiciones',Array.isArray(entry.conditions)?entry.conditions.join(' · '):'Por confirmar'),
     info('Acreditación',String(entry.reward_location)),
     info('Situación','No cobrada; no permite reclamar automáticamente'));
    try{
     const official=new URL(entry.official_url);
     if(official.hostname==='www.binance.com'&&official.protocol==='https:'){
      const link=document.createElement('a');link.href=official.href;link.rel='noopener noreferrer';
      link.target='_blank';link.textContent='Consultar bases en Binance ↗';panel.append(link);
     }
    }catch{}
    container.append(panel);
   }
   if(!report.data.length){container.textContent='No se dispone de anuncios oficiales con condiciones documentadas.';}
   return;
  }catch{}
 }
 container.textContent='El seguimiento de condiciones oficiales no está disponible actualmente.';
}
await loadConditionalLeads();
