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
async function run(){
 const address=process.env.APEX_WALLET_ADDRESS;
 if(!address){console.log('Private wallet monitor not configured; no query made.');return;}
 await getNativeBalance(address);
 console.log('Private wallet balance checked successfully. No address, balance or transaction recorded.');
}
if(import.meta.url===new URL('file://'+process.argv[1]).href)run().catch(()=>{console.error('Private wallet check failed; no account action taken.');process.exitCode=1});
