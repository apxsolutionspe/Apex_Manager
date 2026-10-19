import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildPage,validate,phone,cents,esc,MAX_PRODUCTS} from '../productos/catalogoexpress/core.mjs';

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
