import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('APEX root exposes business inquiries without removing intelligence application',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/id="root"/);
 assert.match(html,/type="module" src="\.\/app\.js"/);
 assert.match(html,/class="apx-commercial-link" href="\.\/servicios\.html"/);
 assert.match(html,/Conocer servicios y productos digitales/);
});
test('Repository README routes visitors to public products without false payment claims',async()=>{
 const readme=await readFile(new URL('../../README.md',import.meta.url),'utf8');
 for(const url of [
  'https://apxsolutionspe.github.io/Apex_Manager/productos/cotizapro/',
  'https://apxsolutionspe.github.io/Apex_Manager/productos/catalogoexpress/',
  'https://apxsolutionspe.github.io/Apex_Manager/servicios.html',
  'https://wa.me/51931797758?'
 ])assert.ok(readme.includes(url),url);
 assert.match(readme,/No existe una pasarela de cobro integrada/);
 assert.match(readme,/prototipo funcional local/);
});
