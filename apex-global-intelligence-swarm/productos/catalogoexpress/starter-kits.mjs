// Industry starter packs contain FICTIONAL examples, not inventory or real prices.
// They allow people to configure their own offline catalog in minutes.
export const STARTER_KITS = Object.freeze([
  {id:'ferreteria',label:'Ferretería y materiales',name:'Ferretería de ejemplo',
   tagline:'Herramientas, materiales y artículos de ferretería. Consulta disponibilidad y condiciones.',
   items:[
     ['Ejemplo: tornillos por bolsa','Producto ilustrativo, reemplaza medidas y stock.','0'],
     ['Ejemplo: cinta aislante','Producto ilustrativo, personaliza marca y presentación.','0'],
     ['Ejemplo: brocha para pintura','Producto ilustrativo, personaliza tamaños.','0']]},
  {id:'restaurante',label:'Restaurante y cafetería',name:'Restaurante de ejemplo',
   tagline:'Consulta la carta y prepara tu pedido. Disponibilidad, entrega y precio por confirmar.',
   items:[
     ['Ejemplo: menú del día','Descripción ilustrativa, reemplaza ingredientes y precio.','0'],
     ['Ejemplo: bebida natural','Descripción ilustrativa, reemplaza sabores.','0'],
     ['Ejemplo: postre','Descripción ilustrativa, reemplaza variedades.','0']]},
  {id:'tecnico',label:'Servicio técnico y soporte',name:'Servicio técnico de ejemplo',
   tagline:'Consulta servicios de mantenimiento y soporte técnico bajo diagnóstico.',
   items:[
     ['Ejemplo: mantenimiento de laptop','Alcance y presupuesto sujetos a diagnóstico.','0'],
     ['Ejemplo: configuración de red Wi-Fi','Consulta características del espacio y equipos.','0'],
     ['Ejemplo: soporte de impresora','Servicio ilustrativo, solicita evaluación previa.','0']]},
  {id:'ropa',label:'Ropa y accesorios',name:'Boutique de ejemplo',
   tagline:'Consulta modelos, tallas y disponibilidad antes de confirmar tu pedido.',
   items:[
     ['Ejemplo: polo básico','Personaliza talla, color y precio.','0'],
     ['Ejemplo: gorra','Personaliza diseños y materiales.','0'],
     ['Ejemplo: accesorio de temporada','Personaliza fotografías, variante y stock.','0']]},
  {id:'agro',label:'Productos agrícolas no regulados',name:'Tienda agrícola de ejemplo',
   tagline:'Accesorios y herramientas para campo y jardín. Consulta disponibilidad.',
   items:[
     ['Ejemplo: guantes de jardín','Personaliza tallas y materiales.','0'],
     ['Ejemplo: manguera para riego','Personaliza longitud y accesorios.','0'],
     ['Ejemplo: regadera manual','Personaliza capacidad y precio.','0']]}
]);
export function kitFor(id,phone='51931797758'){
 const kit=STARTER_KITS.find(x=>x.id===id);
 if(!kit)throw new Error('Selecciona una plantilla válida');
 return {
  name:kit.name,tagline:kit.tagline,phone,
  items:kit.items.map(([title,description,price])=>({title,description,price}))
 };
}
export function customizationLink(id){
 const kit=STARTER_KITS.find(x=>x.id===id);
 if(!kit)throw new Error('Plantilla desconocida');
 const msg='Hola APEX PRIME X. Utilicé la plantilla de '+kit.label+
   ' de CatálogoExpress y quiero consultar una personalización profesional para mi negocio. ¿Qué información necesitan?';
 return 'https://wa.me/51931797758?text='+encodeURIComponent(msg);
}
