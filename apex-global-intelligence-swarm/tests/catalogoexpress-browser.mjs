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
 const downloadEvent=page.waitForEvent('download');
 await page.locator('#download').click();
 const d=await downloadEvent;
 assert.match(d.suggestedFilename(),/\.html$/);
 const html=await readFile(await d.path(),'utf8');
 assert.match(html,/Tienda piloto/);
 assert.match(html,/Agregar al pedido/);
 await page.screenshot({path:'apex-catalogoexpress-qa.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('CatalogoExpress E2E OK: mobile, products, cart, totals, preview, standalone HTML download.');
}finally{await browser.close();}
