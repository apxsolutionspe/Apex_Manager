// Read-only, static public dashboard; no API keys, signing or wallet operations.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const results=document.querySelector('#results'),summary=document.querySelector('#summary'),meta=document.querySelector('#metadata');
let feed=null,mode='investigar';
const cards=(k,v)=>`<div class="triage-card"><small>${esc(k)}</small><div class="triage-value">${Number(v||0).toLocaleString('es-PE')}</div></div>`;
function paint(){
 const s=feed.summary;
 summary.innerHTML=cards('Analizadas',s.total_evaluated)+cards('Para investigar',s.investigar)+cards('Informativas',s.informativa)+cards('Descartadas',s.descartar);
 meta.textContent=`Actualización: ${new Date(feed.generated_at).toLocaleString('es-PE')} · Ingresos verificados: US$ 0 · Cobros comprobados: 0`;
 const filtered=feed.items.filter(x=>mode==='todas'||x.status===mode).slice(0,45);
 results.innerHTML=filtered.length?filtered.map(x=>{
  const url=(()=>{try{const u=new URL(String(x.url));return u.protocol==='https:'?u.href:null}catch{return null}})();
  return `<article class="triage-result"><div class="triage-links"><span class="triage-status">${esc(x.status)} · ${Number(x.priority)||0}/90</span><small>${esc(x.source||'fuente pública')} · ${esc(x.source_created_at?.slice(0,10)||'fecha no confirmada')}</small></div>
 <h3>${esc(x.title)}</h3><p>${(x.reasons||[]).map(esc).join(' · ')}</p><p class="triage-warn">Elegibilidad, condiciones de pago y titularidad: NO verificadas.</p>
 ${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Revisar publicación original ↗</a>`:''}</article>`;
 }).join(''):'<div class="empty">No hay oportunidades que cumplan esta clasificación en el período evaluado. El sistema no inventa ingresos.</div>';
}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
 mode=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(feed)paint();
}));
try{
 const resp=await fetch('./feed/prioritized.json',{cache:'no-store'});if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
 const data=await resp.json();if(data.schema!=='apex-prioritized-v1'||!data.summary||!Array.isArray(data.items))throw new Error('formato de datos incompatible');
 feed=data;paint();
}catch(e){summary.innerHTML='';results.textContent='El informe todavía no está disponible o ha fallado su actualización: '+String(e.message||e);}
