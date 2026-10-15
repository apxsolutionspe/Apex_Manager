// APEX bounded public-announcement discovery: official domains, no login, no wallets, no claims.
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'feed/crypto-discovery.json');
export const SOURCES=Object.freeze([
 {id:'binance-en',url:'https://www.binance.com/en/support/announcement'},
 {id:'binance-es',url:'https://www.binance.com/es-LA/support/announcement'},
 {id:'coinbase-blog',url:'https://www.coinbase.com/blog/landing'},
 {id:'kraken-blog',url:'https://blog.kraken.com/'},
 {id:'kraken-promotions',url:'https://blog.kraken.com/category/product/promotions'},
 {id:'kraken-product',url:'https://blog.kraken.com/product'},
 {id:'okx-help',url:'https://www.okx.com/help'},
 {id:'uniswap-defi',url:'https://blog.uniswap.org/'},
 {id:'aave-defi',url:'https://aave.com/blog'},
 {id:'optimism-ecosystem',url:'https://optimism.io/blog/collective'},
 {id:'uniswap-governance',url:'https://gov.uniswap.org/latest'},
 {id:'optimism-governance',url:'https://gov.optimism.io/latest'}
]);
const SIGNAL=/\b(airdrop|giveaway|token rewards?|crypto rewards?|token distribution|recompensas?|promoci[oó]n|promotions?|sweepstakes|prize|challenge|contest|campaign|campa[ñn]a|grants?|retrofunding|funding|incentives?|quests?|quiz|token allocations?)\b|learn\s*(?:and|&)\s*earn|distribuci[oó]n/i;
const COST=/\b(trad(?:ing|e)|trades|deposit|purchase|buy|hold|stake|staking|subscription|futures|margin|perps|leverage|volume|spot trading|mining|trade-to|suscri|comprar|operar|depositar|dep[oó]sito|mantener|invertir|yield|liquidity|collateral|vault|lending|borrowing)\b/i;
const SECURITY=/seed\s*phrase|private\s*key|recovery\s*phrase|frase\s*semilla|clave\s*privada/i;
function fallbackScreening(title){
 if(SECURITY.test(title))return 'security_warning';
 if(COST.test(title))return 'requires_capital_or_activity_review';
 if(/\b(quiz|contest|challenge|sweepstakes|grant|funding|quest|governance|raffle|vote)\b/i.test(title))return 'manual_action_or_conditions';
 return 'eligibility_not_verified';
}
const NATIVE_LABELS=new Set(['security_warning','requires_capital_or_activity_review','manual_action_or_conditions','eligibility_not_verified']);
export function nativeScreening(opportunities,nativePath=process.env.APEX_CRYPTO_NATIVE_CLASSIFIER){
 if(!nativePath||!opportunities.length)return opportunities;
 const cleanTitles=opportunities.map(x=>String(x.title).replace(/[\t\r\n]/g,' ').slice(0,400));
 try{
  const output=execFileSync(nativePath,[],{input:cleanTitles.join('\n')+'\n',encoding:'utf8',timeout:2500,maxBuffer:65536});
  const labels=output.trim().split(/\r?\n/);
  if(labels.length!==opportunities.length||!labels.every(x=>NATIVE_LABELS.has(x)))throw Error('Native classifier protocol mismatch');
  return opportunities.map((item,i)=>{
   const label=labels[i];
   return {...item,screening:item.screening==='security_warning'||label==='security_warning'?'security_warning':
    item.screening==='requires_capital_or_activity_review'||label==='requires_capital_or_activity_review'?'requires_capital_or_activity_review':
    label==='manual_action_or_conditions'?'manual_action_or_conditions':item.screening};
  });
 }catch{return opportunities}
}

function unescapeHtml(s){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
export function permittedPage(raw){
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(
  (u.hostname==='www.binance.com'&&/^\/(?:en|es-LA)\/support\/announcement\/detail\/[a-f0-9]{32}\/?$/i.test(u.pathname))||
  (u.hostname==='www.coinbase.com'&&/^\/blog\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))||
  (u.hostname==='blog.kraken.com'&&!/^\/(?:category|tag|author|page)\//i.test(u.pathname)&&/^\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\/?$/i.test(u.pathname))||
  (u.hostname==='www.okx.com'&&/^\/help\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))||
  (u.hostname==='blog.uniswap.org'&&/^\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))||
  (u.hostname==='aave.com'&&/^\/blog\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))||
  (u.hostname==='optimism.io'&&/^\/blog\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))||
  ((u.hostname==='gov.uniswap.org'||u.hostname==='gov.optimism.io')&&/^\/t\/[a-z0-9-]+\/\d+(?:\/\d+)?\/?$/i.test(u.pathname))
 );}catch{return false}
}
export function findRelevantLinks(html,source){
 if(typeof html!=='string'||html.length>500000)throw Error('Oversized source');
 const hits=[],used=new Set();
 const matcher=/<a\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/gim;
 let match;
 while((match=matcher.exec(html))!==null&&hits.length<30){
  const title=unescapeHtml(match[3].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()).slice(0,180);
  if(!SIGNAL.test(title))continue;
  let url;try{url=new URL(unescapeHtml(match[2]),source.url);}catch{continue}
  if(!permittedPage(url.href))continue;
  const normalized=url.origin+url.pathname.replace(/\/$/,'');
  if(used.has(normalized))continue;used.add(normalized);
  hits.push({id:createHash('sha256').update(normalized).digest('hex').slice(0,16),
   title,source:source.id,url:normalized,
   screening:fallbackScreening(title),
   status:'unverified_announcement',claimed:false,reward_received:false});
 }
 return hits;
}
async function check(source,fetcher){
 try{
  const response=await fetcher(source.url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(9000),
   headers:{'Accept':'text/html','User-Agent':'APEX-PRIME-X-Official-Reward-Radar/1.0'}});
  if(!response.ok)return {id:source.id,result:'http_'+response.status,hits:[]};
  const type=response.headers?.get?.('content-type')||'';
  if(type&&!type.includes('text/html'))return {id:source.id,result:'unexpected_type',hits:[]};
  const length=Number(response.headers?.get?.('content-length')||0);
  if(length>500000)return {id:source.id,result:'size_limit',hits:[]};
  const html=await response.text();
  if(html.length>500000)return {id:source.id,result:'size_limit',hits:[]};
  const hits=findRelevantLinks(html,source);
  return {id:source.id,result:'read',hits};
 }catch{return {id:source.id,result:'network_or_redirect_error',hits:[]}}
}
export async function discover({sources=SOURCES,fetcher=fetch,now=new Date()}={}){
 const results=new Array(sources.length);let cursor=0;
 // A bounded worker pool prevents runaway requests against official providers.
 async function worker(){for(;;){const i=cursor++;if(i>=sources.length)return;results[i]=await check(sources[i],fetcher);}}
 await Promise.all(Array.from({length:Math.min(4,sources.length)},()=>worker()));
 const uniq=new Map();
 for(const s of results)for(const hit of s.hits)if(!uniq.has(hit.url))uniq.set(hit.url,hit);
 const opportunities=nativeScreening([...uniq.values()].slice(0,80));
 return {schema:'apex-crypto-discovery-v1',generated_at:now.toISOString(),
  mode:'public_official_read_only',statement:'Announced campaigns are not verified eligibility or money.',
  stats:{official_pages_checked:results.length,pages_read:results.filter(s=>s.result==='read').length,
   candidate_announcements:opportunities.length,confirmed_eligible:0,verified_deposits:0},
  sources:results.map(({id,result,hits})=>({id,result,candidate_count:hits.length})),opportunities};
}
async function main(){const result=await discover();await mkdir(path.dirname(OUT),{recursive:true});await writeFile(OUT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sources:result.stats.official_pages_checked,candidates:result.stats.candidate_announcements,eligible_verified:0,received:0}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1});
