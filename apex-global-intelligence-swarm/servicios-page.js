import {SERVICIOS,armarSolicitud,enlaceWhatsApp} from './servicios-core.js';
const q=id=>document.getElementById(id);
const contenedor=q('servicios');
for(const s of SERVICIOS){
 const label=document.createElement('label');label.className='choice';
 const check=document.createElement('input');check.type='checkbox';check.name='servicios';check.value=s.id;
 const box=document.createElement('span'),name=document.createElement('b'),desc=document.createElement('small');
 name.textContent=s.nombre;desc.textContent=s.detalle;box.append(name,desc);label.append(check,box);contenedor.append(label);
}
function recoger(){
 return {servicios:[...document.querySelectorAll('input[name="servicios"]:checked')].map(x=>x.value),
 negocio:q('negocio').value,detalle:q('detalle').value,contacto:q('contacto').value,plazo:q('plazo').value};
}
let texto='';
q('solicitud').addEventListener('submit',event=>{
 event.preventDefault();q('error').textContent='';q('resultado').classList.add('hidden');
 try{
  const info=recoger();
  texto=armarSolicitud(info);
  q('vista').textContent=texto;
  q('wa').href=enlaceWhatsApp(info);
  q('resultado').classList.remove('hidden');
  q('resultado').scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(err){q('error').textContent=String(err.message||err)}
});
q('copiar').addEventListener('click',async()=>{
 if(!texto)return;
 try{await navigator.clipboard.writeText(texto);q('copiar').textContent='¡Copiado!'}catch{q('copiar').textContent='Selecciona y copia el mensaje';}
});
