// Parallel public-source checking with strict source allowlist and bounded response size.
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAMPAIGNS,allowedCampaignUrl,makeRadar} from './crypto-core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(root,'feed/crypto.json');
export async function inspectOfficial(item,fetcher=fetch){
 if(!allowedCampaignUrl(item.url))throw Error('Origen no autorizado');
 try{
  const res=await fetcher(item.url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'APEX-PRIME-X-CryptoWatch/1.0 (public read-only monitoring)','Accept':'text/html'}});
  if(!res.ok)return {official_page_access:'error_http_'+res.status,source_confirmed:false};
  const mime=String(res.headers?.get('content-type')||'');
  if(mime && !mime.includes('text/html'))return {official_page_access:'formato_inesperado',source_confirmed:false};
  const l=Number(res.headers?.get('content-length')||0);
  if(l>250000)return {official_page_access:'pagina_grande_no_analizada',source_confirmed:false};
  const html=await res.text();
  if(html.length>250000)return {official_page_access:'pagina_grande_no_analizada',source_confirmed:false};
  const source_confirmed=item.checkText.every(word=>html.toLowerCase().includes(word.toLowerCase()));
  return {official_page_access:source_confirmed?'texto_publico_coincidente':'pagina_sin_detalle_suficiente',source_confirmed};
 }catch(e){return {official_page_access:'error_red_o_redireccion',source_confirmed:false};}
}
export async function buildCloudRadar({campaigns=CAMPAIGNS,fetcher=fetch,now=new Date()}={}){
 const feed=makeRadar(campaigns,now);
 // 3 independent read-only checkers. No self-replication, logins, keys or claim signatures.
 const checks=await Promise.all(campaigns.map(x=>inspectOfficial(x,fetcher)));
 for(let i=0;i<checks.length;i++)Object.assign(feed.opportunities[i],checks[i]);
 feed.stats.public_source_matches=checks.filter(x=>x.source_confirmed).length;
 feed.stats.checked_public_sources=checks.length;
 feed.stats.pending_individual_verification=feed.opportunities.filter(x=>x.status!=='plazo_finalizado').length;
 return feed;
}
async function main(){
 const feed=await buildCloudRadar();await mkdir(path.dirname(OUT),{recursive:true});
 await writeFile(OUT,JSON.stringify(feed,null,2)+'\n','utf8');
 console.log(JSON.stringify({schema:feed.schema,generated_at:feed.generated_at,statistics:feed.stats,verified_income_usd:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1});
