import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHandoff,continuityPrompt} from '../scripts/apex-handoff.mjs';
function fixtures(){
 return {
  discovery:{schema:'apex-crypto-discovery-v1',generated_at:'2026-10-15T20:00:00Z',
   stats:{candidate_announcements:51,new_candidate_count:0,confirmed_eligible:0,verified_deposits:0},
   opportunities:[{title:'SECRET SHOULD NOT APPEAR',address:'0x'+'a'.repeat(40)}]},
  health:{schema:'apex-crypto-health-v1',generated_at:'2026-10-15T20:00:00Z',
   health:{sources_configured:24,sources_read:16},
   triage:{verified_income_usd:0}},
  leads:{schema:'apex-direct-crypto-leads-v1',generated_at:'2026-10-15T20:00:00Z',
   summary:{personally_eligible_verified:0,verified_income_usd:0}},
  crypto:{schema:'apex-crypto-watch-v1',economics:{verified_income_usd:0}}
 };
}
test('Public snapshot preserves source counts and does not expose addresses or sensitive raw inputs',()=>{
 const f=fixtures();
 const result=buildHandoff({...f,now:new Date('2026-10-15T21:00:00Z')});
 assert.equal(result.schema,'apex-project-handoff-v1');
 assert.equal(result.state.sources_configured,24);
 assert.equal(result.state.sources_read,16);
 assert.equal(result.state.announcements_for_review,51);
 assert.equal(result.state.verified_income_usd,0);
 const exported=JSON.stringify(result);
 assert.equal(exported.includes('0x'+'a'.repeat(40)),false);
 assert.equal(exported.includes('SECRET SHOULD NOT APPEAR'),false);
 assert.match(exported,/APEX_CONTINUIDAD/);
});
test('Never fabricate verified income and eligibility',()=>{
 const f=fixtures();f.crypto.economics.verified_income_usd=1;
 assert.throws(()=>buildHandoff(f),/Unverified financial/);
 const e=fixtures();e.leads.summary.personally_eligible_verified=1;
 assert.throws(()=>buildHandoff(e),/Unverified financial/);
});
test('Invalid source counts or schemas fail closed',()=>{
 const f=fixtures();f.health.health.sources_read=25;
 assert.throws(()=>buildHandoff(f),/Invalid public research counters/);
 const v=fixtures();v.discovery.schema='wrong';
 assert.throws(()=>buildHandoff(v),/invalid public feeds/);
});
test('New-chat instructions keep verification and no transfer constraints',()=>{
 const text=continuityPrompt();
 assert.match(text,/APEX_CONTINUIDAD/);
 assert.match(text,/apex-handoff\.json/);
 assert.match(text,/no firmes transacciones/);
});
