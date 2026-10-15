// Watch-only Ethereum observer: no transactions, signing, private keys, saved addresses or balances.
const endpoint='https://ethereum-rpc.publicnode.com';
export function validEvmAddress(address){return typeof address==='string' && /^0x[0-9a-fA-F]{40}$/.test(address);}
export function parseRpcBalance(value){if(typeof value!=='string'||!/^0x[0-9a-fA-F]{1,64}$/.test(value))throw Error('Invalid balance response');return BigInt(value);}
export async function getNativeBalance(address,fetcher=fetch){
 if(!validEvmAddress(address))throw Error('Invalid public address configuration');
 const res=await fetcher(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getBalance',params:[address,'finalized']})});
 if(!res.ok)throw Error('RPC unavailable');
 const result=await res.json();
 if(result?.jsonrpc!=='2.0'||result.id!==1||result.error)throw Error('RPC query failed');
 return parseRpcBalance(result.result);
}

export function compareNativeBalances(previous,current){
 if(typeof previous!=='bigint'||typeof current!=='bigint'||previous<0n||current<0n)throw Error('Invalid balances');
 return current>previous?'balance_increase_observed':current<previous?'balance_decrease_observed':'unchanged';
}
export async function examineRecentNativeBalance(address,{fetcher=fetch,lookbackBlocks=720}={}){
 if(!validEvmAddress(address)||!Number.isInteger(lookbackBlocks)||lookbackBlocks<60||lookbackBlocks>1200)throw Error('Invalid observer arguments');
 const res=await fetcher(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getBlockByNumber',params:['finalized',false]})});
 if(!res?.ok)throw Error('Finalized block unavailable');
 const json=await res.json();
 const value=json?.result?.number;
 if(typeof value!=='string'||!/^0x[0-9a-fA-F]{1,18}$/.test(value))throw Error('Finalized block invalid');
 const number=BigInt(value);
 const current=await getNativeBalance(address,fetcher,value);
 if(number<BigInt(lookbackBlocks))return 'baseline_only';
 try{
  const earlier=await getNativeBalance(address,fetcher,'0x'+(number-BigInt(lookbackBlocks)).toString(16));
  return compareNativeBalances(earlier,current);
 }catch{return 'historical_state_unavailable'}
}

async function run(){
 const address=process.env.APEX_WALLET_ADDRESS;
 if(!address){console.log('Private wallet monitor not configured; no query made.');return;}
 await examineRecentNativeBalance(address);
 console.log('Private wallet balance checked successfully. Finalized recent-history comparison attempted. No wallet details recorded.');
}
if(import.meta.url===new URL('file://'+process.argv[1]).href)run().catch(()=>{console.error('Private wallet check failed; no account action taken.');process.exitCode=1});
