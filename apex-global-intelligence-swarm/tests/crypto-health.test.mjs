import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeResearch} from '../scripts/crypto-health.mjs';
const now=new Date('2026-10-15T20:00:00Z');
const snapshot=()=>({schema:'apex-crypto-discovery-v1',generated_at:'2026-10-15T19:00:00Z',
 stats:{native_classifier_used:true,verified_deposits:0,confirmed_eligible:0},
 sources:[
  {id:'good',result:'read',candidate_count:2},
  {id:'blocked',result:'http_403',candidate_count:0},
  {id:'long',result:'size_limit',candidate_count:0},
  {id:'bad',result:'network_or_redirect_error',candidate_count:0}
 ],
 opportunities:[
  {title:'Airdrop notice',claimed:false,reward_received:false,review_group:'unverified_no_capital_evidence'},
  {title:'Trade to earn',claimed:false,reward_received:false,review_group:'capital_or_trading'},
  {title:'Old grants',claimed:false,reward_received:false,review_group:'historical_reference'}
 ]});
test('Source reliability and provenance reporting does not require a wallet',()=>{
 const d=summarizeResearch(snapshot(),{now});
 assert.equal(d.health.sources_configured,4);
 assert.equal(d.health.sources_read,1);
 assert.equal(d.health.failure_types.access_denied,1);
 assert.equal(d.health.failure_types.size_limit,1);
 assert.equal(d.health.failure_types.network_failure,1);
 assert.equal(d.health.source_report_age_hours,1);
 assert.equal(JSON.stringify(d).includes('APEX_WALLET_ADDRESS'),false);
});
test('No amount of announcements may be reported as actual earnings',()=>{
 const d=summarizeResearch(snapshot(),{now});
 assert.equal(d.triage.announcements_seen,3);
 assert.equal(d.triage.research_candidates_without_obvious_capital_keywords,1);
 assert.equal(d.triage.independently_verified_free_rewards,0);
 assert.equal(d.triage.verified_received_rewards,0);
 assert.equal(d.triage.verified_income_usd,0);
});
test('Fail closed on unsupported announcements marked received',()=>{
 const evidence=snapshot();
 evidence.opportunities[0].reward_received=true;
 assert.throws(()=>summarizeResearch(evidence,{now}),/cannot declare receipt/);
});
test('Reject unexpected categories and invalid source schema',()=>{
 const evidence=snapshot();
 evidence.opportunities[0].review_group='claimed_free_reward';
 assert.throws(()=>summarizeResearch(evidence,{now}),/category/);
 assert.throws(()=>summarizeResearch({schema:'other'},{now}),/Invalid discovery/);
});
test('Source warnings are factual, not fake uptime or capability guarantees',()=>{
 const evidence=snapshot();evidence.sources[1].result='http_503';
 const d=summarizeResearch(evidence,{now});
 assert.equal(d.health.failure_types.upstream_error,1);
 assert.equal(d.health.failure_types.access_denied,0);
 assert.match(d.automation,/scheduled/);
});