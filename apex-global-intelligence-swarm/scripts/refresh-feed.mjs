// APEX Global Intelligence Swarm: public, read-only research and traceable archive.
// No private data, wallet actions, network probing, transaction signing or asset claims.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SOURCES,normalize,allowedSource,classify,score,dedupeKey} from '../core.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stamp=new Date().toISOString();
const rootFeed=path.join(root,'feed');
const archiveFile=path.join(rootFeed,'archive.json');
const latestFile=path.join(rootFeed,'latest.json');
const SOURCE_LIMIT=50;
const ARCHIVE_LIMIT=1200;
const RUN_LIMIT=56;

const fetched=await Promise.all(SOURCES.map(async source=>{
 const start=Date.now();
 if(!allowedSource(source.endpoint))return {source:source.id,ok:false,count:0,error:'Host no permitido'};
 try{
  const response=await fetch(source.endpoint,{
   headers:{Accept:'application/json','User-Agent':'APEX-PRIME-X-Public-Research/0.2 (+https://apxsolutionspe.github.io/Apex_Manager/)'},
   signal:AbortSignal.timeout(16000),redirect:'error'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const payload=await response.json();
  const items=normalize(source.id,payload).slice(0,SOURCE_LIMIT);
  return {source:source.id,ok:true,count:items.length,ms:Date.now()-start,items};
 }catch(err){
  return {source:source.id,ok:false,count:0,ms:Date.now()-start,error:String(err?.message||err).slice(0,120)};
 }
}));
const sourceResults=fetched.map(({items,...status})=>status);
const collected=fetched.flatMap(x=>x.items||[]);
const uniq=new Map();
for(const item of collected){
 const key=dedupeKey(item.url);
 if(!uniq.has(key))uniq.set(key,item);
}
const opportunities=[...uniq.entries()].map(([key,x])=>({
 source:x.source,external_id:x.external_id,title:x.title,url:x.url,
 evidence:x.evidence,source_created_at:x.source_created_at||null,
 opp_type:classify(x),score:score(x),link_check:x.api_open?'issue_abierto_segun_api':'formato_url_valido',
 legitimacy:'señal_no_verificada',dedupe_key:key
})).sort((a,b)=>b.score-a.score);
const status=sourceResults.every(x=>x.ok)?'ok':sourceResults.some(x=>x.ok)?'parcial':'error';
const steps=[
 {agent:'Recolector',status:status==='ok'?'completado':status==='parcial'?'parcial':'error',detail:sourceResults.map(x=>x.source+': '+(x.ok?x.count+' documentos':x.error)).join('; ')},
 {agent:'Normalizador',status:'completado',detail:collected.length+' documentos de fuentes públicas normalizados'},
 {agent:'Deduplicador',status:'completado',detail:(collected.length-uniq.size)+' duplicados en el lote actual'},
 {agent:'Clasificador',status:'completado',detail:opportunities.length+' señales clasificadas por reglas heurísticas'},
 {agent:'Verificador',status:'limitado',detail:opportunities.filter(x=>x.link_check==='issue_abierto_segun_api').length+' issues abiertos según API; no se comprobó elegibilidad ni pago'},
 {agent:'Evaluador económico',status:'pendiente',detail:'Sin estimaciones fiables de valor ni rentabilidad; revisión humana necesaria'},
 {agent:'Auditor',status:'completado',detail:'Consulta fechada con fuentes, errores y trazabilidad públicos'}
];
let previous={schema:'apex-public-archive-v1',items:[],runs:[]};
try{
 const txt=await fs.readFile(archiveFile,'utf8');
 const parsed=JSON.parse(txt);
 if(parsed.schema!=='apex-public-archive-v1'||!Array.isArray(parsed.items)||!Array.isArray(parsed.runs))throw new Error('Historial inválido');
 previous=parsed;
}catch(e){if(e.code!=='ENOENT')throw e;}
const merged=new Map(previous.items.map(x=>[x.dedupe_key,x]));
let added=0,seenAgain=0;
for(const x of opportunities){
 const prior=merged.get(x.dedupe_key);
 if(prior){seenAgain++;merged.set(x.dedupe_key,{...prior,...x,first_seen_at:prior.first_seen_at||stamp,last_seen_at:stamp});}
 else{added++;merged.set(x.dedupe_key,{...x,first_seen_at:stamp,last_seen_at:stamp});}
}
const archiveItems=[...merged.values()].sort((a,b)=>String(b.last_seen_at).localeCompare(String(a.last_seen_at))).slice(0,ARCHIVE_LIMIT);
const run={id:stamp,generated_at:stamp,status,sources:sourceResults,processed:collected.length,
 unique_in_cycle:opportunities.length,new_items:added,seen_again:seenAgain,archive_total:archiveItems.length,steps};
const archive={schema:'apex-public-archive-v1',updated_at:stamp,retention:{max_items:ARCHIVE_LIMIT,max_runs:RUN_LIMIT},
 description:'Historial limitado de señales públicas no verificadas, no saldos ni activos adquiridos.',
 items:archiveItems,runs:[run,...previous.runs].slice(0,RUN_LIMIT)};
const feed={schema:'apex-public-research-v1',generated_at:stamp,status,
 description:'Señales no verificadas de fuentes públicas; no ofrecen titularidad, pago ni rentabilidad acreditada.',
 sources:sourceResults,steps,statistics:{collected:collected.length,unique_in_cycle:opportunities.length,new_items:added,seen_again:seenAgain,archive_total:archiveItems.length},
 items:opportunities.slice(0,40)};
await fs.mkdir(rootFeed,{recursive:true});
await Promise.all([
 fs.writeFile(latestFile,JSON.stringify(feed,null,2)+'\n','utf8'),
 fs.writeFile(archiveFile,JSON.stringify(archive,null,2)+'\n','utf8')
]);
console.log(JSON.stringify({generated_at:stamp,status,sources:sourceResults,
 current_feed:feed.items.length,archived:archiveItems.length,new_items:added,
 steps:steps.map(x=>({agent:x.agent,status:x.status}))}));
if(status==='error')console.warn('Ninguna fuente respondió correctamente; no se inventan registros.');
