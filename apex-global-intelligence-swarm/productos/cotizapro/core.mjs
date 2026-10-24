// APEX CotizaPro: pure arithmetic and safe exports; no external services.
export const MAX_LINE_ITEMS = 60;
export const MAX_AMOUNT = 10000000;
export function quantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100000) throw new RangeError('Cantidad fuera de rango');
  return n;
}
export function cents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) throw new RangeError('Monto inválido');
  // Scale epsilon with the amount to round half-cent values reliably (e.g. 10.075 → 10.08).
  return Math.round((n + Number.EPSILON * Math.max(1, n)) * 100);
}
export function percentage(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new RangeError('Porcentaje inválido');
  return n;
}
export function computeQuote(input) {
  const lines = Array.isArray(input?.lines) ? input.lines : [];
  if (lines.length > MAX_LINE_ITEMS) throw new RangeError('Demasiados conceptos');
  let materials = 0;
  for (const row of lines) {
    const q = quantity(row.quantity);
    const unit = cents(row.unitPrice);
    materials += Math.round(q * unit);
  }
  const labor = Math.round(quantity(input.hours || 0) * cents(input.hourRate || 0));
  const extras = cents(input.extras || 0);
  const markupPct = percentage(input.markupPercent || 0);
  const taxPct = percentage(input.taxPercent || 0);
  const cost = materials + labor + extras;
  const markup = Math.round(cost * markupPct / 100);
  const subtotal = cost + markup;
  const tax = Math.round(subtotal * taxPct / 100);
  if (![materials, labor, extras, markup, tax, cost, subtotal].every(Number.isSafeInteger)
      || subtotal + tax > MAX_AMOUNT * 100)
    throw new RangeError('El total excede el límite permitido');
  return { materials, labor, extras, cost, markup, subtotal, tax, total: subtotal + tax };
}
export function pen(centsValue) {
  return new Intl.NumberFormat('es-PE', {style:'currency',currency:'PEN'}).format(centsValue / 100);
}
export function csvCell(value) {
  const s = String(value ?? '').replace(/^[\s]*[=+\-@\t\r]/, "'$&");
  return '"' + s.replace(/"/g,'""') + '"';
}
export function quoteCsv(quote) {
  // Always derive every subtotal from the same cent-based calculation
  // used by the interface. No fiscal status is inferred from the tax field.
  const amounts = computeQuote(quote);
  const rows = [
    ['Concepto', 'Cantidad', 'Precio unitario PEN', 'Importe PEN'],
    ...quote.lines.map(row => [
      row.label,
      row.quantity,
      (cents(row.unitPrice) / 100).toFixed(2),
      (Math.round(quantity(row.quantity) * cents(row.unitPrice)) / 100).toFixed(2)
    ]),
    ['Subtotal materiales', '', '', (amounts.materials / 100).toFixed(2)],
    ['Mano de obra (horas)', quote.hours || 0, Number(quote.hourRate || 0).toFixed(2), (amounts.labor / 100).toFixed(2)],
    ['Otros gastos', '', '', (amounts.extras / 100).toFixed(2)],
    ['Costo base', '', '', (amounts.cost / 100).toFixed(2)],
    ['Recargo (' + percentage(quote.markupPercent || 0) + '%)', '', '', (amounts.markup / 100).toFixed(2)],
    ['Subtotal antes de impuesto', '', '', (amounts.subtotal / 100).toFixed(2)],
    ['Impuesto opcional (' + percentage(quote.taxPercent || 0) + '%)', '', '', (amounts.tax / 100).toFixed(2)],
    ['Total PEN', '', '', (amounts.total / 100).toFixed(2)]
  ];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function validateStoredQuote(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.lines) || x.lines.length > MAX_LINE_ITEMS)
    throw new Error('Formato de cotización inválido');
  const clean = {
    id: String(x.id || '').slice(0,70),
    title: String(x.title || '').slice(0,120),
    client: String(x.client || '').slice(0,120),
    notes: String(x.notes || '').slice(0,500),
    hours: quantity(x.hours || 0),
    hourRate: Number(x.hourRate || 0),
    extras: Number(x.extras || 0),
    markupPercent: percentage(x.markupPercent || 0),
    taxPercent: percentage(x.taxPercent || 0),
    lines: x.lines.map(r => ({
      label: String(r.label || '').slice(0,130),
      quantity: quantity(r.quantity || 0),
      unitPrice: Number(r.unitPrice || 0)
    }))
  };
  computeQuote(clean);
  return clean;
}

// Keep the printed budget auditable: the sum of visible line amounts equals
// the same cent-based total used by the calculator and CSV export.
export function printableBreakdown(quote) {
  const totals = computeQuote(quote);
  const rows = (quote.lines || []).map(line => {
    const qty = quantity(line.quantity);
    const unitCents = cents(line.unitPrice);
    return {label: String(line.label ?? ''), qty, unitCents, amountCents: Math.round(qty * unitCents)};
  });
  const hours = quantity(quote.hours || 0);
  if (hours > 0) rows.push({label:'Mano de obra (horas)', qty:hours,
    unitCents:cents(quote.hourRate || 0), amountCents:totals.labor});
  if (totals.extras) rows.push({label:'Otros gastos', qty:null, unitCents:null, amountCents:totals.extras});
  if (totals.markup) rows.push({label:`Recargo (${percentage(quote.markupPercent || 0)}%)`,
    qty:null, unitCents:null, amountCents:totals.markup});
  if (totals.tax) rows.push({label:`Impuesto opcional (${percentage(quote.taxPercent || 0)}%)`,
    qty:null, unitCents:null, amountCents:totals.tax});
  return {rows, totals};
}

// Keep shared WhatsApp/copy summaries aligned with the calculator, CSV and print.
export function quoteSummary(quote) {
  const total = computeQuote(quote);
  return [
    'Cotización: ' + (quote.title || 'Sin título'),
    ...(quote.client ? ['Cliente: ' + quote.client] : []),
    ...quote.lines.map(line => {
      const unitCents = cents(line.unitPrice);
      const lineCents = Math.round(quantity(line.quantity) * unitCents);
      return line.label + ': ' + line.quantity + ' x ' + pen(unitCents) + ' = ' + pen(lineCents);
    }),
    'Mano de obra: ' + pen(total.labor),
    'Otros gastos: ' + pen(total.extras),
    'Recargo: ' + pen(total.markup),
    'Impuesto opcional: ' + pen(total.tax),
    'TOTAL: ' + pen(total.total),
    ...(quote.notes ? ['Condiciones: ' + quote.notes] : []),
    'Cotización referencial; no es factura ni comprobante SUNAT.'
  ].join('\n');
}
