import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 const res=await page.goto('http://127.0.0.1:4173/productos/catalogoexpress/',{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200);
 const frame=page.frameLocator('#preview');
 await frame.locator('.item').first().waitFor();
 assert.equal(await frame.locator('.item').count(),3);
 await frame.locator('[data-add]').first().click();
 assert.match(await frame.locator('#cart').innerText(),/1 × Producto de demostración A/);
 assert.match(await frame.locator('#total').innerText(),/35/);
 await page.locator('#businessName').fill('Tienda piloto');
 await frame.locator('h1').waitFor();
 assert.equal(await frame.locator('h1').innerText(),'Tienda piloto');
 await page.locator('#add').click();
 assert.equal(await page.locator('.row-item').count(),4);
 await frame.locator('.item').last().waitFor();
 assert.equal(await frame.locator('.item').count(),4);
 // A visitor cannot accidentally ship a catalog with APEX's demo phone.
 await page.locator('#download').click();
 assert.match(await page.locator('#status').innerText(),/reemplaza el WhatsApp de demostración/i);
 await page.locator('#phone').fill('51912345678');
 const downloadEvent=page.waitForEvent('download');
 await page.locator('#download').click();
 const d=await downloadEvent;
 assert.match(d.suggestedFilename(),/\.html$/);
 const html=await readFile(await d.path(),'utf8');
 assert.match(html,/Tienda piloto/);
 assert.match(html,/Agregar al pedido/);
 assert.match(html,/51912345678/);
 // Create an actual JSON backup, change the editor and reload the downloaded file.
 const backupEvent=page.waitForEvent('download');
 await page.locator('#backup').click();
 const b=await backupEvent;
 const archive=JSON.parse(await readFile(await b.path(),'utf8'));
 assert.equal(archive.catalog.phone,'51912345678');
 assert.equal(archive.catalog.items.length,4);
 await page.locator('#businessName').fill('Tienda modificada');
 await page.locator('#upload').setInputFiles({
   name:'catalogoexpress-respaldo.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(archive))
 });
 await page.waitForFunction(() => document.getElementById('businessName').value==='Tienda piloto');
 assert.equal(await page.locator('.row-item').count(),4);
 assert.equal(await page.locator('#phone').inputValue(),'51912345678');
 assert.match(await page.locator('#status').innerText(),/restaurado correctamente/i);
 // Existing customers' previously-exported v1 backups must be recoverable.
 const legacy={schema:'catalogoexpress-backup-v1',catalog:{
   name:'Catálogo recuperado',tagline:'Respaldo anterior',wa:'51912345678',
   items:[{title:'Servicio previo',description:'Demo',amount:1550}]
 }};
 await page.locator('#upload').setInputFiles({
   name:'catalogoexpress-legacy.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(legacy))
 });
 await page.waitForFunction(() => document.getElementById('businessName').value==='Catálogo recuperado');
 assert.equal(await page.locator('.row-item').count(),1);
 assert.equal(await page.locator('input[type="number"]').inputValue(),'15.5');
 // Templates are opt-in and do not erase saved work without confirmation.
 assert.equal(await page.locator('#starterTemplate option').count(),6);
 await page.locator('#starterTemplate').selectOption('ferreteria');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.locator('#applyStarter').click();
 assert.equal(await page.locator('#businessName').inputValue(),'Catálogo recuperado');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#applyStarter').click();
 assert.equal(await page.locator('#businessName').inputValue(),'Ferretería de ejemplo');
 assert.equal(await page.locator('#phone').inputValue(),'51912345678');
 assert.equal(await page.locator('.row-item').count(),3);
 assert.match(await page.locator('.row-item').first().innerText(),/Ejemplo: tornillos por bolsa/);
 assert.match(await page.locator('#status').innerText(),/precios ficticios/i);
 const sectorContact=await page.locator('#sectorContact').getAttribute('href');
 assert.match(decodeURIComponent(sectorContact),/plantilla de Ferretería y materiales/);
 await frame.locator('.item').first().waitFor();
 assert.equal(await frame.locator('.item').count(),3);
 await page.screenshot({path:'apex-catalogoexpress-qa.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('CatalogoExpress E2E OK: mobile, products, cart, totals, preview, standalone HTML download.');
}finally{await browser.close();}
