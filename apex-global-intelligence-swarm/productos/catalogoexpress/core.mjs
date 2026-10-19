// APEX CatalogueKit — static, offline-capable WhatsApp catalogs.
export const MAX_PRODUCTS = 40;
export function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function phone(s){
  let v=String(s??'').replace(/[\s().+-]/g,'');
  if(!/^\d{9,15}$/.test(v))throw Error('Teléfono inválido: usar 9 a 15 dígitos');
  return v.length===9&&v[0]==='9'?'51'+v:v;
}
export function cents(s){
  if(s===''||s===null||s===undefined)throw Error('Precio obligatorio');
  const n=Number(s);
  if(!Number.isFinite(n)||n<0||n>1000000)throw Error('Precio inválido');
  return Math.round((n+Number.EPSILON)*100);
}
export function validate(x){
  if(!x||typeof x!=='object')throw Error('Datos inválidos');
  const name=String(x.name||'').trim().slice(0,90);
  if(!name)throw Error('Indica el nombre del negocio');
  const wa=phone(x.phone);
  if(!Array.isArray(x.items)||x.items.length<1||x.items.length>MAX_PRODUCTS)throw Error('Se requieren 1 a 40 artículos');
  const items=x.items.map((v,i)=>{
    const title=String(v.title||'').trim().slice(0,110);
    if(!title)throw Error('Artículo sin nombre '+(i+1));
    return {title,description:String(v.description||'').trim().slice(0,200),amount:cents(v.price)};
  });
  return {name,wa,tagline:String(x.tagline||'').trim().slice(0,160),items};
}
export function buildPage(raw){
  const v=validate(raw);
  const money=n=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(n/100);
  const cards=v.items.map((p,i)=>
    '<article class="item"><h3>'+esc(p.title)+'</h3><p>'+esc(p.description||'Producto o servicio a consultar')+
    '</p><strong>'+money(p.amount)+'</strong><button type="button" data-add="'+i+'">Agregar al pedido</button></article>'
  ).join('');
  const payload=JSON.stringify({wa:v.wa,items:v.items}).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  const script=[
    "'use strict';",
    "const DATA="+payload+";",
    "const cart=new Map();",
    "const currency=n=>new Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format(n/100);",
    "function redraw(){const box=document.getElementById('cart');box.replaceChildren();let total=0;",
    "for(const [id,qty] of cart){const item=DATA.items[id];if(!item)continue;total+=item.amount*qty;",
    "const div=document.createElement('div');div.className='cartline';",
    "const desc=document.createElement('span');desc.textContent=qty+' × '+item.title;",
    "const amount=document.createElement('strong');amount.textContent=currency(item.amount*qty);",
    "const less=document.createElement('button');less.type='button';less.textContent='−';less.setAttribute('aria-label','Quitar una unidad de '+item.title);",
    "less.addEventListener('click',()=>{if(qty===1)cart.delete(id);else cart.set(id,qty-1);redraw()});",
    "div.append(desc,amount,less);box.append(div);}",
    "if(!cart.size){const p=document.createElement('p');p.textContent='Carrito vacío';box.append(p);}",
    "document.getElementById('total').textContent='Total referencial: '+currency(total);",
    "document.getElementById('send').disabled=!cart.size;}",
    "document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.add);",
    "if(!DATA.items[i]||(cart.get(i)||0)>=99)return;cart.set(i,(cart.get(i)||0)+1);redraw()}));",
    "document.getElementById('send').addEventListener('click',()=>{if(!cart.size)return;",
    "const lines=['Hola, quiero consultar este pedido:'];let total=0;",
    "for(const [i,n] of cart){const p=DATA.items[i];lines.push('• '+n+' × '+p.title+' — '+currency(n*p.amount));total+=n*p.amount;}",
    "lines.push('Total referencial: '+currency(total),'Confirmar disponibilidad, plazo y precio por favor.');",
    "window.open('https://wa.me/'+DATA.wa+'?text='+encodeURIComponent(lines.join('\\n')),'_blank','noopener,noreferrer');});",
    "redraw();"
  ].join('\n');
  const css=[
    '*{box-sizing:border-box}body{margin:0;background:#f3f7fa;color:#142b43;font:16px/1.5 system-ui,sans-serif}',
    'header{background:linear-gradient(120deg,#071a31,#15546a);color:white;padding:55px 22px}',
    '.wrap{max-width:1020px;margin:auto;padding:0 22px}header .wrap{padding:0}',
    'h1{font-size:clamp(2rem,5vw,3.7rem);line-height:1.1}header p{color:#c9e4ec}',
    'main{padding-top:38px;padding-bottom:64px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:17px}',
    '.item,.cart{border-radius:15px;border:1px solid #d7e4eb;background:white;padding:20px}',
    '.item{display:flex;flex-direction:column}.item h3{margin:0}.item p{color:#5c7180;flex:1;overflow-wrap:anywhere}',
    '.item strong{font-size:1.25rem;color:#0b6678;margin:14px 0}',
    'button{cursor:pointer;font:inherit;background:#087c8b;border:0;border-radius:9px;padding:11px 14px;color:white;font-weight:700}',
    'button:disabled{opacity:.5;cursor:not-allowed}.cart{margin-top:32px}.cartline{display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid #e2eaf0}',
    '.cartline span{flex:1;overflow-wrap:anywhere}.cartline button{background:#e9f0f3;color:#19334a}',
    '.total{font-size:1.3rem;font-weight:800;text-align:right;margin:19px 0}.note{color:#617989;font-size:.85rem}',
    'footer{padding:20px;text-align:center;color:#547182;font-size:.85rem}@media(max-width:600px){header{padding:32px 18px}.wrap{padding:0 15px}}'
  ].join('');
  return [
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="description" content="'+esc(v.tagline||v.name)+'"><title>'+esc(v.name)+' | Catálogo</title><style>'+css+'</style></head>',
    '<body><header><div class="wrap"><small>CATÁLOGO DIGITAL · PEDIDOS DIRECTOS</small><h1>'+esc(v.name)+'</h1><p>'+esc(v.tagline)+'</p></div></header>',
    '<main class="wrap"><h2>Productos y servicios</h2><section class="grid">'+cards+'</section>',
    '<section class="cart"><h2>Mi pedido</h2><div id="cart" aria-live="polite"></div>',
    '<div class="total" id="total"></div><button type="button" id="send">Solicitar pedido por WhatsApp</button>',
    '<p class="note">El pedido solo se envía si lo confirmas en WhatsApp. Precios y disponibilidad sujetos a confirmación. Esta página no cobra dinero ni registra datos en servidores.</p></section></main>',
    '<footer>Catálogo digital preparado con APEX PRIME X</footer><script>'+script+'</script></body></html>'
  ].join('');
}
