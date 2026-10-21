import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,DEMO_PHONE} from '../productos/catalogoexpress/core.mjs';
import {STARTER_KITS,kitFor,customizationLink} from '../productos/catalogoexpress/starter-kits.mjs';

test('cinco paquetes originales validan y contienen únicamente valores de demostración',()=>{
 assert.equal(STARTER_KITS.length,5);
 assert.equal(new Set(STARTER_KITS.map(x=>x.id)).size,5);
 for(const kit of STARTER_KITS){
  const draft=kitFor(kit.id);
  const validated=validate(draft);
  assert.equal(validated.wa,DEMO_PHONE);
  assert.equal(draft.items.length,3);
  assert.ok(draft.items.every(x=>x.title.startsWith('Ejemplo:')));
  assert.ok(draft.items.every(x=>x.price==='0'));
  assert.ok(validated.items.every(x=>x.amount===0));
 }
});
test('preserva WhatsApp del visitante y devuelve copias editables independientes',()=>{
 const first=kitFor('ferreteria','51912345678');
 const second=kitFor('ferreteria','51912345678');
 assert.equal(validate(first).wa,'51912345678');
 first.items[0].title='Personalizado por visitante';
 assert.notEqual(first.items[0].title,second.items[0].title);
});
test('CTA de personalización requiere visita voluntaria y no envía mensajes',()=>{
 const href=customizationLink('restaurante');
 const url=new URL(href);
 assert.equal(url.hostname,'wa.me');
 assert.equal(url.pathname,'/51931797758');
 assert.match(url.searchParams.get('text'),/plantilla de Restaurante y cafetería/);
 assert.throws(()=>kitFor('desconocido'));
 assert.throws(()=>customizationLink('desconocido'));
});
