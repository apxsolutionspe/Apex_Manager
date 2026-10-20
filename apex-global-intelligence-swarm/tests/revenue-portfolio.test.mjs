import test from 'node:test';
import assert from 'node:assert/strict';
import {SOFTWARE_OFFERS,CUSTOMER_SEGMENTS,makePortfolio,assessPublicBounty,buildReport}
  from '../scripts/revenue-portfolio.mjs';

const at=new Date('2026-10-20T17:30:00Z');
const record={
 url:'https://github.com/real-team/product/issues/17',
 title:'Bounty $75: implement safe CSV export',
 published_amount_usd:75,
 source_created_at:'2026-10-19T11:00:00Z',
 evidence:'Issue open and code sample available. Rules must be verified with sponsor.'
};

test('120 hypotheses are unique combinations, not paid clients or independent agents',()=>{
 const portfolio=makePortfolio();
 assert.equal(SOFTWARE_OFFERS.length,10);
 assert.equal(CUSTOMER_SEGMENTS.length,12);
 assert.equal(portfolio.length,120);
 assert.equal(new Set(portfolio.map(x=>x.id)).size,120);
 assert.ok(portfolio.every(x=>x.idea_only&&x.buyer_interest_verified===false));
 assert.ok(portfolio.every(x=>x.payer_connected_verified===false&&x.received_amount_pen===0));
 assert.ok(portfolio.every(x=>x.prototype_url.startsWith('https://apxsolutionspe.github.io/Apex_Manager/')));
 assert.equal(makePortfolio({max:8}).length,8);
 assert.throws(()=>makePortfolio({max:121}));
});

test('unfunded proposals, circular mirrors, costly tasks and nonissue URLs are rejected',()=>{
 assert.equal(assessPublicBounty({...record,title:'[Bounty proposal] fix code ($50 proposed)'},at).stage,'not_funded_or_merely_proposed');
 assert.equal(assessPublicBounty({...record,evidence:'Reward pending funding and approval'},at).suitability,'reject_unconfirmed_promise');
 assert.equal(assessPublicBounty({...record,url:'https://github.com/bounty-plaza/list/issues/90'},at),null);
 assert.equal(assessPublicBounty({...record,url:'https://example.com/issue/17'},at),null);
 assert.equal(assessPublicBounty({...record,advertised_usd_unverified:0,published_amount_usd:null},at),null);
 assert.equal(assessPublicBounty({...record,evidence:'pay to join first'},at),null);
 assert.equal(assessPublicBounty({...record,source_created_at:'2022-01-01T00:00:00Z'},at),null);
});

test('advertised amount never becomes funded income or a verified customer',()=>{
 const result=assessPublicBounty(record,at);
 assert.ok(result);
 assert.equal(result.advertised_usd_unverified,75);
 assert.equal(result.funded_reward_verified,false);
 assert.equal(result.received_income_usd,0);
 assert.equal(result.sponsor_verified,false);
 assert.equal(result.suitability,'investigate_original_terms');
});

test('report transparently distinguishes research, likely leads and verified receipts',()=>{
 const report=buildReport({
  at,archive:{items:[record,{...record,url:'https://github.com/real-team/product/issues/18',
   title:'Bounty proposal $200: fix parser'}]}
 });
 assert.equal(report.summary.product_market_hypotheses,120);
 assert.equal(report.summary.public_records_evaluated,2);
 assert.equal(report.summary.public_issue_candidates_requiring_primary_verification,1);
 assert.equal(report.summary.funded_jobs_verified,0);
 assert.equal(report.summary.verified_new_income_pen,0);
 assert.equal(report.summary.verified_new_income_usd,0);
 assert.match(report.protections.join(' '),/120 combinaciones son ideas comerciales/);
 assert.equal(report.ideas.length,120);
});
