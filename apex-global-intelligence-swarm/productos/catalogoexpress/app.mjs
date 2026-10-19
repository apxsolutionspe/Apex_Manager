import {buildPage, validate, MAX_PRODUCTS} from './core.mjs';
const $=id=>document.getElementById(id);
const KEY='apx-catalogoexpress-builder-v1';
let current={
 name:'Mi tienda de ejemplo',
 tagline:'Productos y servicios para ayudarte en tu día a día.',
 phone:'51931797758',
 items:[
  {title:'Producto de demostración A',description:'Artículo ilustrativo, no representa inventario disponible.',price:'35'},
  {title:'Servicio de demostración B',description:'Un servicio de ejemplo, sin oferta comercial vinculante.',price:'70'},
  {title:'Accesorio de demostración C',description:'Precio y características ficticios.',price:'15.50'}
 ]
};
function notify(message,error=false){
 const e=$('status');e.textContent=message;e.style.color=error?'#aa3342':'#08768b';
}
function pull(){
 current.name=$('businessName').value;
 current.tagline=$('tagline').value;
 current.phone=$('phone').value;
}
function persist(){
 try{localStorage.setItem(KEY,JSON.stringify(current));}catch{}
}
function preview(){
 pull();persist();
 try{
  const html=buildPage(current);
  $('preview').srcdoc=html;
  notify('');
 }catch(e){notify(e.message,true);}
}
function addInput(text,value,max,onChange,type='text'){
 const wrapper=document.createElement('label');wrapper.className='field';
 const title=document.createElement('span');title.textContent=text;
 const input=document.createElement('input');input.type=type;input.value=value;
 if(type==='number'){input.step='0.01';input.min='0';input.max='1000000';}
 else input.maxLength=max;
 input.addEventListener('input',()=>onChange(input.value));
 wrapper.append(title,input);return wrapper;
}
function redraw(){
 const box=$('items');box.replaceChildren();
 current.items.forEach((product,i)=>{
  const card=document.createElement('div');card.className='row-item';
  const header=document.createElement('div');header.className='rowhead';
  const label=document.createElement('strong');label.textContent='Artículo '+(i+1);
  const remove=document.createElement('button');remove.type='button';remove.className='danger';
  remove.textContent='Eliminar';remove.setAttribute('aria-label','Eliminar artículo '+(i+1));
  remove.addEventListener('click',()=>{
    if(current.items.length===1){notify('El catálogo requiere al menos un artículo.',true);return;}
    current.items.splice(i,1);redraw();preview();
  });header.append(label,remove);card.append(header);
  const name=addInput('Nombre',product.title,110,value=>{current.items[i].title=value;preview();});
  const desc=addInput('Descripción',product.description,200,value=>{current.items[i].description=value;preview();});
  const price=addInput('Precio referencial S/',product.price,0,value=>{current.items[i].price=value;preview();},'number');
  card.append(name,desc,price);box.append(card);
 });
}
function download(text,filename,type){
 const url=URL.createObjectURL(new Blob([text],{type}));
 const a=document.createElement('a');a.download=filename;a.href=url;document.body.append(a);
 a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
$('businessName').addEventListener('input',preview);
$('tagline').addEventListener('input',preview);
$('phone').addEventListener('input',preview);
$('add').addEventListener('click',()=>{
 if(current.items.length>=MAX_PRODUCTS){notify('Máximo '+MAX_PRODUCTS+' artículos.',true);return;}
 current.items.push({title:'Nuevo artículo',description:'',price:'0'});
 redraw();preview();
});
$('download').addEventListener('click',()=>{
 try{
  pull();
  const html=buildPage(current);
  download(html,'catalogoexpress-mi-negocio.html','text/html;charset=utf-8');
  notify('Archivo independiente descargado. Puedes publicarlo en tu propio hosting.');
 }catch(e){notify(e.message,true);}
});
$('backup').addEventListener('click',()=>{
 try{
  pull();const clean=validate(current);
  download(JSON.stringify({schema:'catalogoexpress-backup-v1',catalog:clean},null,2),
    'catalogoexpress-respaldo.json','application/json');
  notify('Configuración descargada.');
 }catch(e){notify(e.message,true);}
});
$('upload').addEventListener('change',async evt=>{
 const file=evt.target.files?.[0];if(!file)return;
 try{
  if(file.size>1000000)throw Error('El archivo excede 1 MB');
  const imported=JSON.parse(await file.text());
  if(imported.schema!=='catalogoexpress-backup-v1')throw Error('Formato de respaldo no compatible');
  const validated=validate(imported.catalog);
  current={name:validated.name,tagline:validated.tagline,phone:validated.wa,
    items:validated.items.map(p=>({title:p.title,description:p.description,price:String(p.amount/100)}))};
  $('businessName').value=current.name;$('tagline').value=current.tagline;$('phone').value=current.phone;
  redraw();preview();notify('Respaldo restaurado correctamente.');
 }catch(e){notify('No se pudo restaurar: '+e.message,true);}
 finally{evt.target.value='';}
});
try {
 const value=localStorage.getItem(KEY);
 if(value){
  const old=JSON.parse(value), valid=validate(old);
  current={name:valid.name,tagline:valid.tagline,phone:valid.wa,
    items:valid.items.map(p=>({title:p.title,description:p.description,price:String(p.amount/100)}))};
 }
}catch{}
$('businessName').value=current.name;$('tagline').value=current.tagline;$('phone').value=current.phone;
redraw();preview();
