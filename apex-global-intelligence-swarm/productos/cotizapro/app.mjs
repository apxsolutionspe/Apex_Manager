import {computeQuote, pen, quoteCsv, validateStoredQuote, MAX_LINE_ITEMS} from './core.mjs';

const $ = id => document.getElementById(id);
const KEY = 'apx-cotizapro-quotes-v1';
const editable = ['title','client','notes','hours','hourRate','extras','markupPercent','taxPercent'];
const templates = Object.freeze({
  cctv: {title:'Instalación de cámaras', hours:4, hourRate:55, lines:[
    {label:'Cámara de seguridad (ejemplo)',quantity:2,unitPrice:160},
    {label:'Cableado y conectores (ejemplo)',quantity:1,unitPrice:95}]},
  wifi: {title:'Instalación de red WiFi', hours:3, hourRate:55, lines:[
    {label:'Router (ejemplo)',quantity:1,unitPrice:170},
    {label:'Canalización y cable UTP (ejemplo)',quantity:1,unitPrice:80}]},
  support: {title:'Mantenimiento de PC o laptop', hours:2, hourRate:50, lines:[
    {label:'Insumos técnicos (ejemplo)',quantity:1,unitPrice:25}]},
  web: {title:'Desarrollo de página web', hours:12, hourRate:45, lines:[
    {label:'Preparación de contenido (ejemplo)',quantity:1,unitPrice:80}]},
  empty: {title:'Cotización nueva', hours:0, hourRate:0, lines:[]}
});
let lines = [];
let currentId = '';
let saved = [];
function status(message, isError=false) {
  const e = $('message');
  e.textContent = message;
  e.style.color = isError ? '#a12639' : '#095c64';
}
function readQuote() {
  const o={id:currentId,lines:lines.map(v=>({...v}))};
  for(const name of editable) o[name]=$(name).value;
  return validateStoredQuote(o);
}
function applyQuote(q) {
  currentId=q.id||'';
  for (const name of editable) $(name).value=String(q[name]??'');
  lines=q.lines.map(row=>({...row}));
  renderRows(); update();
}
function preset(kind) {
  const t=templates[kind]||templates.empty;
  currentId='';
  $('title').value=t.title; $('client').value=''; $('notes').value='';
  $('hours').value=t.hours; $('hourRate').value=t.hourRate;
  $('extras').value='0'; $('markupPercent').value='15'; $('taxPercent').value='0';
  lines=t.lines.map(x=>({...x}));renderRows();update();
}
function inputFor(field,value,idx,placeholder,step) {
  const label=document.createElement('label');label.className='field';
  const txt=document.createElement('span');txt.textContent=placeholder;label.append(txt);
  const inp=document.createElement('input'); inp.value=String(value);inp.setAttribute('aria-label',placeholder+' '+(idx+1));
  if(field==='label'){inp.type='text';inp.maxLength=130;}
  else {inp.type='number';inp.min='0';inp.step=step;inp.max=field==='quantity'?'100000':'10000000';}
  inp.addEventListener('input',()=>{lines[idx][field]=inp.value;update();});
  label.append(inp);return label;
}
function renderRows() {
  const container=$('lines');container.replaceChildren();
  if(!lines.length){const p=document.createElement('p');p.className='muted';p.textContent='No hay conceptos. Añade el primero para empezar.';container.append(p);}
  lines.forEach((line,i)=>{
    const grid=document.createElement('div');grid.className='rowgrid';
    grid.append(inputFor('label',line.label,i,'Concepto','any'),
      inputFor('quantity',line.quantity,i,'Cantidad','0.1'),
      inputFor('unitPrice',line.unitPrice,i,'Precio S/','0.01'));
    const remove=document.createElement('button');remove.type='button';remove.className='btn btn-danger btn-sm';
    remove.textContent='×';remove.setAttribute('aria-label','Quitar concepto '+(i+1));
    remove.addEventListener('click',()=>{lines.splice(i,1);renderRows();update();});
    grid.append(remove);container.append(grid);
  });
}
function printRows(q,total) {
  $('printedTitle').textContent=q.title || 'Cotización';
  $('printedClient').textContent=q.client ? 'Cliente: '+q.client : '';
  $('printedDate').textContent='Preparado el '+new Date().toLocaleDateString('es-PE');
  const target=$('printedRows');target.replaceChildren();
  const items=q.lines.map(l=>[l.label,l.quantity,pen(Math.round(l.unitPrice*100))]);
  if(q.hours>0) items.push(['Mano de obra ('+q.hours+' horas)',1,pen(Math.round(q.hourRate*q.hours*100))]);
  if(q.extras>0) items.push(['Otros gastos',1,pen(Math.round(q.extras*100))]);
  for(const itemsRow of items){
    const tr=document.createElement('tr');
    itemsRow.forEach((cell,i)=>{const td=document.createElement('td');td.textContent=String(cell);if(i===2)td.className='align-right';tr.append(td);});
    target.append(tr);
  }
  $('printedTotal').textContent='Total estimado: '+pen(total.total)+
    (q.taxPercent ? ' (incluye impuesto configurado: '+q.taxPercent+'%)' : '');
  $('printedNotes').textContent=q.notes ? 'Condiciones: '+q.notes : '';
}
function update() {
  try {
    const q=readQuote(), amounts=computeQuote(q);
    const fields={materials:amounts.materials,labor:amounts.labor,extrasView:amounts.extras,markup:amounts.markup,tax:amounts.tax,total:amounts.total};
    for(const [id,value] of Object.entries(fields)) $(id).textContent=pen(value);
    printRows(q,amounts);status('');
  } catch(e) {status('Revisa los datos: '+e.message,true);$('total').textContent='—';}
}
function loadSaved() {
  try {const raw=localStorage.getItem(KEY);saved=raw?JSON.parse(raw):[];if(!Array.isArray(saved))throw Error();
    saved=saved.slice(0,70).map(validateStoredQuote);
  } catch {saved=[];status('No se pudieron leer las cotizaciones locales; usa un respaldo JSON.',true);}
  renderSaved();
}
function persist() {
  try {localStorage.setItem(KEY,JSON.stringify(saved));return true}
  catch {status('El navegador no permite guardar o el espacio local está lleno. Descarga un respaldo.',true);return false}
}
function renderSaved() {
  const list=$('savedList');list.replaceChildren();
  if(!saved.length){const p=document.createElement('p');p.className='muted';p.textContent='Aún no hay cotizaciones guardadas.';list.append(p);return;}
  saved.forEach(q=>{
    const card=document.createElement('div');card.className='saved';
    const text=document.createElement('span');text.textContent=(q.title||'Sin título')+' · '+pen(computeQuote(q).total);card.append(text);
    const open=document.createElement('button');open.className='btn btn-outline btn-sm';open.type='button';open.textContent='Abrir';
    open.addEventListener('click',()=>{applyQuote(q);status('Cotización cargada.');location.hash='#cotizador';});
    const del=document.createElement('button');del.className='btn btn-danger btn-sm';del.type='button';del.textContent='Eliminar';
    del.addEventListener('click',()=>{
      if(!confirm('¿Eliminar esta cotización guardada?'))return;
      saved=saved.filter(x=>x.id!==q.id);if(persist())renderSaved();
    });
    card.append(open,del);list.append(card);
  });
}
function filename(base,ext){return base.toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,60)||'cotizacion' + '.'+ext}
function download(content,name,mime) {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function summary(q) {
  const total=computeQuote(q);
  return ['Cotización: '+(q.title||'Sin título'),
    ...(q.client?['Cliente: '+q.client]:[]),
    ...q.lines.map(l=>l.label+': '+l.quantity+' x '+pen(Math.round(l.unitPrice*100))),
    'Mano de obra: '+pen(total.labor), 'Otros gastos: '+pen(total.extras),
    'Recargo: '+pen(total.markup),
    'Impuesto opcional: '+pen(total.tax), 'TOTAL: '+pen(total.total),
    ...(q.notes?['Condiciones: '+q.notes]:[]),
    'Cotización referencial; no es factura ni comprobante SUNAT.'
  ].join('\n');
}
$('template').addEventListener('change',e=>preset(e.target.value));
$('addRow').addEventListener('click',()=>{
  if(lines.length>=MAX_LINE_ITEMS){status('Límite de '+MAX_LINE_ITEMS+' conceptos.',true);return;}
  lines.push({label:'Nuevo concepto',quantity:1,unitPrice:0});renderRows();update();
});
for(const id of editable) $(id).addEventListener('input',update);
$('save').addEventListener('click',()=>{
  try{
    let q=readQuote();if(!q.title.trim())throw Error('Escribe el título del trabajo');
    if(!q.id){q.id='cot-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);currentId=q.id;}
    saved=[q,...saved.filter(x=>x.id!==q.id)].slice(0,70);
    if(persist()){renderSaved();status('Guardada en este navegador. Descarga un respaldo para conservarla.');}
  }catch(e){status(e.message,true)}
});
$('print').addEventListener('click',()=>{try{const q=readQuote();printRows(q,computeQuote(q));window.print();}catch(e){status(e.message,true)}});
$('whatsapp').addEventListener('click',()=>{
  try{const message=summary(readQuote());window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');}
  catch(e){status(e.message,true)}
});
$('copy').addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(summary(readQuote()));status('Resumen copiado.');}
  catch {status('El navegador no autorizó copiar; usa Compartir por WhatsApp.',true)}
});
$('backup').addEventListener('click',()=>{
  try {const all=[readQuote(),...saved].filter((q,i,a)=>q.id? a.findIndex(x=>x.id===q.id)===i : i===0);
    download(JSON.stringify({schema:'apx-cotizapro-v1',quotes:all},null,2),
      'apx-cotizapro-respaldo.json','application/json');status('Respaldo exportado.');}
  catch(e){status(e.message,true)}
});
$('downloadCsv').addEventListener('click',()=>{
  try {download(quoteCsv(readQuote()),'apx-cotizacion.csv','text/csv;charset=utf-8');status('CSV descargado.');}
  catch(e){status(e.message,true)}
});
$('importFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try {
    if(file.size>1048576)throw Error('El archivo excede 1 MB');
    const data=JSON.parse(await file.text());
    if(data.schema!=='apx-cotizapro-v1'||!Array.isArray(data.quotes)||data.quotes.length>70)
      throw Error('Archivo de respaldo incompatible o demasiado grande');
    const incoming=data.quotes.map(validateStoredQuote).map(q=>({...q,id:q.id||'import-'+Date.now()+'-'+Math.random().toString(36).slice(2,6)}));
    saved=[...incoming,...saved.filter(x=>!incoming.some(i=>i.id===x.id))].slice(0,70);
    if(persist()){renderSaved();status('Respaldo incorporado, sin borrar otras cotizaciones.');}
  }catch(err){status('No se pudo importar: '+err.message,true)}
  finally {e.target.value='';}
});
preset('cctv');loadSaved();