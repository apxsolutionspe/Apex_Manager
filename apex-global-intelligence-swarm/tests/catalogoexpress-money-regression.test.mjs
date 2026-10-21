import test from 'node:test';
import assert from 'node:assert/strict';
import {cents, createBackup, restoreBackup} from '../productos/catalogoexpress/core.mjs';

test('PEN prices preserve exact centavos at legal two-decimal precision', () => {
  assert.equal(cents('0.29'), 29);
  assert.equal(cents('19.99'), 1999);
  assert.equal(cents('1000000.00'), 100000000);
});

test('backups preserve a price of 19.99 PEN without floating point drift', () => {
  const data={name:'Comercio de prueba',phone:'51912345678',items:[{title:'Artículo',price:'19.99'}]};
  assert.equal(restoreBackup(createBackup(data)).items[0].price, '19.99');
});
