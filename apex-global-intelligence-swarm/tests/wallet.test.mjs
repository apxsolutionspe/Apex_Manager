import test from 'node:test';import assert from 'node:assert/strict';
import {isEvmAddress,parseWei,formatWei,compareBalances,READ_METHODS,requestWalletAccount,isPendingPermissionError} from '../wallet-core.mjs';
test('EVM address syntax accepts only 20 hex bytes',()=>{assert.equal(isEvmAddress('0x'+'f'.repeat(40)),true);assert.equal(isEvmAddress('0x'+'f'.repeat(39)),false);assert.equal(isEvmAddress('0x'+'g'.repeat(40)),false);assert.equal(isEvmAddress('https://wallet.invalid'),false)});
test('Accept only bounded RPC hex numbers',()=>{assert.equal(parseWei('0xde0b6b3a7640000'),1000000000000000000n);assert.throws(()=>parseWei('1.0'));assert.throws(()=>parseWei('0x'+'1'.repeat(65)));});
test('Format native balances without floating-point precision loss',()=>{assert.equal(formatWei(1000000000000000000n),'1');assert.equal(formatWei(1250000000000000000n),'1.25');assert.equal(formatWei(1n),'0');assert.equal(formatWei(20000000000000000000n),'20')});
test('Detect increases and reductions without labeling income',()=>{assert.deepEqual(compareBalances(null,0n),{type:'baseline',delta:0n});assert.deepEqual(compareBalances(4n,8n),{type:'increase',delta:4n});assert.deepEqual(compareBalances(8n,3n),{type:'decrease',delta:5n});assert.deepEqual(compareBalances(3n,3n),{type:'unchanged',delta:0n})});
test('Reject negative values',()=>{assert.throws(()=>formatWei(-1n));assert.throws(()=>compareBalances(1n,-1n))});
test('Only read or account-disclosure methods are used',()=>{assert.deepEqual(READ_METHODS,['eth_requestAccounts','eth_accounts','eth_chainId','eth_getBalance']);assert(!READ_METHODS.some(x=>/sign|send|transaction|approve/i.test(x)))});

test('Reuses previously approved MetaMask account without requesting new permission',async()=>{
 const calls=[];const address='0x'+'1'.repeat(40);
 const result=await requestWalletAccount({request:async({method})=>{calls.push(method);if(method==='eth_accounts')return [address];throw Error('Should not request access')}});
 assert.deepEqual(result,{address,requestedPermission:false});
 assert.deepEqual(calls,['eth_accounts']);
});
test('Requests account permission only once when no account approved',async()=>{
 const calls=[];const address='0x'+'2'.repeat(40);
 const result=await requestWalletAccount({request:async({method})=>{calls.push(method);return method==='eth_accounts'?[]:[address]}});
 assert.deepEqual(result,{address,requestedPermission:true});
 assert.deepEqual(calls,['eth_accounts','eth_requestAccounts']);
});
test('Pending permission is clearly detectable without trying to bypass it',async()=>{
 const error=Object.assign(new Error("Request of type 'wallet_requestPermissions' already pending for origin"),{code:-32002});
 assert.equal(isPendingPermissionError(error),true);
 assert.equal(isPendingPermissionError(new Error('other')),false);
 await assert.rejects(requestWalletAccount({request:async({method})=>{
  if(method==='eth_accounts')return [];
  throw error;
 }}),/pending/);
});
test('Rejects bad provider responses instead of displaying invalid addresses',async()=>{
 await assert.rejects(requestWalletAccount({request:async()=>null}),/inválida/);
 await assert.rejects(requestWalletAccount({request:async({method})=>method==='eth_accounts'?[]:['0xwrong']}),/dirección EVM/);
});
