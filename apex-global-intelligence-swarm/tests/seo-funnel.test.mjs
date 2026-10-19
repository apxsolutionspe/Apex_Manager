import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const targets=[
 {name:'servicios',path:'servicios.html',url:'https://apxsolutionspe.github.io/Apex_Manager/servicios.html',schema:'Organization'},
 {name:'cotizapro',path:'productos/cotizapro/index.html',url:'https://apxsolutionspe.github.io/Apex_Manager/productos/cotizapro/',schema:'SoftwareApplication'},
 {name:'catalogoexpress',path:'productos/catalogoexpress/index.html',url:'https://apxsolutionspe.github.io/Apex_Manager/productos/catalogoexpress/',schema:'SoftwareApplication'}
];

for(const t of targets){
 test(t.name+': SEO canónico y datos estructurados comerciales veraces',async()=>{
  const html=await readFile(new URL('../'+t.path,import.meta.url),'utf8');
  assert.ok(html.includes('<link rel="canonical" href="'+t.url+'">'));
  assert.ok(html.includes('name="description"'));
  assert.ok(html.includes('name="robots" content="index,follow'));
  assert.ok(html.includes('<meta property="og:url" content="'+t.url+'">'));
  const scripts=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1);
  const data=JSON.parse(scripts[0][1]);
  assert.equal(data['@context'],'https://schema.org');
  assert.equal(data['@type'],t.schema);
  assert.equal(data.url,t.url);
  assert.match(html,/https:\/\/wa\.me\/51931797758\?/);
  if(t.schema==='SoftwareApplication'){
   assert.equal(data.offers.price,'0');
   assert.equal(data.offers.priceCurrency,'PEN');
   assert.equal(data.creator.name,'APEX PRIME X');
   assert.ok(html.includes('target="_blank"'));
  }else{
   assert.equal(data.name,'APEX PRIME X');
   assert.equal(data.contactPoint.telephone,'+51 931 797 758');
   assert.ok(html.includes('productos/catalogoexpress/'));
  }
 });
}
