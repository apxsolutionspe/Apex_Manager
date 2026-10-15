const ref='https://github.com/apxsolutionspe/Apex_Manager/blob/main/APEX_CONTINUIDAD.md';
const stateRef='https://github.com/apxsolutionspe/Apex_Manager/blob/main/apex-global-intelligence-swarm/feed/apex-handoff.json';
const prompt='Continúa APEX PRIME X desde '+ref+'. Revisa también '+stateRef+' y la última ejecución de GitHub Actions. Sigue las fases pendientes sin empezar de cero, comprueba pruebas/CI y distingue anuncios de ganancias realmente verificadas. Mantén MetaMask en modo solo lectura; no publiques direcciones o secretos ni autorices firmas, pagos o transferencias.';
const area=document.getElementById('handoff');
area.value=prompt;
document.getElementById('copy').addEventListener('click',async()=>{
 const status=document.getElementById('copy-status');
 try{await navigator.clipboard.writeText(area.value);status.textContent='Instrucciones copiadas. Abre el chat nuevo en APEX_PRIME_X y pega el texto.';}
 catch{area.focus();area.select();status.textContent='Seleccioné el texto. Pulsa Ctrl+C (o Copiar) y pégalo en el chat nuevo.';}
});
const metrics=document.getElementById('metrics'),stamp=document.getElementById('timestamp');
const add=(name,value)=>{const box=document.createElement('div');box.className='metric';const span=document.createElement('span');span.textContent=name;const strong=document.createElement('strong');strong.textContent=String(value);box.append(span,strong);metrics.append(box)};
(async()=>{
 for(const url of [
  'https://raw.githubusercontent.com/apxsolutionspe/Apex_Manager/main/apex-global-intelligence-swarm/feed/apex-handoff.json',
  './feed/apex-handoff.json'
 ]){
  try{
   const r=await fetch(url,{cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const d=await r.json();
   if(d.schema!=='apex-project-handoff-v1'||d.state?.verified_income_usd!==0)throw Error('Informe inválido');
   metrics.replaceChildren();
   add('Fuentes vigiladas',d.state.sources_configured);
   add('Fuentes accesibles',d.state.sources_read);
   add('Anuncios por revisar',d.state.announcements_for_review);
   add('Ganancias confirmadas','US$ 0');
   const at=new Date(d.research_observed_at);
   stamp.textContent='Último rastreo público registrado: '+(Number.isNaN(at.getTime())?'fecha no disponible':at.toLocaleString('es-PE'))+'. Las solicitudes reales de la billetera no se publican.';
   return;
  }catch{}
 }
 metrics.replaceChildren();add('Resumen automático','No disponible');
 stamp.textContent='Usa la guía permanente y verifica los últimos resultados de GitHub Actions; ninguna ganancia fue supuesta.';
})();