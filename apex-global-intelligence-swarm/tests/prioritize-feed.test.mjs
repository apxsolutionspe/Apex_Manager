import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySignal,buildPrioritized} from '../scripts/prioritize-feed.mjs';
const now=Date.parse('2026-10-14T12:00:00Z');
const sample={source:'github',title:'[Bounty] Fix TypeScript web app $200',url:'https://github.com/acme/project/issues/20',
  link_check:'issue_abierto_segun_api',source_created_at:'2026-10-12T10:00:00Z',evidence:'This issue is part of the $200 bounty pool. See https://github.com/acme/project/blob/main/BOUNTY.md before submitting. Payouts are conditional on accepted work and code review. This is a real software development task.'};
test('Prioriza issue técnico abierto sin afirmar pago',()=>{
 const x=classifySignal(sample,now);assert.equal(x.status,'investigar');assert.equal(x.checks.payment,false);assert.equal(x.published_amount_usd,200);
});
test('Cifra falsa gigantesca es descartada',()=>assert.equal(classifySignal({...sample,title:'[Bounty] $99999999999999 FREE MONEY'},now).status,'descartar'));
test('No admite reclamo de criptomonedas aparentemente perdidas',()=>assert.equal(classifySignal({...sample,title:'Claim abandoned wallet funds now'},now).status,'descartar'));
test('No prioriza programas cerrados',()=>assert.equal(classifySignal({...sample,title:'Bounty program suspended'},now).status,'descartar'));
test('No prioriza títulos repetitivos',()=>assert.equal(classifySignal({...sample,title:'[Bounty] [Bounty] [Bounty] $200'},now).status,'descartar'));
test('HN no equivale a issue verificado',()=>assert.equal(classifySignal({...sample,source:'hackernews',link_check:'formato_url_valido'},now).status,'informativa'));
test('Señales antiguas quedan informativas',()=>assert.equal(classifySignal({...sample,source_created_at:'2025-01-01T00:00:00Z'},now).status,'informativa'));
test('No inventa cobros ni acredita derechos',()=>{
 const a=buildPrioritized({schema:'apex-public-archive-v1',items:[sample]},{now});assert.equal(a.summary.verified_income_usd,0);
 assert.equal(a.items[0].monetary_value_received,0);assert.equal(a.items[0].checks.eligibility,false);
});
test('Schema inválido falla de manera explícita',()=>assert.throws(()=>buildPrioritized({schema:'x',items:[]},{now}),/no válido/));
test('Todos los items evaluados pero salida limitada',()=>{
 const a=buildPrioritized({schema:'apex-public-archive-v1',items:Array.from({length:20},(_,i)=>({...sample,url:'https://github.com/acme/project/issues/'+i}))},{now,maxItems:4});
 assert.equal(a.summary.total_evaluated,20);assert.equal(a.items.length,4);
});

test('A word bounty in a development discussion is not a payable offer',()=>assert.equal(classifySignal({...sample,title:'How to build bounty templates',evidence:'Documentation of an internal product feature; no reward offered.'},now).status,'informativa'));
