import test from 'node:test';import assert from 'node:assert/strict';
import {SOURCES,permittedPage,findRelevantLinks,discover,reviewPriority} from '../scripts/crypto-discovery.mjs';
test('Official announcement paths only',()=>{
 assert.equal(permittedPage('https://www.binance.com/en/support/announcement/detail/1234567890abcdef1234567890abcdef'),true);
 assert.equal(permittedPage('https://www.binance.com.evil.com/en/support/announcement/detail/1234567890abcdef1234567890abcdef'),false);
 assert.equal(permittedPage('http://www.binance.com/en/support/announcement/detail/1234567890abcdef1234567890abcdef'),false);
 assert.equal(permittedPage('https://evil.com/giveaway'),false);
});
test('Finds reward headline but does not claim reward',()=>{
 const html='<a href="/en/support/announcement/detail/1234567890abcdef1234567890abcdef">New Airdrop campaign</a>';
 const arr=findRelevantLinks(html,SOURCES[0]);
 assert.equal(arr.length,1);assert.equal(arr[0].claimed,false);assert.equal(arr[0].reward_received,false);
});
test('Same official link is not duplicated',()=>{
 const html='<a href="/en/support/announcement/detail/1234567890abcdef1234567890abcdef">Airdrop reward</a>'.repeat(3);
 assert.equal(findRelevantLinks(html,SOURCES[0]).length,1);
});
test('Explicit purchase requirements are flagged, not treated as free',()=>{
 const html='<a href="/en/support/announcement/detail/1234567890abcdef1234567890abcdef">Trade to win airdrop rewards</a>';
 assert.equal(findRelevantLinks(html,SOURCES[0])[0].screening,'requires_capital_or_activity_review');
});
test('Remote sources are checked in parallel without exposing accounts',async()=>{
 const html='<a href="/en/support/announcement/detail/1234567890abcdef1234567890abcdef">Airdrop campaign</a>';
 const d=await discover({sources:[SOURCES[0],SOURCES[0]],fetcher:async()=>({ok:true,headers:{get:()=>''},text:async()=>html})});
 assert.equal(d.stats.official_pages_checked,2);assert.equal(d.stats.candidate_announcements,1);
 assert.equal(d.stats.confirmed_eligible,0);assert.equal(d.stats.verified_deposits,0);
});
test('Fail-closed on source failures',async()=>{
 const d=await discover({sources:SOURCES.slice(0,1),fetcher:async()=>{throw Error('no network')}});
 assert.equal(d.stats.candidate_announcements,0);assert.equal(d.sources[0].result,'network_or_redirect_error');
});

test('Kraken category navigation is not a reward candidate',()=>{
 assert.equal(permittedPage('https://blog.kraken.com/category/product/promotions'),false);
 const html='<a href="/category/product/promotions">Promotions</a>';
 assert.equal(findRelevantLinks(html,SOURCES.find(x=>x.id==='kraken-blog')).length,0);
});

test('Official DeFi article URLs are allowed but spoofed links are not',()=>{
 assert.equal(permittedPage('https://blog.uniswap.org/official-airdrop'),true);
 assert.equal(permittedPage('https://aave.com/blog/official-grants-program'),true);
 assert.equal(permittedPage('https://optimism.io/blog/rewards'),true);
 assert.equal(permittedPage('https://gov.optimism.io/t/airdrop-eligibility/1234'),true);
 assert.equal(permittedPage('https://gov.uniswap.org/t/grants-program/1234'),true);
 assert.equal(permittedPage('https://blog.uniswap.org.attacker.test/fake-airdrop'),false);
 assert.equal(permittedPage('https://blog.kraken.com/category/product/promotions'),false);
});
test('DeFi yield is flagged as requiring capital; grants require a human review',()=>{
 const a=findRelevantLinks('<a href="/blog/defi-airdrop">Airdrop rewards require yield deposits</a>',SOURCES.find(s=>s.id==='aave-defi'));
 assert.equal(a[0].screening,'requires_capital_or_activity_review');
 const b=findRelevantLinks('<a href="/blog/ecosystem-grants">Ecosystem grants and funding</a>',SOURCES.find(s=>s.id==='aave-defi'));
 assert.equal(b[0].screening,'manual_action_or_conditions');
});
test('Discovery never exceeds four simultaneous network requests',async()=>{
 let active=0,peak=0;
 const sources=Array.from({length:13},()=>SOURCES[0]);
 const output=await discover({sources,fetcher:async()=>{
  active++;peak=Math.max(peak,active);
  await new Promise(resolve=>setTimeout(resolve,5));
  active--;
  return {ok:true,headers:{get:()=>''},text:async()=>'<html></html>'};
 }});
 assert(peak<=4);assert(peak>=2);
 assert.equal(output.stats.official_pages_checked,13);
 assert.equal(output.stats.candidate_announcements,0);
});

test('The source-memory distinguishes newly detected announcements across scans',async()=>{
 const html='<a href="/en/support/announcement/detail/1234567890abcdef1234567890abcdef">Official airdrop rewards</a>';
 const fetcher=async()=>({ok:true,headers:{get:()=>''},text:async()=>html});
 const first=await discover({sources:[SOURCES[0]],fetcher,now:new Date('2026-10-15T11:00:00Z')});
 assert.equal(first.stats.new_candidate_count,1);
 assert.equal(first.opportunities[0].new_candidate,true);
 const second=await discover({sources:[SOURCES[0]],fetcher,now:new Date('2026-10-15T12:00:00Z'),previous:first});
 assert.equal(second.stats.new_candidate_count,0);
 assert.equal(second.opportunities[0].new_candidate,false);
 assert.equal(second.opportunities[0].observations,2);
 assert.equal(second.opportunities[0].first_seen_at,first.generated_at);
 assert.equal(second.stats.confirmed_eligible,0);
});
test('Rejects incompatible prior history instead of losing evidence',async()=>{
 await assert.rejects(discover({sources:[],previous:{schema:'wrong'}}),/history invalid/);
});

test('New official Ethereum, Base and Gitcoin destinations are restricted',()=>{
 assert.equal(SOURCES.length,17);
 assert.equal(permittedPage('https://blog.ethereum.org/2025/11/03/new-esp-grants'),true);
 assert.equal(permittedPage('https://www.base.org/blog/2026-mission-vision-and-strategy'),true);
 assert.equal(permittedPage('https://gitcoin.co/blog/announcing-gitcoin-grants-24'),true);
 assert.equal(permittedPage('https://blog.base.org/tokenized-stocks'),true);
 assert.equal(permittedPage('https://blog.ethereum.org.attacker.invalid/fake-grant'),false);
 assert.equal(permittedPage('http://gitcoin.co/blog/airdrop'),false);
 assert.equal(permittedPage('https://www.base.org/blog/../../admin'),false);
});
test('Historical and capital-dependent leads cannot rank as free earnings',()=>{
 const at=new Date('2026-10-15T00:00:00Z');
 assert.equal(reviewPriority({title:'2024 airdrop rewards',screening:'eligibility_not_verified'},at).score,0);
 assert.equal(reviewPriority({title:'Deposit ETH to win airdrop',screening:'requires_capital_or_activity_review'},at).score,0);
 assert.equal(reviewPriority({title:'Enter your seed phrase',screening:'security_warning'},at).score,0);
 assert.equal(reviewPriority({title:'2026 token airdrop announcement',screening:'eligibility_not_verified'},at).group,'unverified_no_capital_evidence');
});
test('Research priority never asserts eligibility or received crypto',async()=>{
 const html='<a href="/en/support/announcement/detail/1234567890abcdef1234567890abcdef">New airdrop rewards</a>';
 const data=await discover({sources:[SOURCES[0]],fetcher:async()=>({ok:true,headers:{get:()=>''},text:async()=>html})});
 assert.equal(data.opportunities[0].review_priority,20);
 assert.equal(data.opportunities[0].claimed,false);
 assert.equal(data.opportunities[0].reward_received,false);
 assert.equal(data.stats.confirmed_eligible,0);
 assert.equal(data.stats.verified_deposits,0);
});

test('Airdrop allocation governance proposals cannot be mistaken for claimable tokens',()=>{
 const when=new Date('2026-10-15T00:00:00Z');
 const governance=reviewPriority({title:'Re-designating the User Airdrop Allocation as the Strategic Ecosystem Fund',screening:'eligibility_not_verified'},when);
 assert.equal(governance.group,'informational_not_passive');
 assert.equal(governance.score,2);
 const technical=reviewPriority({title:'Aave V4 New Liquidation Engine incentives',screening:'eligibility_not_verified'},when);
 assert.equal(technical.group,'informational_not_passive');
 assert.equal(technical.score,2);
});
