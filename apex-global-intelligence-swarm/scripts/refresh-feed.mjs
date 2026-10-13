// Read-only periodic public source research, executes in authorized GitHub Actions.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SOURCES,normalize,allowedSource,classify,score,dedupeKey} from '../core.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stamp=new Date().toISOString();
const fetched=await Promise.all(SOURCES.map(async source=>{
  const start=Date.now();
  if(!allowedSource(source.endpoint))return {source:source.id,ok:false,count:0,error:'Host no permitido'};
  try{
    const response=await fetch(source.endpoint,{
      headers:{Accept:'application/json','User-Agent':'APEX-PRIME-X-Public-Research-Bot/0.1 (read-only; GitHub Actions)'},
      signal:AbortSignal.timeout(16000),redirect:'error'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const payload=await response.json();
    const items=normalize(source.id,payload);
    return {source:source.id,ok:true,count:items.length,ms:Date.now()-start,items};
  }catch(err){
    return {source:source.id,ok:false,count:0,ms:Date.now()-start,error:String(err?.message||err).slice(0,120)};
  }
}));
const seen=new Set();const opportunities=[];
for(const item of fetched.flatMap(x=>x.items||[])){
 const key=dedupeKey(item.url);
 if(seen.has(key))continue;seen.add(key);
 opportunities.push({source:item.source,external_id:item.external_id,title:item.title,url:item.url,
   evidence:item.evidence,source_created_at:item.source_created_at||null,opp_type:classify(item),
   score:score(item),link_check:item.api_open?'issue_abierto_segun_api':'formato_url_valido',
   legitimacy:'señal_no_verificada',dedupe_key:key});
}
opportunities.sort((a,b)=>b.score-a.score);
const status=fetched.every(x=>x.ok)?'ok':fetched.some(x=>x.ok)?'parcial':'error';
const feed={schema:'apex-public-research-v1',generated_at:stamp,status,
 description:'Hallazgos públicos no verificados, sin titularidad ni rentabilidad acreditada.',
 sources:fetched.map(({items,...rest})=>rest),items:opportunities.slice(0,40)};
const file=path.join(root,'feed','latest.json');
await fs.mkdir(path.dirname(file),{recursive:true});
await fs.writeFile(file,JSON.stringify(feed,null,2)+'\n','utf8');
console.log(JSON.stringify({generated_at:stamp,status,sources:feed.sources,items:feed.items.length}));
if(status==='error')console.warn('No se recibieron datos nuevos; nunca se generarán valores ficticios.');
