import test from 'node:test';
import assert from 'node:assert/strict';
import {TOKEN_CONTRACTS,TRANSFER_TOPIC,validAddress,paddedAddress,classifyTransferLogs,inspectRecentErc20} from '../scripts/erc20-watch.mjs';
const account='0x'+'a'.repeat(40),origin='0x'+'b'.repeat(40);
const evt=(changes={})=>({address:TOKEN_CONTRACTS.USDC,topics:[TRANSFER_TOPIC,paddedAddress(origin),paddedAddress(account)],data:'0x'+'0'.repeat(63)+'a',removed:false,...changes});
test('Canonical 20-byte EVM recipient only',()=>{
 assert.equal(validAddress(account),true);
 assert.equal(validAddress('0x1234'),false);
 assert.equal(paddedAddress(account).length,66);
 assert.throws(()=>paddedAddress('bad'),/address/i);
});
test('Allowlisted ERC-20 incoming transfer event detected without valuation',()=>{
 const res=classifyTransferLogs([evt()],account);
 assert.equal(res.qualifyingIncomingEvents,1);
 assert.match(res.note,/does not prove/i);
});
test('Ignore arbitrary contracts, self-transfers, zero amounts, removed and outgoing events',()=>{
 const invalid=[
  evt({address:origin}),evt({topics:[TRANSFER_TOPIC,paddedAddress(account),paddedAddress(account)]}),
  evt({data:'0x'+'0'.repeat(64)}),evt({removed:true}),
  evt({topics:[TRANSFER_TOPIC,paddedAddress(origin),paddedAddress(origin)]}),
  evt({topics:['0x'+'f'.repeat(64),paddedAddress(origin),paddedAddress(account)]})
 ];
 assert.equal(classifyTransferLogs(invalid,account).qualifyingIncomingEvents,0);
});
test('Ethereum RPC only requests eth_getBlockByNumber and read-only eth_getLogs',async()=>{
 const methods=[];
 const fetcher=async(_,request)=>{
  const query=JSON.parse(request.body);methods.push(query);
  if(query.method==='eth_getBlockByNumber')return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:{number:'0x3e8'}})};
  if(query.method==='eth_getLogs')return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:[evt()]})};
  throw Error('Unexpected RPC method');
 };
 const result=await inspectRecentErc20(account,{fetcher,blocks:100});
 assert.equal(result.qualifyingIncomingEvents,1);
 assert.deepEqual(methods.map(x=>x.method),['eth_getBlockByNumber','eth_getLogs']);
 assert.equal(methods[1].params[0].fromBlock,'0x384');
 assert.equal(methods[1].params[0].toBlock,'0x3e8');
 assert.equal(methods[1].params[0].topics[2],paddedAddress(account));
});
test('RPC errors cannot be converted into fake receipts',async()=>{
 await assert.rejects(inspectRecentErc20(account,{fetcher:async()=>({ok:false})}),/unavailable/);
 await assert.rejects(inspectRecentErc20('not-an-address'),/address/i);
 await assert.rejects(inspectRecentErc20(account,{blocks:999999}),/lookback/);
});
test('Do not accept more than 1000 events in bounded analysis',()=>{
 assert.throws(()=>classifyTransferLogs(Array(1001).fill(evt()),account),/Invalid log data/);
});

test('Watchlist covers five verified Ethereum ERC-20 contracts only',()=>{
 assert.deepEqual(Object.keys(TOKEN_CONTRACTS).sort(),['DAI','LINK','UNI','USDC','USDT']);
 assert.equal(new Set(Object.values(TOKEN_CONTRACTS)).size,5);
 for(const contract of Object.values(TOKEN_CONTRACTS))assert.equal(validAddress(contract),true);
});
test('DAI, LINK and UNI incoming events are recognized without valuing or claiming tokens',()=>{
 for(const key of ['DAI','LINK','UNI']){
  const observation=classifyTransferLogs([evt({address:TOKEN_CONTRACTS[key]})],account);
  assert.equal(observation.qualifyingIncomingEvents,1);
  assert.match(observation.note,/does not prove a reward/);
 }
 assert.equal(classifyTransferLogs([evt({address:'0x'+'0'.repeat(40)})],account).qualifyingIncomingEvents,0);
});
