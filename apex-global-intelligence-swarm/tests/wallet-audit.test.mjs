import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {captureWallet,updateAudit,encryptAudit,decryptAudit,runAudit,validSecretKey} from '../scripts/wallet-audit.mjs';
const address='0x'+'a'.repeat(40),key='f'.repeat(64);
function mockRpc({block='0x3e8',eth='0x0',tokens='0x0',calls=[]}={}){
 return async(_url,options)=>{
  const req=JSON.parse(options.body);calls.push(req);
  if(req.method==='eth_getBlockByNumber')return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:{number:block}})};
  if(req.method==='eth_getBalance')return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:eth})};
  if(req.method==='eth_call')return {ok:true,json:async()=>({jsonrpc:'2.0',id:1,result:tokens})};
  throw Error('Unexpected request '+req.method);
 };
}
test('Audit reads a finalized block, native ETH and five ERC-20 balances only',async()=>{
 const calls=[];const snapshot=await captureWallet(address,{fetcher:mockRpc({calls})});
 assert.equal(snapshot.balances.ETH,'0');assert.equal(Object.keys(snapshot.balances).length,6);
 assert.deepEqual(calls.map(x=>x.method),['eth_getBlockByNumber','eth_getBalance',...Array(5).fill('eth_call')]);
 assert(calls.slice(1).every(x=>x.params.at(-1)==='0x3e8'));
 assert(calls.slice(2).every(x=>x.params[0].data.startsWith('0x70a08231')));
});
test('Authenticated encryption protects the private address, balances and past observations',async()=>{
 const snapshot=await captureWallet(address,{fetcher:mockRpc()});
 const state=updateAudit(null,snapshot),sealed=encryptAudit(state,key);
 assert(!JSON.stringify(sealed).includes(address));
 assert(!JSON.stringify(sealed).includes('0x3e8'));
 assert.deepEqual(decryptAudit(sealed,key),state);
 assert.throws(()=>decryptAudit(sealed,'1'.repeat(64)));
 const tampered={...sealed,ciphertext:sealed.ciphertext.slice(0,-4)+'aaaa'};
 assert.throws(()=>decryptAudit(tampered,key));
 assert.equal(validSecretKey(key),true);assert.equal(validSecretKey('hello'),false);
});
test('First observation is baseline: incoming balance differences are not declared profits',async()=>{
 const before=await captureWallet(address,{fetcher:mockRpc({block:'0x3e8',eth:'0x1'})});
 const after=await captureWallet(address,{fetcher:mockRpc({block:'0x3e9',eth:'0x3'})});
 const initial=updateAudit(null,before),second=updateAudit(initial,after);
 assert.equal(initial.history.length,0);
 assert.equal(second.history.length,1);
 assert.equal(second.history[0].kind,'balance_increase_observed');
 assert.equal(second.history[0].amount_raw,'2');
 assert.equal(second.verified_income_usd,0);
 assert.equal(second.verified_reward_count,0);
 assert.equal(updateAudit(second,after),second);
});
test('Never overwrite another account, an older finalized block or invalid state',async()=>{
 const snap=await captureWallet(address,{fetcher:mockRpc()});const previous=updateAudit(null,snap);
 assert.throws(()=>updateAudit(previous,{...snap,address:'0x'+'b'.repeat(40),block:'0x3e9'}),/changed/);
 assert.throws(()=>updateAudit(previous,{...snap,block:'0x1'}),/regression/);
 assert.throws(()=>updateAudit({schema:'wrong',latest:snap,history:[]},snap));
});
test('Never save plaintext state or reset encrypted history after an incorrect key',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'apex-wallet-audit-'));
 const file=path.join(dir,'audit.enc.json');
 try{
  const fetcher=mockRpc({block:'0x3e8',eth:'0x12'});
  assert.equal(await runAudit({address,key,destination:file,fetcher}),'baseline');
  const saved=await readFile(file,'utf8');
  assert(!saved.includes(address));assert(!saved.includes('0x12'));
  assert.equal(await runAudit({address,key,destination:file,fetcher}),'unchanged');
  await assert.rejects(runAudit({address,key:'a'.repeat(64),destination:file,fetcher}),/unreadable/);
  assert.equal(await readFile(file,'utf8'),saved);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Missing encryption key fails before any network requests',async()=>{
 await assert.rejects(runAudit({address,key:'invalid',fetcher:()=>{throw Error('should not query')}}),/secrets/);
});
