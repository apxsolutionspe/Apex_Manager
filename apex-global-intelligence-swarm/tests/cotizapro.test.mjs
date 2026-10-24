import test from 'node:test';
import assert from 'node:assert/strict';
import {computeQuote, cents, quantity, percentage, pen, csvCell, quoteCsv, printableBreakdown, validateStoredQuote, MAX_LINE_ITEMS} from '../productos/cotizapro/core.mjs';

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
test('half-cent prices round consistently in totals, CSV and print exports',()=>{
  assert.equal(cents('10.075'),1008);
  assert.equal(cents('324785.535'),32478554);
  const input={...q,lines:[{label:'Artículo',quantity:3,unitPrice:'10.075'}],
    hours:0,hourRate:0,extras:0,markupPercent:0,taxPercent:0};
  const result=computeQuote(input);
  assert.equal(result.materials,3024);
  assert.ok(quoteCsv(input).includes('"Artículo","3","10.08","30.24"'));
  const print=printableBreakdown(input);
  assert.equal(print.rows[0].unitCents,1008);
  assert.equal(print.totals.total,3024);
});

test('utiliza formato monetario PEN para mostrar precios',()=>{
  assert.match(pen(3500),/35/);
});

test('CSV refleja materiales, mano de obra, recargo, impuestos y total calculados',()=>{
  const csv=quoteCsv({...q,taxPercent:18});
  const expected=[
    ['Subtotal materiales','415.00'],
    ['Mano de obra (horas)','220.00'],
    ['Otros gastos','0.00'],
    ['Costo base','635.00'],
    ['Recargo (15%)','95.25'],
    ['Subtotal antes de impuesto','730.25'],
    ['Impuesto opcional (18%)','131.45'],
    ['Total PEN','861.70']
  ];
  assert.match(csv,/"Importe PEN"/);
  for(const [name,amount] of expected){
    assert.ok(csv.includes(csvCell(name)),name);
    assert.ok(csv.includes(csvCell(amount)),amount);
  }
  assert.ok(csv.includes('"Cámaras","2","160.00","320.00"'));
  assert.ok(csv.includes('"Cable","1","95.00","95.00"'));
});
test('CSV usa los mismos redondeos de céntimos y no agrega impuesto por omisión',()=>{
  const input={...q,lines:[{label:'Ítem',quantity:3,unitPrice:'1.235'}],
    hours:0,hourRate:0,extras:0,markupPercent:0,taxPercent:0};
  const csv=quoteCsv(input);
  const result=computeQuote(input);
  assert.equal(result.materials,372);
  assert.ok(csv.includes('"Ítem","3","1.24","3.72"'));
  assert.ok(csv.includes('"Total PEN","","","3.72"'));
  assert.ok(csv.includes('"Impuesto opcional (0%)","","","0.00"'));
});
test('CSV no ejecuta fórmulas introducidas en etiquetas y rechaza montos inválidos',()=>{
  const csv=quoteCsv({...q,lines:[{label:'=HYPERLINK("https://example.invalid")',quantity:1,unitPrice:2}]});
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.invalid"")"'));
  assert.throws(()=>quoteCsv({...q,markupPercent:101}),RangeError);
});

test('printed quote itemizes each line, labor, markup and tax without hiding costs',()=>{
  const {rows,totals}=printableBreakdown({...q,taxPercent:18});
  assert.deepEqual(rows.map(row=>row.amountCents),[32000,9500,22000,9525,13145]);
  assert.equal(rows[0].qty,2);
  assert.equal(rows[0].unitCents,16000);
  assert.equal(rows.reduce((sum,row)=>sum+row.amountCents,0),totals.total);
  assert.equal(totals.total,86170);
});

test('printed quote uses CSV-equivalent rounding for fractional currency values',()=>{
  const {rows,totals}=printableBreakdown({
    lines:[{label:'Ítem',quantity:3,unitPrice:'1.235'}],
    hours:0,hourRate:0,extras:0,markupPercent:0,taxPercent:0
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].unitCents,124);
  assert.equal(rows[0].amountCents,372);
  assert.equal(totals.total,372);
});

test('printed quote includes optional extras and markup once and rejects bad amounts',()=>{
  const {rows,totals}=printableBreakdown({
    lines:[],hours:0,hourRate:0,extras:5.25,markupPercent:10,taxPercent:0
  });
  assert.deepEqual(rows.map(row=>row.amountCents),[525,53]);
  assert.equal(rows.reduce((sum,row)=>sum+row.amountCents,0),totals.total);
  assert.throws(()=>printableBreakdown({...q,lines:[{label:'bad',quantity:1,unitPrice:-1}]}),RangeError);
});
