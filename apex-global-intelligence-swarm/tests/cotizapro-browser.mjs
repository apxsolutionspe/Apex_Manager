import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
const base='http://127.0.0.1:4173/productos/cotizapro/';
const errors=[];
page.on('pageerror',err=>errors.push(err.message));
try {
  const res=await page.goto(base,{waitUntil:'domcontentloaded'});
  assert.equal(res.status(),200);
  await page.locator('#total').waitFor();
  await page.waitForFunction(()=>document.querySelector('#total')?.textContent.includes('730'));
  assert.match(await page.locator('#total').innerText(),/730/);
  // A printed quote must expose line amounts and markup, not just a grand total.
  await page.evaluate(()=>{window.print=()=>{};});
  await page.locator('#print').click();
  assert.equal(await page.locator('#printedRows tr').count(),4);
  assert.match(await page.locator('#printedRows tr').first().textContent(),/320/);
  assert.match(await page.locator('#printedRows').textContent(),/Recargo/);
  assert.match(await page.locator('#printedTotal').textContent(),/730/);
  await page.locator('#markupPercent').fill('0');
  await page.waitForFunction(()=>document.querySelector('#total')?.textContent.includes('635'));
  await page.locator('#title').fill('Prueba QA navegador');
  await page.locator('#save').click();
  assert.equal(await page.locator('#savedList .saved').count(),1);
  await page.reload();
  assert.equal(await page.locator('#savedList .saved').count(),1);
  await page.locator('#savedList .saved button').first().click();
  assert.equal(await page.locator('#title').inputValue(),'Prueba QA navegador');
  await page.locator('#template').selectOption('wifi');
  assert.equal(await page.locator('#lines .rowgrid').count(),2);
  await page.locator('#addRow').click();
  assert.equal(await page.locator('#lines .rowgrid').count(),3);
  const promise=page.waitForEvent('download');
  await page.locator('#downloadCsv').click();
  const download=await promise;
  assert.match(download.suggestedFilename(),/\.csv$/);
  await page.locator('#title').fill('<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('img[onerror]').count(),0);
  await page.screenshot({path:'apex-cotizapro-qa.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('CotizaPro mobile E2E successful: totals, local save, reload, templates, rows, CSV, safe rendering.');
} finally {await browser.close();}
