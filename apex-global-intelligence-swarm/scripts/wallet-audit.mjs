// APEX encrypted private-wallet audit: read-only ETH and five official ERC-20 balances.
// Public git contains ciphertext only. No signing, withdrawals, seed phrases or simulated earnings.
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {TOKEN_CONTRACTS} from './erc20-watch.mjs';

const RPC_URL='https://ethereum-rpc.publicnode.com';
export const AUDIT_FILE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../state/wallet-audit.enc.json');
const VERSION='apex-wallet-audit-v1';
const ASSETS=Object.freeze(['ETH',...Object.keys(TOKEN_CONTRACTS)]);
export function validEvmAddress(a){return typeof a==='string'&&/^0x[0-9a-fA-F]{40}$/.test(a);}
export function validSecretKey(v){return typeof v==='string'&&/^[0-9a-fA-F]{64}$/.test(v);}
export function parseHexUint(s){if(typeof s!=='string'||!/^0x[0-9a-fA-F]{1,64}$/.test(s))throw Error('Invalid RPC hex integer');return BigInt(s);}
function assertSnapshot(value){
 if(!value||!validEvmAddress(value.address)||typeof value.block!=='string'||!/^0x[0-9a-fA-F]{1,18}$/.test(value.block)||
    !value.balances||ASSETS.some(x=>typeof value.balances[x]!=='string'||!/^(0|[1-9][0-9]*)$/.test(value.balances[x])))
  throw Error('Invalid wallet audit snapshot');
}
export function encryptAudit(data,keyHex){
 if(!validSecretKey(keyHex))throw Error('Audit encryption key missing or malformed');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),iv);
 cipher.setAAD(Buffer.from(VERSION));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
 return {format:VERSION,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:encrypted.toString('base64')};
}
export function decryptAudit(data,keyHex){
 if(!validSecretKey(keyHex)||data?.format!==VERSION||typeof data.iv!=='string'||typeof data.tag!=='string'||
    typeof data.ciphertext!=='string'||data.ciphertext.length>65536)throw Error('Invalid encrypted audit');
 const iv=Buffer.from(data.iv,'base64'),tag=Buffer.from(data.tag,'base64');
 if(iv.length!==12||tag.length!==16)throw Error('Invalid encrypted audit envelope');
 const dec=createDecipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),iv);
 dec.setAAD(Buffer.from(VERSION));dec.setAuthTag(tag);
 const plain=JSON.parse(Buffer.concat([dec.update(Buffer.from(data.ciphertext,'base64')),dec.final()]).toString('utf8'));
 if(plain.schema!==VERSION||!Array.isArray(plain.history)||plain.history.length>50)throw Error('Corrupt private audit');
 assertSnapshot(plain.latest);
 return plain;
}
async function readRpc(method,params,fetcher){
 const res=await fetcher(RPC_URL,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
  headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 if(!res?.ok)throw Error('Private audit RPC request failed');
 const j=await res.json();
 if(j?.jsonrpc!=='2.0'||j.id!==1||j.error||j.result==null)throw Error('Private audit RPC invalid response');
 return j.result;
}
export async function captureWallet(address,{fetcher=fetch,now=new Date()}={}){
 if(!validEvmAddress(address))throw Error('Invalid monitored wallet');
 const finalized=await readRpc('eth_getBlockByNumber',['finalized',false],fetcher);
 if(typeof finalized?.number!=='string'||!/^0x[0-9a-fA-F]{1,18}$/.test(finalized.number))throw Error('Invalid finalized block');
 const block=finalized.number;
 const balances={ETH:parseHexUint(await readRpc('eth_getBalance',[address,block],fetcher)).toString()};
 const encoded='0x70a08231'+address.slice(2).toLowerCase().padStart(64,'0');
 for(const [symbol,contract] of Object.entries(TOKEN_CONTRACTS)){
  const balance=await readRpc('eth_call',[{to:contract,data:encoded},block],fetcher);
  balances[symbol]=parseHexUint(balance).toString();
 }
 const snapshot={address,block,observed_at:now.toISOString(),balances};assertSnapshot(snapshot);return snapshot;
}
export function updateAudit(previous,next){
 assertSnapshot(next);
 if(previous!==null){
  if(previous.schema!==VERSION||!Array.isArray(previous.history)||previous.history.length>50)throw Error('Invalid previous audit state');
  assertSnapshot(previous.latest);
  if(previous.latest.address.toLowerCase()!==next.address.toLowerCase())throw Error('Monitored wallet changed; explicit new audit required');
  const past=parseHexUint(previous.latest.block),current=parseHexUint(next.block);
  if(current<past)throw Error('Finalized block regression; refuse overwrite');
  if(current===past)return previous;
 }
 const history=(previous?.history||[]).slice(-49);
 if(previous){
  for(const symbol of ASSETS){
   const before=BigInt(previous.latest.balances[symbol]),after=BigInt(next.balances[symbol]);
   if(before!==after)history.push({asset:symbol,block:next.block,observed_at:next.observed_at,
    kind:after>before?'balance_increase_observed':'balance_decrease_observed',amount_raw:(after-before).toString(),
    source:'balance_comparison_not_proven_income'});
  }
 }
 return {schema:VERSION,latest:next,history:history.slice(-50),
  verified_income_usd:0,verified_reward_count:0};
}
export async function runAudit({address=process.env.APEX_WALLET_ADDRESS,key=process.env.APEX_WALLET_AUDIT_KEY,
 destination=AUDIT_FILE,fetcher=fetch}={}){
 if(!validEvmAddress(address)||!validSecretKey(key))throw Error('Audit secrets not configured');
 let previous=null;
 try{previous=decryptAudit(JSON.parse(await readFile(destination,'utf8')),key);}catch(e){if(e.code!=='ENOENT')throw Error('Encrypted audit unreadable; refusing to reset history');}
 const latest=await captureWallet(address,{fetcher});
 const updated=updateAudit(previous,latest);
 if(updated===previous){console.log('APEX encrypted audit: same finalized block, history preserved');return 'unchanged';}
 const encrypted=encryptAudit(updated,key);
 await mkdir(path.dirname(destination),{recursive:true});
 await writeFile(destination,JSON.stringify(encrypted)+'\n',{mode:0o600});
 console.log('APEX encrypted audit: saved watch-only snapshot; no balances, addresses or events logged');
 return previous?'updated':'baseline';
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 runAudit().catch(()=>{console.error('APEX encrypted audit failed safely; historical state unchanged');process.exitCode=1;});
