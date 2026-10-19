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
  return Math.round((n + Number.EPSILON) * 100);
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
  const rows = [['Concepto', 'Cantidad', 'Precio unitario PEN'], ...quote.lines.map(x => [
    x.label, x.quantity, x.unitPrice
  ])];
  rows.push(['Total PEN', '', (computeQuote(quote).total / 100).toFixed(2)]);
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
