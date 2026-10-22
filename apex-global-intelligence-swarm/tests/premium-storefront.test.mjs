import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const base=new URL('../',import.meta.url);
const html=await readFile(new URL('plantillas-premium.html',base),'utf8');
const services=await readFile(new URL('servicios.html',base),'utf8');

test('escaparate premium tiene SEO real, presentación y cero checkout ficticio',()=>{
 assert.ok(html.startsWith('<!doctype html>'));
 assert.match(html,/<html lang="es">/);
 assert.match(html,/name="viewport"/);
 assert.match(html,/<link rel="canonical" href="https:\/\/apxsolutionspe\.github\.io\/Apex_Manager\/plantillas-premium\.html">/);
 const raw=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 assert.ok(raw,'single JSON-LD block must exist');
 const schema=JSON.parse(raw[1]);
 assert.equal(schema['@type'],'CollectionPage');
 assert.equal(schema.publisher.name,'APEX PRIME X');
 assert.equal(schema.url,'https://apxsolutionspe.github.io/Apex_Manager/plantillas-premium.html');
 assert.equal((html.match(/<article class="product">/g)||[]).length,2);
 assert.match(html,/Figma · 6 diseños cuadrados/);
 assert.match(html,/Canva · 10 diapositivas editables/);
 assert.match(html,/No se procesan compras en esta página/);
 assert.doesNotMatch(html,/checkout\.stripe\.com|pago recibido|compra confirmada/i);
});
test('productos tienen contacto comercial voluntario sin mensajes automáticos',()=>{
 const links=[...html.matchAll(/href="(https:\/\/wa\.me\/51931797758\?text=[^"]+)"/g)];
 assert.equal(links.length,4); // Three product/studio inquiries plus pre-payment quote confirmation.
 for(const item of links){
  const url=new URL(item[1]);
  assert.equal(url.hostname,'wa.me');
  assert.equal(url.pathname,'/51931797758');
  assert.match(decodeURIComponent(url.searchParams.get('text')),/(?:personalizacion|diseno|confirmar el monto)/);
 }
 assert.doesNotMatch(html,/<script\b(?! type="application\/ld\+json")/);
 assert.match(html,/El visitante decide si inicia una conversación por WhatsApp/);
});
test('servicios enlaza la nueva colección premium',()=>{
 assert.match(services,/href="\.\/plantillas-premium\.html"/);
});

test('enlace real del titular habilita cobro externo SOLO tras precio acordado',()=>{
 const payment='https://link.mercadopago.com.pe/apexprimex';
 for(const site of [html,services]){
  assert.equal(site.split(payment).length-1,1,'single verified public link per page');
  assert.match(site,/monto acordado|importe lo ingresas tú/);
  assert.match(site,/Mercado Pago/);
 }
 const checkout=html.match(/<a class="btn" href="([^"]+)" target="_blank" rel="noopener noreferrer" aria-label="Ir al enlace oficial de Mercado Pago[^"]+">Pagar acuerdo/);
 assert.ok(checkout,'explicitly labeled external payment CTA');
 const url=new URL(checkout[1]);
 assert.equal(url.protocol,'https:');
 assert.equal(url.hostname,'link.mercadopago.com.pe');
 assert.equal(url.pathname,'/apexprimex');
 assert.equal(url.search,'');
 assert.match(html,/no confirma automáticamente un pedido/);
 assert.match(html,/ni entrega descargas digitales/);
 assert.match(services,/no genera contratos ni entrega automática/);
 assert.match(html,/Confirmar importe antes de pagar/);
 assert.doesNotMatch(html+services,/autopago|pago confirmado automáticamente|ganancias garantizadas/i);
});

test('sitemap indexa APEX Studio y preserva las rutas comerciales existentes',async()=>{
 const sitemap=await readFile(new URL('sitemap.xml',base),'utf8');
 const urls=[
  'https://apxsolutionspe.github.io/Apex_Manager/servicios.html',
  'https://apxsolutionspe.github.io/Apex_Manager/productos/cotizapro/',
  'https://apxsolutionspe.github.io/Apex_Manager/productos/catalogoexpress/',
  'https://apxsolutionspe.github.io/Apex_Manager/plantillas-premium.html'
 ];
 for(const url of urls){
  assert.equal(sitemap.split('<loc>'+url+'</loc>').length-1,1,url+' debe estar exactamente una vez');
 }
 assert.match(sitemap,/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
});
