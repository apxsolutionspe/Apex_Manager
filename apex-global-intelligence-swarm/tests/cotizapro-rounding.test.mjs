import test from 'node:test';
import assert from 'node:assert/strict';
import { cents, computeQuote, quoteCsv } from '../productos/cotizapro/core.mjs';

test('decimal half-cent ties are rounded consistently in totals and CSV', () => {
  assert.equal(cents('10.075'), 1008);
  assert.equal(cents(1.005), 101);
  assert.equal(cents('9999999.995'), 1000000000);
  assert.equal(cents(1e-7), 0);
  const quote = {
    lines: [{label: 'Servicio', quantity: 1, unitPrice: '10.075'}],
    hours: 0, hourRate: 0, extras: 0, markupPercent: 0, taxPercent: 0,
  };
  assert.equal(computeQuote(quote).materials, 1008);
  assert.ok(quoteCsv(quote).includes('"Servicio","1","10.08","10.08"'));
});
