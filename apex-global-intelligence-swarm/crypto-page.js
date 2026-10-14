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
