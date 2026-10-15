import test from 'node:test';import assert from 'node:assert/strict';
import {SOURCES,permittedPage,findRelevantLinks,discover} from '../scripts/crypto-discovery.mjs';
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
