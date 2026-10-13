import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const bad=[];
page.on('pageerror',e=>bad.push(e.message));
try{
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
 await page.locator('.app').waitFor({timeout:12000});
 assert.match(await page.locator('h1').first().innerText(),/Centro de inteligencia/);
 await page.waitForFunction(() => document.body.innerText.includes('Señales públicas reales'),null,{timeout:12000});
 await page.locator('[data-action="go-radar"]').first().click();
 assert.match(await page.locator('h1').first().innerText(),/Radar automático/);
 await page.locator('[data-action="nav"][data-page="opportunities"]').click();
 assert.match(await page.locator('h1').first().innerText(),/Oportunidades/);
 await page.locator('[data-action="nav"][data-page="dashboard"]').click();
 await page.screenshot({path:'apex-desktop.png',fullPage:true});
 await page.locator('[data-action="scan"]').first().click();
 await page.waitForFunction(() => !document.querySelector('.runprogress') && !document.body.innerText.includes('Escaneo en curso:'),null,{timeout:35000});
 const bodyAfterScan=await page.locator('body').innerText();
 assert.ok(bodyAfterScan.includes('Último ciclo personal'),'El panel muestra el estado del ciclo personal');
 await page.screenshot({path:'apex-after-scan.png',fullPage:true});
 console.log('RESULTADO ESCANEO (fragmento):',bodyAfterScan.slice(0,850));

 await page.locator('[data-action="nav"][data-page="explore"]').click();
 assert.match(await page.locator('h1').first().innerText(),/Exploración/);
 await page.locator('[data-action="nav"][data-page="settings"]').click();
 assert.match(await page.locator('h1').first().innerText(),/Configuración/);
 await page.locator('[data-action="nav"][data-page="vault"]').click();
 assert.match(await page.locator('h1').first().innerText(),/bóveda/i);
 await page.locator('[data-action="nav"][data-page="dashboard"]').click();
 await page.locator('[data-action="kill"]').first().click();
 assert.ok((await page.locator('body').innerText()).includes('Rearmar'));
 await page.locator('[data-action="rearm"]').first().click();
 await page.locator('[data-action="login"]').first().click();
 assert.match(await page.locator('#login-title').innerText(),/Acceder/);
 await page.locator('[data-action="close-modal"]').first().click();
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'apex-mobile.png',fullPage:true});
 assert.equal(bad.length,0,'Sin errores JS del navegador: '+bad.join('; '));
 console.log('PASS: navegacion, interfaz responsive, parada de emergencia y autenticacion modal.');
}catch(e){await page.screenshot({path:'apex-error.png',fullPage:true});throw e}
finally{await browser.close()}
