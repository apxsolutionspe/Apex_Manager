// APEX bounded public-announcement discovery: official domains, no login, no wallets, no claims.
import {writeFile,mkdir,readFile} from 'node:fs/promises';
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
 {id:'optimism-governance',url:'https://gov.optimism.io/latest'},
 {id:'ethereum-grants',url:'https://ethereum.org/en/community/grants/'},
 {id:'ethereum-funding',url:'https://blog.ethereum.org/category/funding-coordination'},
 {id:'base-ecosystem',url:'https://www.base.org/blog'},
 {id:'gitcoin-funding',url:'https://gitcoin.co/blog'},
 {id:'base-announcements',url:'https://blog.base.org/'}
]);
const SIGNAL=/\b(airdrop|giveaway|token rewards?|crypto rewards?|token distribution|recompensas?|promoci[oó]n|promotions?|sweepstakes|prize|challenge|contest|campaign|campa[ñn]a|grants?|retrofunding|funding|incentives?|quests?|quiz|token allocations?|stipend|bounties|retroactive|apply now|funding round)\b|learn\s*(?:and|&)\s*earn|distribuci[oó]n/i;
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
  const processed=opportunities.map((item,i)=>{
   const label=labels[i];
   return {...item,screening:item.screening==='security_warning'||label==='security_warning'?'security_warning':
    item.screening==='requires_capital_or_activity_review'||label==='requires_capital_or_activity_review'?'requires_capital_or_activity_review':
    label==='manual_action_or_conditions'?'manual_action_or_conditions':item.screening};
  });
  Object.defineProperty(processed,'native_used',{value:true});
  return processed;
 }catch{return opportunities}
}

/**
 * Conservative public-source triage. This is NOT a statement about eligibility,
 * profitable value, expiration confirmed by issuer, or a payable reward.
 */
export function reviewPriority(item,now=new Date()){
 const title=String(item?.title||'');
 const status=item?.screening;
 const years=(title.match(/\b20\d{2}\b/g)||[]).map(Number);
 if(status==='security_warning')return {score:0,group:'security_blocked',reason:'Possible phishing or credential exposure'};
 if(status==='requires_capital_or_activity_review')return {score:0,group:'capital_or_trading',reason:'Deposit, trading or other capital may be required'};
 if(years.length&&Math.max(...years)<now.getUTCFullYear())
  return {score:0,group:'historical_reference',reason:'Title refers to a prior year; actual current eligibility unverified'};
 // Announcing a governance reallocation, technical engine or proposal is not a
 // publicly claimable benefit, even when its headline contains 'airdrop' or 'incentives'.
 if(/re.designating|reallocat|liquidation engine|technical overview|protocol upgrade|fund allocation|ecosystem fund|governance|proposal|request for builders|developer quest/i.test(title))
  return {score:2,group:'informational_not_passive',reason:'Governance, engineering or application news; no direct passive reward evidenced'};
 if(status==='manual_action_or_conditions')return {score:5,group:'manual_participation',reason:'Requires verification, work or selection'};
 const reward=/\bairdrop\b|token distribution|token allocation|\breward\b|\brecompensa\b/i.test(title);
 return {score:reward?20:8,group:'unverified_no_capital_evidence',
  reason:'No capital requirement detected in title; full official terms, country, fees and eligibility remain unverified'};
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
  ((u.hostname==='gov.uniswap.org'||u.hostname==='gov.optimism.io')&&/^\/t\/[a-z0-9-]+\/\d+(?:\/\d+)?\/?$/i.test(u.pathname))||
  (u.hostname==='ethereum.org'&&/^\/en\/community\/grants\/?$/i.test(u.pathname))||
  (u.hostname==='blog.ethereum.org'&&/^\/(?:20\d{2}\/\d{2}\/\d{2}\/)?[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))||
  (u.hostname==='www.base.org'&&/^\/blog\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))||
  (u.hostname==='blog.base.org'&&/^\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))||
  (u.hostname==='gitcoin.co'&&/^\/blog\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))
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
export async function discover({sources=SOURCES,fetcher=fetch,now=new Date(),previous=null}={}){
 if(previous!==null&&(previous.schema!=='apex-crypto-discovery-v1'||!Array.isArray(previous.observed_announcements||[])))throw Error('Previous discovery history invalid');
 const results=new Array(sources.length);let cursor=0;
 // A bounded worker pool prevents runaway requests against official providers.
 async function worker(){for(;;){const i=cursor++;if(i>=sources.length)return;results[i]=await check(sources[i],fetcher);}}
 await Promise.all(Array.from({length:Math.min(4,sources.length)},()=>worker()));
 const uniq=new Map();
 for(const s of results)for(const hit of s.hits)if(!uniq.has(hit.url))uniq.set(hit.url,hit);
 const opportunities=nativeScreening([...uniq.values()].slice(0,80));
 for(const item of opportunities){const triage=reviewPriority(item,now);item.review_priority=triage.score;
  item.review_group=triage.group;item.review_reason=triage.reason;}
 opportunities.sort((a,b)=>b.review_priority-a.review_priority || a.id.localeCompare(b.id));
 const seen=new Map((previous?.observed_announcements||[]).filter(x=>typeof x.id==='string').map(x=>[x.id,x]));
 const at=now.toISOString();
 let fresh=0;
 for(const item of opportunities){
  const earlier=seen.get(item.id);
  item.first_seen_at=earlier?.first_seen_at||at;
  item.observations=Math.min(999999,Number(earlier?.observations||0)+1);
  item.new_candidate=!earlier;
  if(item.new_candidate)fresh++;
  seen.set(item.id,{id:item.id,first_seen_at:item.first_seen_at,last_seen_at:at,observations:item.observations});
 }
 const observed_announcements=[...seen.values()].sort((a,b)=>b.last_seen_at.localeCompare(a.last_seen_at)).slice(0,500);
 return {schema:'apex-crypto-discovery-v1',generated_at:now.toISOString(),observed_announcements,
  mode:'public_official_read_only',statement:'Announced campaigns are not verified eligibility or money.',
  stats:{official_pages_checked:results.length,pages_read:results.filter(s=>s.result==='read').length,
   candidate_announcements:opportunities.length,new_candidate_count:fresh,native_classifier_used:opportunities.native_used===true,priority_review_count:opportunities.filter(x=>x.review_priority>0).length,confirmed_eligible:0,verified_deposits:0},
  sources:results.map(({id,result,hits})=>({id,result,candidate_count:hits.length})),opportunities};
}
async function main(){
 let previous=null;
 try{previous=JSON.parse(await readFile(OUT,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const result=await discover({previous});await mkdir(path.dirname(OUT),{recursive:true});await writeFile(OUT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sources:result.stats.official_pages_checked,candidates:result.stats.candidate_announcements,eligible_verified:0,received:0}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1});
