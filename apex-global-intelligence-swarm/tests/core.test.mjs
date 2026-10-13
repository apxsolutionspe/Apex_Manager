import test from 'node:test';import assert from 'node:assert/strict';
import {safeText,safeUrl,allowedSource,normalize,classify,score,dedupeKey,validateSecret,csv} from '../core.js';
test('sanitiza datos externos',()=>{assert.equal(safeText('<b>Hola</b>'), 'Hola');assert.equal(safeUrl('javascript:alert(1)'),null)});
test('acceso a fuentes permitidas',()=>{assert.equal(allowedSource('https://api.github.com/search/issues'),true);assert.equal(allowedSource('https://169.254.169.254'),false)});
test('normaliza issues y rechaza enlace ajeno',()=>{assert.equal(normalize('github',{items:[{id:1,title:'Bounty',html_url:'https://evil.com/x'}]}).length,0);assert.equal(normalize('github',{items:[{id:1,title:'Bounty',html_url:'https://github.com/a/b/issues/2',state:'open'}]}).length,1)});
test('puntaje finito 0..100',()=>{const x={title:'bounty grant prize',evidence:'reward',api_open:true,engagement:100,source_created_at:'2026-10-12T00:00:00Z'};const p=score(x,['bounty','grant'],Date.parse('2026-10-13T00:00:00Z'));assert.ok(p>=0&&p<=100);assert.equal(p,score(x,['bounty','grant'],Date.parse('2026-10-13T00:00:00Z')))});
test('deduplicacion tracking',()=>assert.equal(dedupeKey('https://x.org/a/?utm_id=1#b'),dedupeKey('https://x.org/a')));
test('detecta secretos',()=>assert.equal(validateSecret('password: ABCD'),'Posible secreto'));
test('previene formulas en export CSV',()=>assert.ok(csv([{x:'=SUM(A1:A2)'}]).includes("'=SUM")));
