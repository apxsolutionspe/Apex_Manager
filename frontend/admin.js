const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => v == null ? 'A cotizar' : new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(v/100);
const fmt = v => v ? new Date(v.replace(' ', 'T')+'Z').toLocaleString('es-PE',{dateStyle:'medium',timeStyle:'short'}) : '—';
let token = ''; // Únicamente en memoria: nunca localStorage, cookies JS ni URL.
let products = [];
const statelabel = {nuevo:'Nuevo', contactado:'Contactado', cotizado:'Cotizado', aprobado:'Aprobado', rechazado:'Rechazado', pendiente:'Pendiente', en_proceso:'En proceso', finalizado:'Finalizado', cancelado:'Cancelado'};
const quoteStates = ['nuevo','contactado','cotizado','aprobado','rechazado'];
const jobStates = ['pendiente','en_proceso','finalizado','cancelado'];
const toast = msg => {$('#admin-toast').textContent=msg; $('#admin-toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(()=>$('#admin-toast').classList.remove('show'),3500);};
const request = async (path, options={})=>{
  const response = await fetch(path, {headers:{'Content-Type':'application/json', ...(token ? {'Authorization':`Bearer ${token}`} : {})}, ...options});
  const data = await response.json().catch(()=>({}));
  if (response.status===401 && !path.endsWith('/login')) { logout(); throw new Error('Sesión expirada. Accede nuevamente.'); }
  if (!response.ok) throw new Error(typeof data.detail==='string'?data.detail:'La operación no pudo completarse.');
  return data;
};
function logout(){token=''; $('#admin-shell').hidden=true; $('#login-screen').hidden=false; $('#admin-password').value='';}
function notifyError(e){toast(e.message || 'Ha ocurrido un error.');}
$('#logout').addEventListener('click', logout);
$('#login-form').addEventListener('submit', async e=>{
  e.preventDefault(); $('#login-error').hidden=true;
  const button = $('#login-button'); button.disabled=true; button.textContent='Verificando...';
  try {const data=await request('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#admin-password').value})});token=data.access_token;$('#admin-password').value='';$('#login-screen').hidden=true;$('#admin-shell').hidden=false;await openTab('resumen');}
  catch(err){$('#login-error').textContent=err.message;$('#login-error').hidden=false;}
  finally{button.disabled=false;button.textContent='Ingresar al panel →';}
});
const tabTitles={resumen:'Panel general',cotizaciones:'Cotizaciones',servicios:'Órdenes de servicio',productos:'Catálogo comercial'};
async function openTab(tab){
  document.querySelectorAll('.side-tab').forEach(button=>button.classList.toggle('selected', button.dataset.tab===tab));
  document.querySelectorAll('.admin-tab').forEach(section=>section.hidden=section.id!==`tab-${tab}`);
  $('#breadcrumb').textContent=`GESTIÓN / ${tab.toUpperCase()}`;$('#panel-heading').textContent=tabTitles[tab];
  try {if(tab==='resumen') await loadSummary();if(tab==='cotizaciones') await loadQuotes();if(tab==='servicios') await loadJobs();if(tab==='productos') await loadProducts();}
  catch(err){notifyError(err);}
}
document.querySelectorAll('.side-tab').forEach(button=>button.addEventListener('click',()=>openTab(button.dataset.tab)));
$('#refresh-dashboard').addEventListener('click',()=>openTab('resumen'));
async function loadSummary(){const d=await request('/api/admin/summary');const values=[['Cotizaciones registradas',d.total_quotes,'▤'],['Pendientes de atención',d.pending_quotes,'◎'],['Servicios en curso',d.active_jobs,'⚙'],['Artículos activos',d.active_products,'◫'],['Cotizaciones aprobadas',d.approved_quotes,'✓']];$('#metric-grid').innerHTML=values.map(([label,n,icon])=>`<div class="metric-card"><div class="metric-icon">${icon}</div><strong>${n}</strong><span>${esc(label)}</span></div>`).join('');}
function stateOptions(states,current){return states.map(s=>`<option value="${s}" ${current===s?'selected':''}>${esc(statelabel[s])}</option>`).join('');}
async function loadQuotes(){
  const items=await request('/api/admin/quotes');
  $('#quote-table').innerHTML=items.length?`<table><thead><tr><th>Código / fecha</th><th>Cliente</th><th>Artículos solicitados</th><th>Estado</th></tr></thead><tbody>${items.map(q=>`<tr><td><strong>${esc(q.code)}</strong><small>${esc(fmt(q.created_at))}</small></td><td>${esc(q.customer_name)}<small>${esc(q.phone)}</small>${q.email?`<small>${esc(q.email)}</small>`:''}${q.notes?`<small class="notes">${esc(q.notes)}</small>`:''}</td><td>${q.items.map(p=>`<div>${esc(p.name)} × ${p.quantity}</div>`).join('')}<small>${esc(money(q.total_cents))}</small></td><td><select aria-label="Estado cotización ${esc(q.code)}" data-quote-id="${q.id}">${stateOptions(quoteStates,q.status)}</select></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">No hay cotizaciones registradas.</div>';
}
$('#quote-table').addEventListener('change', async e=>{if(!e.target.matches('[data-quote-id]'))return;const select=e.target;select.disabled=true;try{await request(`/api/admin/quotes/${Number(select.dataset.quoteId)}/status`,{method:'PATCH',body:JSON.stringify({status:select.value})});toast('Estado de cotización actualizado.');}catch(err){notifyError(err);await loadQuotes();}finally{select.disabled=false;}});
async function loadJobs(){const jobs=await request('/api/admin/jobs');$('#job-table').innerHTML=jobs.length?`<table><thead><tr><th>Orden</th><th>Servicio / cliente</th><th>Estado</th></tr></thead><tbody>${jobs.map(j=>`<tr><td><strong>${esc(j.code)}</strong><small>${esc(fmt(j.created_at))}</small></td><td><strong>${esc(j.title)}</strong><small>${esc(j.customer_name)} · ${esc(j.contact)}</small>${j.quote_id?`<small>Cotización #${j.quote_id}</small>`:''}${j.notes?`<small class="notes">${esc(j.notes)}</small>`:''}</td><td><select data-job-id="${j.id}" aria-label="Estado de servicio ${esc(j.code)}">${stateOptions(jobStates,j.status)}</select></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">No hay órdenes de servicio. Registra la primera con «Nueva orden».</div>';}
$('#job-table').addEventListener('change',async e=>{if(!e.target.matches('[data-job-id]'))return;const s=e.target;s.disabled=true;try{await request(`/api/admin/jobs/${Number(s.dataset.jobId)}`,{method:'PATCH',body:JSON.stringify({status:s.value})});toast('Servicio actualizado.');}catch(err){notifyError(err);await loadJobs();}finally{s.disabled=false;}});
$('#open-new-job').addEventListener('click',()=>{$('#job-form-wrap').hidden=false;$('#job-form input[name="title"]').focus();});
$('#cancel-job').addEventListener('click',()=>{$('#job-form-wrap').hidden=true;$('#job-form').reset();});
$('#job-form').addEventListener('submit',async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));if(!values.quote_id)delete values.quote_id;else values.quote_id=Number(values.quote_id);try{await request('/api/admin/jobs',{method:'POST',body:JSON.stringify(values)});toast('Orden de servicio creada.');e.currentTarget.reset();$('#job-form-wrap').hidden=true;await loadJobs();}catch(err){notifyError(err);}});
async function loadProducts(){products=await request('/api/admin/products');$('#product-table').innerHTML=products.length?`<table><thead><tr><th>Artículo</th><th>Tipo / categoría</th><th>Precio</th><th>Visibilidad</th><th>Acción</th></tr></thead><tbody>${products.map(p=>`<tr><td><strong>${esc(p.emoji)} ${esc(p.name)}</strong><small>SKU: ${esc(p.sku)}</small></td><td>${esc(p.kind)}<small>${esc(p.category)}</small></td><td>${esc(money(p.price_cents))}</td><td><span class="state-badge ${p.active?'active':'inactive'}">${p.active?'Activo':'Oculto'}</span></td><td><button type="button" class="edit-link" data-edit="${p.id}">Editar ↗</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty-state">El catálogo aún no contiene artículos.</div>';}
function showProduct(product){const f=$('#product-form');f.reset();for(const key of ['id','sku','name','category','description','kind','emoji'])if(product?.[key]!=null)f.elements[key].value=product[key];f.elements.price.value=product?.price_cents!=null?(product.price_cents/100).toFixed(2):'';f.elements.stock.value=product?.stock??'';f.elements.featured.checked=Boolean(product?.featured);f.elements.active.checked=product?Boolean(product.active):true;$('#product-form-title').textContent=product?'Editar artículo':'Agregar al catálogo';$('#product-form-wrap').hidden=false;f.elements.name.focus();}
$('#open-new-product').addEventListener('click',()=>showProduct(null));
$('#cancel-product').addEventListener('click',()=>{$('#product-form-wrap').hidden=true;$('#product-form').reset();});
$('#product-table').addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(!b)return;const p=products.find(p=>p.id===Number(b.dataset.edit));if(p)showProduct(p);});
$('#product-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const v=Object.fromEntries(new FormData(f));const id=Number(v.id);const input={sku:v.sku,name:v.name,category:v.category,description:v.description,kind:v.kind,emoji:v.emoji||'◈',featured:f.elements.featured.checked,active:f.elements.active.checked,price_cents:v.price===''?null:Math.round(Number(v.price)*100),stock:v.stock===''?null:Number(v.stock)};try{await request(id?`/api/admin/products/${id}`:'/api/admin/products',{method:id?'PUT':'POST',body:JSON.stringify(input)});toast(id?'Artículo actualizado.':'Artículo agregado.');$('#product-form-wrap').hidden=true;f.reset();await loadProducts();}catch(err){notifyError(err);}});
