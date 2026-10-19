import test from 'node:test';
import assert from 'node:assert/strict';
import {computeQuote, cents, quantity, percentage, pen, csvCell, quoteCsv, validateStoredQuote, MAX_LINE_ITEMS} from '../productos/cotizapro/core.mjs';

const q={id:'test',title:'Cámaras',client:'Cliente de prueba',notes:'',
  lines:[{label:'Cámaras',quantity:2,unitPrice:160},{label:'Cable',quantity:1,unitPrice:95}],
  hours:4,hourRate:55,extras:0,markupPercent:15,taxPercent:0};

test('calcula totales en céntimos sin añadir impuestos automáticamente',()=>{
  const r=computeQuote(q);
  assert.equal(r.materials,41500);assert.equal(r.labor,22000);
  assert.equal(r.cost,63500);assert.equal(r.markup,9525);
  assert.equal(r.total,73025);assert.equal(r.tax,0);
});
test('permite impuesto opcional seleccionado por usuario y redondea a céntimos',()=>{
  const r=computeQuote({...q,taxPercent:18});
  assert.equal(r.tax,13145);assert.equal(r.total,86170);
});
test('rechaza entradas negativas, no numéricas o extremadamente grandes',()=>{
  for (const val of [-1,Infinity,NaN,10000001]) assert.throws(()=>cents(val),RangeError);
  for (const val of [-2,Infinity,100001]) assert.throws(()=>quantity(val),RangeError);
  for (const val of [-2,101,'x']) assert.throws(()=>percentage(val),RangeError);
});
test('limita número de líneas y subtotales no representables',()=>{
  assert.throws(()=>computeQuote({...q,lines:Array(MAX_LINE_ITEMS+1).fill(q.lines[0])}),RangeError);
  assert.throws(()=>computeQuote({...q,lines:[{label:'huge',quantity:100000,unitPrice:10000000}]}),RangeError);
});
test('rechaza respaldos que excedan límites sin ejecutar scripts',()=>{
  assert.throws(()=>validateStoredQuote(null));
  assert.throws(()=>validateStoredQuote({lines:'not-array'}));
  assert.throws(()=>validateStoredQuote({...q,lines:Array(MAX_LINE_ITEMS+1).fill(q.lines[0])}));
  const imported=validateStoredQuote({...q,title:'x'.repeat(300)});
  assert.equal(imported.title.length,120);
});
test('exporta CSV escapado y protege contra fórmulas de hoja de cálculo',()=>{
  const exported=quoteCsv({...q,lines:[{label:'=IMPORTXML("evil")',quantity:1,unitPrice:3.75}]});
  assert.ok(exported.startsWith('\uFEFF'));
  assert.match(exported,/"'=IMPORTXML/);
  assert.match(exported,/"Total PEN"/);
  assert.match(csvCell('+SUM(1,2)'), /^"'\+SUM/);
});
test('utiliza formato monetario PEN para mostrar precios',()=>{
  assert.match(pen(3500),/35/);
});
