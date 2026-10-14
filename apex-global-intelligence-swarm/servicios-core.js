// APEX PRIME X — cotizador de alcance comercial sin backend ni almacenamiento.
export const WHATSAPP_PUBLICO = '51931797758'; // Contacto comercial ya publicado por la marca.
export const SERVICIOS = Object.freeze([
  {id:'web',nombre:'Página web corporativa',detalle:'Presencia digital profesional'},
  {id:'tienda',nombre:'Tienda online y catálogo',detalle:'Productos y solicitudes comerciales'},
  {id:'software',nombre:'Software a medida',detalle:'Automatización de procesos'},
  {id:'camaras',nombre:'Instalación de cámaras',detalle:'Seguridad y videovigilancia'},
  {id:'redes',nombre:'Internet, Wi-Fi y redes',detalle:'Conectividad y cableado'},
  {id:'soporte',nombre:'Soporte y mantenimiento TI',detalle:'Computadoras, laptops e impresoras'}
]);
export const PLAZOS = Object.freeze(['Por definir','Esta semana','Este mes','En 1 a 3 meses']);
const limpio=(s,max=400)=>String(s??'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function armarSolicitud(input={}){
 const ids=Array.isArray(input.servicios)?input.servicios:[];
 const elegidos=SERVICIOS.filter(x=>ids.includes(x.id));
 if(!elegidos.length)throw new Error('Selecciona al menos un servicio.');
 const plazo=PLAZOS.includes(input.plazo)?input.plazo:PLAZOS[0];
 const partes=[
  'Hola, APEX PRIME X. Deseo solicitar una cotización profesional.',
  'Servicios: '+elegidos.map(x=>x.nombre).join(', ')+'.',
  'Plazo estimado: '+plazo+'.'
 ];
 const negocio=limpio(input.negocio,100),detalle=limpio(input.detalle,650),contacto=limpio(input.contacto,90);
 if(negocio)partes.push('Empresa o proyecto: '+negocio+'.');
 if(detalle)partes.push('Necesidad: '+detalle+'.');
 if(contacto)partes.push('Nombre: '+contacto+'.');
 partes.push('Deseo conocer alcance, tiempo y presupuesto. Entiendo que no es una cotización vinculante.');
 return partes.join('\n');
}
export function enlaceWhatsApp(input){
 const texto=armarSolicitud(input);
 return 'https://wa.me/'+WHATSAPP_PUBLICO+'?text='+encodeURIComponent(texto);
}
