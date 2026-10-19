import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildPage,validate,phone,cents,esc,MAX_PRODUCTS,createBackup,restoreBackup,requireRecipientForExport,DEMO_PHONE,BACKUP_SCHEMA} from '../productos/catalogoexpress/core.mjs';

const example={name:'Mi negocio',tagline:'Pedidos por WhatsApp',phone:'931797758',items:[
 {title:'Servicio A',description:'Instalación (ejemplo)',price:'35.50'},
 {title:'Producto B',description:'Accesorio',price:'12.00'}
]};
test('genera HTML autocontenido y código JS válido',()=>{
  const page=buildPage(example);
  assert.match(page,/<!doctype html>/);
  assert.match(page,/Carrito vacío/);
  assert.match(page,/https:\/\/wa\.me\//);
  assert.match(page,/<title>Mi negocio/);
  assert.match(page,/931797758/);
  const inline=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inline,'inline script required');
  assert.doesNotThrow(()=>new vm.Script(inline));
});
test('normaliza WhatsApp Perú y rechaza teléfonos imposibles',()=>{
  assert.equal(phone('931 797 758'),'51931797758');
  assert.equal(phone('+51 931 797 758'),'51931797758');
  assert.throws(()=>phone('abcdef'));
  assert.throws(()=>phone('123'));
});
test('valida dinero no negativo, límites y máximo de artículos',()=>{
  assert.equal(cents('2.50'),250);
  for(const bad of ['',null,'-1','Infinity','NaN','2000000'])
    assert.throws(()=>cents(bad));
  assert.throws(()=>validate({...example,items:[]}));
  assert.throws(()=>validate({...example,items:Array(MAX_PRODUCTS+1).fill(example.items[0])}));
  assert.throws(()=>validate({...example,items:[{title:'',price:1}]}));
});
test('impide inyección HTML y escape de scripts mediante campos públicos',()=>{
 const payload='</script><img src=x onerror=alert(1)><script>';
 const page=buildPage({...example,name:payload,items:[{title:payload,description:payload,price:1}]});
 assert.doesNotMatch(page,/<img src=x onerror/);
 assert.doesNotMatch(page,/<script>\s*alert/);
 assert.match(page,/&lt;\/script&gt;/);
 assert.match(page,/\\u003c\/script\\u003e/);
 const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new vm.Script(script));
 assert.match(esc('A&B'),/A&amp;B/);
});
test('catálogo entregable informa que no realiza pagos ni guarda datos',()=>{
 const html=buildPage(example);
 assert.match(html,/no cobra dinero/i);
 assert.match(html,/no registra datos/i);
 assert.match(html,/Total referencial/);
});

test('roundtrip JSON preserves original phone, items and prices in soles',()=>{
 const original={...example,phone:'912345678',items:[{title:'Web portátil',description:'Compatible móvil',price:'2.25'}]};
 const saved=createBackup(original);
 assert.equal(saved.schema,BACKUP_SCHEMA);
 assert.equal(saved.catalog.phone,'51912345678');
 assert.equal(saved.catalog.items[0].price,'2.25');
 const after=restoreBackup(JSON.parse(JSON.stringify(saved)));
 assert.equal(after.phone,'51912345678');
 assert.equal(after.items[0].price,'2.25');
 assert.equal(buildPage(after).includes('Web portátil'),true);
});
test('legacy v1 backup with wa and amounts is recovered without incorrect scaling',()=>{
 const old={schema:BACKUP_SCHEMA,catalog:{
  name:'Catálogo recuperado',tagline:'Demo',wa:'51912345678',
  items:[{title:'Reserva',description:'Ejemplo',amount:3599}]
 }};
 const after=restoreBackup(old);
 assert.equal(after.items[0].price,'35.99');
 assert.equal(after.phone,'51912345678');
});
test('invalid, oversized, negative or malicious backups fail closed',()=>{
 assert.throws(()=>restoreBackup({schema:'another-version',catalog:example}));
 assert.throws(()=>restoreBackup({schema:BACKUP_SCHEMA,catalog:{...example,items:Array(41).fill(example.items[0])}}));
 assert.throws(()=>restoreBackup({schema:BACKUP_SCHEMA,catalog:{...example,items:[{title:'Bad',amount:-20}]}}));
 assert.throws(()=>restoreBackup({schema:BACKUP_SCHEMA,catalog:{...example,items:[null]}}));
});
test('third-party catalog downloads cannot accidentally route orders to the demo WhatsApp',()=>{
 assert.throws(()=>requireRecipientForExport({...example,phone:DEMO_PHONE}),
 /reemplaza el WhatsApp de demostración/i);
 assert.doesNotThrow(()=>requireRecipientForExport({...example,phone:'51912345678'}));
 assert.doesNotThrow(()=>requireRecipientForExport({...example,name:'APEX PRIME X',phone:DEMO_PHONE}));
});
