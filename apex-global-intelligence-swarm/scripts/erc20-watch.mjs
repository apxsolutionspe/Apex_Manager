// APEX private watch-only ERC-20 observer on Ethereum mainnet.
// No signing, token claims, keys, transactions or public deposit records.
export const TOKEN_CONTRACTS=Object.freeze({
 USDC:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
 USDT:'0xdac17f958d2ee523a2206206994597c13d831ec7',
 DAI:'0x6b175474e89094c44da98b954eedeac495271d0f',
 LINK:'0x514910771af9ca656af840dff83e8264ecf986ca',
 UNI:'0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'
});
export const TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const RPC='https://ethereum-rpc.publicnode.com';
export function validAddress(s){return typeof s==='string'&&/^0x[0-9a-fA-F]{40}$/.test(s);}
export function paddedAddress(s){
 if(!validAddress(s))throw Error('Invalid EVM address');
 return '0x'+s.slice(2).toLowerCase().padStart(64,'0');
}
function hexBlock(s){
 if(typeof s!=='string'||!/^0x[0-9a-fA-F]{1,18}$/.test(s))throw Error('Invalid RPC block');
 return BigInt(s);
}
async function rpcCall(method,params,fetcher){
 const response=await fetcher(RPC,{method:'POST',redirect:'error',
  signal:AbortSignal.timeout(11000),headers:{'Content-Type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 if(!response?.ok)throw Error('Read-only RPC unavailable');
 const json=await response.json();
 if(json?.jsonrpc!=='2.0'||json.id!==1||json.error||json.result==null)throw Error('Read-only RPC response invalid');
 return json.result;
}
export function classifyTransferLogs(logs,address,contracts=TOKEN_CONTRACTS){
 if(!validAddress(address)||!Array.isArray(logs)||logs.length>1000)throw Error('Invalid log data');
 const allow=new Set(Object.values(contracts).map(x=>x.toLowerCase()));
 const recipient=paddedAddress(address);
 let deposits=0;
 for(const event of logs){
  if(event?.removed===true)continue;
  if(!allow.has(String(event?.address||'').toLowerCase()))continue;
  if(!Array.isArray(event.topics)||event.topics.length!==3)continue;
  if(String(event.topics[0]).toLowerCase()!==TRANSFER_TOPIC)continue;
  if(String(event.topics[2]).toLowerCase()!==recipient)continue;
  if(typeof event.data!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(event.data))continue;
  if(BigInt(event.data)===0n)continue;
  // Self-transfer doesn't increase the recipient balance.
  if(String(event.topics[1]).toLowerCase()===recipient)continue;
  deposits++;
 }
 return {qualifyingIncomingEvents:deposits,scope:'native-Ethereum ERC20 logs only',
  note:'Token transfer does not prove a reward, ownership, profit or eligibility'};
}
export async function inspectRecentErc20(address,{fetcher=fetch,blocks=720}={}){
 if(!validAddress(address))throw Error('Invalid address');
 if(!Number.isInteger(blocks)||blocks<50||blocks>1200)throw Error('Invalid lookback window');
 const last=await rpcCall('eth_getBlockByNumber',['finalized',false],fetcher);
 const number=hexBlock(last?.number);
 const start=number>BigInt(blocks)?number-BigInt(blocks):0n;
 const query={address:Object.values(TOKEN_CONTRACTS),fromBlock:'0x'+start.toString(16),
  toBlock:'0x'+number.toString(16),topics:[TRANSFER_TOPIC,null,paddedAddress(address)]};
 const events=await rpcCall('eth_getLogs',[query],fetcher);
 return classifyTransferLogs(events,address);
}
export async function run(){
 const address=process.env.APEX_WALLET_ADDRESS;
 if(!validAddress(address))throw Error('Wallet address secret not configured');
 const result=await inspectRecentErc20(address);
 // Never log addresses, event payloads or token amounts in a public repository.
 console.log('APEX ERC20: private finalized-window scan of five official token contracts completed; no funds moved by the agent.');
 return result;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 run().catch(()=>{console.error('APEX ERC20: private finalized-window scan unavailable; nothing claimed');process.exitCode=1;});
}
