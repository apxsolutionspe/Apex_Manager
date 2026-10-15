import test from 'node:test';
import assert from 'node:assert/strict';
import {VERIFIED_ANNOUNCEMENTS,evaluateLead,createReport} from '../scripts/crypto-direct-leads.mjs';
const lead=VERIFIED_ANNOUNCEMENTS[0];
test('Only issuer official URL and specific October 2026 offer recorded',()=>{
 assert.equal(lead.official_url,'https://www.binance.com/en/square/post/372547852237367');
 assert.equal(lead.monthly_cap,5000);
 assert.equal(lead.automatic_claim_supported,false);
 assert.equal(lead.wallet_transfer_supported,false);
});
test('Older Binance account is not eligible for this new-user campaign',()=>{
 const v=evaluateLead(lead,{asOf:new Date('2026-10-15T20:00:00Z'),registration:'2026-09-30T00:00:00Z',kyc:true,eligibleCountry:true});
 assert.equal(v.status,'registration_ineligible');assert.equal(v.may_claim,false);
});
test('Even an apparently eligible account needs quota, quiz and issuer confirmation',()=>{
 const v=evaluateLead(lead,{asOf:new Date('2026-10-15T20:00:00Z'),registration:'2026-10-12T00:00:00Z',kyc:true,eligibleCountry:true});
 assert.equal(v.status,'quota_and_issuer_confirmation_pending');assert.equal(v.may_claim,false);
});
test('Regional access and identity cannot be inferred or bypassed',()=>{
 assert.equal(evaluateLead(lead,{asOf:new Date('2026-10-15T20:00:00Z'),eligibleCountry:false}).status,'region_not_eligible');
 assert.equal(evaluateLead(lead,{asOf:new Date('2026-10-15T20:00:00Z')}).status,'personal_eligibility_pending');
});
test('Public dashboard cannot turn conditional offer into wallet income',()=>{
 const r=createReport({asOf:new Date('2026-10-15T20:00:00Z')});
 assert.equal(r.data.length,0);
 assert.equal(r.summary.excluded_new_account_only,1);
 assert.equal(r.summary.actionable_research_candidates,0);
 assert.equal(r.summary.verified_income_usd,0);
 assert.equal(r.summary.received_tokens,0);
 assert.equal(r.summary.automatically_claimable,0);
 assert(r.data.every(x=>x.may_claim===false));
});

test('Historical new-account offers may be inspected but not added to the default shortlist',()=>{
 const date=new Date('2026-10-15T20:00:00Z');
 const shown=createReport({asOf:date,includeNewUserOnly:true});
 assert.equal(shown.data.length,1);
 assert.equal(shown.data[0].may_claim,false);
 assert.equal(shown.summary.excluded_new_account_only,0);
 assert.equal(createReport({asOf:date}).data.length,0);
});
test('Generated public feed does not contain private Binance registration details',()=>{
 const report=createReport({asOf:new Date('2026-10-15T20:00:00Z')});
 const serialized=JSON.stringify(report);
 assert.equal(serialized.includes('registration_ineligible'),false);
 assert.equal(serialized.includes('kyc:'),false);
 assert.equal(report.summary.verified_income_usd,0);
});
