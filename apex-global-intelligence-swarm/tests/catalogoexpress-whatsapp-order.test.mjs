import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildPage } from '../productos/catalogoexpress/core.mjs';

// Exercise the script embedded in the *downloaded* standalone HTML, not
// just the catalog builder. This catches escaped-newline and URL regressions.
test('exported catalog sends a multiline WhatsApp order with correct recipient', () => {
  const html = buildPage({
    name: 'Negocio de prueba',
    phone: '912345678',
    items: [{title: 'Servicio de prueba', description: 'Ejemplo', price: '12.50'}]
  });
  const script = html.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];
  assert.ok(script, 'the portable HTML must contain the order script');

  const element = () => ({
    handlers: {},
    append() {},
    replaceChildren() {},
    setAttribute() {},
    addEventListener(type, handler) { this.handlers[type] = handler; }
  });
  const add = element();
  add.dataset = { add: '0' };
  const send = element();
  const nodes = { cart: element(), total: element(), send };
  const document = {
    getElementById(id) { return nodes[id]; },
    querySelectorAll() { return [add]; },
    createElement() { return element(); }
  };
  let opened;
  vm.runInNewContext(script, {
    document, Intl, Map, encodeURIComponent,
    window: { open(...args) { opened = args; } }
  });

  assert.equal(send.disabled, true, 'an empty cart cannot be sent');
  add.handlers.click();
  add.handlers.click();
  assert.equal(send.disabled, false);
  send.handlers.click();

  assert.ok(opened, 'the buyer must explicitly initiate the order');
  const url = new URL(opened[0]);
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/51912345678');
  const message = url.searchParams.get('text');
  assert.ok(message.includes('\n'), 'order lines must contain real newlines');
  assert.equal(message.includes('\\n'), false, 'must not contain literal backslash-n');
  assert.match(message, /2 × Servicio de prueba/);
  assert.match(message, /Total referencial:/);
  assert.equal(opened[1], '_blank');
  assert.equal(opened[2], 'noopener,noreferrer');
});
