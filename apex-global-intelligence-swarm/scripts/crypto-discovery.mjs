// APEX bounded public-announcement discovery: official domains, no login, no wallets, no claims.
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(ROOT,'feed/crypto-discovery.json');
export const SOURCES=Object.freeze([
 {id:'binance-en',url:'https://www.binance.com/en/support/announcement'},
 {id:'binance-es',url:'https://www.binance.com/es-LA/support/announcement'},
 {id:'coinbase-blog',url:'https://www.coinbase.com/blog/landing'},
 {id:'kraken-blog',url:'https://blog.kraken.com/'},
 {id:'okx-help',url:'https://www.okx.com/help'}
]);
const SIGNAL=/\b(airdrop|learn\s*(?:and|&)\s*earn|giveaway|token rewards?|crypto rewards?|token distribution|recompensas?|distribuci[oó]n|promoci[oó]n|promotions?|campaign|campa[ñn]a)\b/i;
const COST=/\b(trad(?:ing|e)|deposit|purchase|buy|hold|stake|staking|subscription|futures|margin|spot trading|mining|trade-to|suscri|comprar|operar|depositar|mantener|inver(?:tir|si[oó]n))\b/i;
function unescapeHtml(s){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
export function permittedPage(raw){
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(
  (u.hostname==='www.binance.com'&&/^\/(?:en|es-LA)\/support\/announcement\/detail\/[a-f0-9]{32}\/?$/i.test(u.pathname))||
  (u.hostname==='www.coinbase.com'&&/^\/blog\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))||
  (u.hostname==='blog.kraken.com'&&!/^\/(?:category|tag|author|page)\//i.test(u.pathname)&&/^\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\/?$/i.test(u.pathname))||
  (u.hostname==='www.okx.com'&&/^\/help\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname))
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
   screening:COST.test(title)?'requires_capital_or_activity_review':'eligibility_not_verified',
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
  const hits=findRelevantLinks(html,source);
  return {id:source.id,result:'read',hits};
 }catch{return {id:source.id,result:'network_or_redirect_error',hits:[]}}
}
export async function discover({sources=SOURCES,fetcher=fetch,now=new Date()}={}){
 const results=await Promise.all(sources.map(s=>check(s,fetcher)));const uniq=new Map();
 for(const s of results)for(const hit of s.hits)if(!uniq.has(hit.url))uniq.set(hit.url,hit);
 const opportunities=[...uniq.values()].slice(0,80);
 return {schema:'apex-crypto-discovery-v1',generated_at:now.toISOString(),
  mode:'public_official_read_only',statement:'Announced campaigns are not verified eligibility or money.',
  stats:{official_pages_checked:results.length,pages_read:results.filter(s=>s.result==='read').length,
   candidate_announcements:opportunities.length,confirmed_eligible:0,verified_deposits:0},
  sources:results.map(({id,result,hits})=>({id,result,candidate_count:hits.length})),opportunities};
}
async function main(){const result=await discover();await mkdir(path.dirname(OUT),{recursive:true});await writeFile(OUT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sources:result.stats.official_pages_checked,candidates:result.stats.candidate_announcements,eligible_verified:0,received:0}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1});
