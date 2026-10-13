const $ = q => document.querySelector(q);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let accessToken = '';
let currentRole = '';
const jobStates = {pendiente:'Pendiente',en_proceso:'En proceso',finalizado:'Finalizado',cancelado:'Cancelado'};
const quoteStates = {nuevo:'Nuevo',contactado:'Contactado',cotizado:'Cotizado',aprobado:'Aprobado',rechazado:'Rechazado'};
async function api(path,options={}){
  const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(accessToken?{'Authorization':`Bearer ${accessToken}`}:{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){if(response.status===401 && !path.endsWith('/login')) logout();throw new Error(typeof data.detail==='string'?data.detail:'No se completó la operación');}
  return data;
}
function logout(){accessToken='';currentRole='';$('#team-workspace').hidden=true;$('#team-login').hidden=false;$('#team-login-form').reset();}
$('#team-logout').addEventListener('click',logout);
$('#team-login-form').addEventListener('submit',async e=>{
  e.preventDefault();$('#team-login-error').hidden=true;
  const form=e.currentTarget;const b=form.querySelector('button');b.disabled=true;
  try{
    const info=await api('/api/team/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    accessToken=info.access_token;currentRole=info.role;form.reset();
    $('#team-welcome').textContent=`Hola, ${info.name}`;
    $('#team-role').textContent=info.role==='tecnico'?'Servicio técnico · Órdenes asignadas':'Equipo comercial · Cotizaciones recientes';
    $('#team-login').hidden=true;$('#team-workspace').hidden=false;await loadWork();
  }catch(ex){$('#team-login-error').textContent=ex.message;$('#team-login-error').hidden=false;}finally{b.disabled=false;}
});
$('#team-refresh').addEventListener('click',loadWork);
async function loadWork(){
  $('#team-alert').hidden=true;
  try{
    const data=await api('/api/team/work');
    const isTech=data.type==='jobs';
    $('#team-work-list').innerHTML=data.records.length?data.records.map(x=>{
      const states=isTech?jobStates:quoteStates;
      const options=Object.entries(states).map(([key,label])=>`<option value="${key}" ${x.status===key?'selected':''} ${!isTech&&key==='nuevo'?'disabled':''}>${esc(label)}</option>`).join('');
      return `<article class="work-card"><small>${esc(x.code)} · ${esc(x.created_at)}</small><strong>${esc(isTech?x.title:x.customer_name)}</strong><p>${esc(isTech?x.customer_name:x.phone)}${isTech?` · ${esc(x.contact)}`:''}</p>${isTech&&x.notes?`<p>${esc(x.notes)}</p>`:''}<div class="work-controls"><label>Estado <select data-record-id="${x.id}" data-kind="${isTech?'job':'quote'}">${options}</select></label><button class="btn btn-primary small" data-save-id="${x.id}" data-kind="${isTech?'job':'quote'}" type="button">Guardar estado</button></div></article>`;
    }).join(''):'<div class="work-card"><strong>Sin tareas pendientes.</strong><p>Actualiza la lista cuando recibas una nueva asignación.</p></div>';
  }catch(ex){$('#team-alert').textContent=ex.message;$('#team-alert').hidden=false;}
}
$('#team-work-list').addEventListener('click',async e=>{
  const b=e.target.closest('[data-save-id]');if(!b)return;
  const item=b.closest('.work-card');const select=item.querySelector('select');const id=Number(b.dataset.saveId);const kind=b.dataset.kind;
  b.disabled=true;
  try{
    await api(kind==='job'?`/api/team/jobs/${id}`:`/api/team/quotes/${id}/status`,{method:'PATCH',body:JSON.stringify({status:select.value})});
    await loadWork();
  }catch(ex){$('#team-alert').textContent=ex.message;$('#team-alert').hidden=false;}finally{b.disabled=false;}
});
