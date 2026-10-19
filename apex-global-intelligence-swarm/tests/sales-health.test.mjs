import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectTarget,monitorSales,TARGETS} from '../scripts/sales-health.mjs';

function fakeResponse(html,{status=200,type='text/html; charset=utf-8'}={}) {
 return {ok:status>=200&&status<300,status,headers:{get:()=>type},text:async()=>html};
}
test('three commercial contact channels checked independently and in parallel',async()=>{
 let requests=0;
 const monitored=await monitorSales({now:new Date('2026-10-19T18:30:00Z'),
 fetcher:async(url,init)=>{
    requests++;
    assert.equal(init.redirect,'follow');
    const target=TARGETS.find(x=>x.url===url);
    return fakeResponse(target.required.join('\n'));
 }});
 assert.equal(requests,3);
 assert.equal(monitored.results.length,3);
 assert.equal(monitored.healthy,true);
 assert.equal(monitored.payments_verified,false);
});
test('missing lead conversion link is considered unhealthy',async()=>{
 const outcome=await inspectTarget(TARGETS[0],{
  fetcher:async()=>fakeResponse('APEX PRIME X')});
 assert.equal(outcome.online,true);
 assert.equal(outcome.commercial_contact_ok,false);
 assert.equal(outcome.reason,'missing_required_conversion_elements');
});
test('public endpoint failures are bounded and do not block other checks',async()=>{
 const outcome=await monitorSales({
 fetcher:async url => url.includes('servicios.html')?
  fakeResponse('',{status:503}):fakeResponse(TARGETS[1].required.join('\n'))
 });
 assert.equal(outcome.healthy,false);
 assert.equal(outcome.results[0].http_status,503);
 assert.equal(outcome.results[1].commercial_contact_ok,true);
});
test('rejects inappropriate response types and network failures',async()=>{
 const type=await inspectTarget(TARGETS[0],{fetcher:async()=>fakeResponse('x',{type:'application/json'})});
 assert.equal(type.reason,'unexpected_content_type');
 const broken=await inspectTarget(TARGETS[0],{fetcher:async()=>{throw Error('offline')}});
 assert.equal(broken.reason,'network_unavailable');
});
