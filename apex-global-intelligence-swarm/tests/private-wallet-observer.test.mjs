import test from 'node:test';import assert from 'node:assert/strict';
import {validEvmAddress,parseRpcBalance,compareNativeBalances,examineRecentNativeBalance} from '../scripts/private-wallet-observer.mjs';
const account='0x'+'c'.repeat(40);
test('Private address validation rejects non-EVM inputs',()=>{
 assert.equal(validEvmAddress(account),true);assert.equal(validEvmAddress('0xshort'),false);
 assert.throws(()=>parseRpcBalance('NaN'));
});
test('Native balance classification cannot imply a reward',()=>{
 assert.equal(compareNativeBalances(100n,200n),'balance_increase_observed');
 assert.equal(compareNativeBalances(200n,100n),'balance_decrease_observed');
 assert.equal(compareNativeBalances(200n,200n),'unchanged');
 assert.throws(()=>compareNativeBalances(-1n,0n));
});
test('Native comparison queries finalized blocks only and never signs transactions',async()=>{
 const calls=[];
 const fetcher=async(_,opts)=>{
  const payload=JSON.parse(opts.body);calls.push(payload);
  const value=payload.method==='eth_getBlockByNumber'?{number:'0x3e8'}:payload.params[1]==='0x3e8'?'0xa':'0x5';
  return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:value})};
 };
 const status=await examineRecentNativeBalance(account,{fetcher,lookbackBlocks:100});
 assert.equal(status,'balance_increase_observed');
 assert.deepEqual(calls.map(x=>x.method),['eth_getBlockByNumber','eth_getBalance','eth_getBalance']);
 assert.deepEqual(calls[2].params,[account,'0x384']);
});
test('No historical state is reported as unavailable, not as income',async()=>{
 const fetcher=async(_,opts)=>{
  const x=JSON.parse(opts.body);
  if(x.method==='eth_getBlockByNumber')return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:{number:'0x3e8'}})};
  if(x.params[1]==='0x3e8')return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:'0x0'})};
  return {ok:false};
 };
 assert.equal(await examineRecentNativeBalance(account,{fetcher,lookbackBlocks:100}),'historical_state_unavailable');
});
