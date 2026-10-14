// APEX: conservative public-opportunity triage. No ownership inference or financial actions.
// Deterministic, auditable ranking; an 'investigar' tag NEVER verifies eligibility, budget or payment.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const MAX_ITEMS=160;
const CURRENT_DAYS=45;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const MS_DAY=86400000;
const claimRx=/\b(?:claim(?:able)?|unclaimed|ownerless|abandoned|lost|free)\s+(?:crypto|bitcoin|eth|tokens?|wallets?|funds?|money|assets?)\b/i;
const scamRx=/\b(?:send (?:us |me |your )?(?:seed|private key|crypto)|seed phrase|private key|guaranteed return|guaranteed profit|pay (?:a |the )?fee to (?:claim|unlock)|wallet drain|urgently claim|withdraw now)\b/i;
const closedRx=/\b(?:closed|ended|suspended|paused|cancelled|canceled|discontinued|already paid|bounty awarded|winners announced|expired|concluded|no longer accepting|freezes?|shuts? down)\b/i;
const positiveRx=/\b(?:bounty|reward|paid (?:task|issue)|sponsored issue|grant|prize|hackathon|competition|rewarded)\b/i;
const techRx=/\b(?:typescript|javascript|python|react|web app|web development|software|api|frontend|backend|plugin|open.source|website|ui\/ux)\b/i;
const exactMoneyRx=/(?:\$|usd\s*|us\$\s*)([\d,]+(?:\.\d{1,2})?)/ig;

export function classifySignal(item,now=Date.now()) {
  const title=String(item?.title||'').slice(0,300);
  const text=[title,String(item?.evidence||'').slice(0,800)].join(' ');
  const reasons=[];
  let risk=false;
  if(!title || !/^https:\/\//.test(String(item?.url||'')))return {status:'descartar',priority:0,reasons:['Título o URL HTTPS inválido'],checks:{eligibility:false,ownership:false,payment:false}};
  const copies=(title.match(/\[bounty\]/ig)||[]).length;
  if(copies>=3){risk=true;reasons.push('Título repetitivo, posible manipulación del puntaje');}
  if(scamRx.test(text)||claimRx.test(text)){risk=true;reasons.push('Patrón de reclamo de activos ajenos o solicitud de secretos');}
  const sums=[...text.matchAll(exactMoneyRx)].map(m=>Number(m[1].replace(/,/g,''))).filter(Number.isFinite);
  if(sums.some(n=>n>=1000000)){risk=true;reasons.push('Cifra extraordinaria sin acreditación');}
  if(closedRx.test(text)){reasons.push('Texto indica un programa terminado, suspendido o ya pagado');return {status:'descartar',priority:0,reasons,checks:{eligibility:false,ownership:false,payment:false}};}
  if(risk)return {status:'descartar',priority:0,reasons,checks:{eligibility:false,ownership:false,payment:false}};
  const isGitHub= item.source==='github' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+(?:[/?#]|$)/i.test(item.url||'');
  const open=Boolean(isGitHub && item.link_check==='issue_abierto_segun_api');
  const hasWords=positiveRx.test(text);
  const hasTitleWords=positiveRx.test(title);
  const hasMoney=sums.some(n=>n>0 && n<1000000);
  // A word 'bounty' in a software issue may describe the product, not a job.
  // Require published reward conditions and a direct budget claim before prioritizing.
  const termsLink=/https:\/\/github\.com\/[^\s)]+\/(?:blob|tree)\/[^\s)]*\/(?:BOUNTY|REWARDS|REWARD|FUNDING|PRIZES)\.md\b/i.test(text);
  const rewardTerms=/\b(?:payouts?|payments?|rewarded|reward pool|bounty pool|pay only after|paid after|prize money)\b/i.test(text);
  const aggregator=/\b(?:bounty alert|bounty solution|roundup|news|list of bounties|scanner's detection)\b/i.test(title);
  const described=String(item.evidence||'').trim().length>=100;
  const supportedOffer=hasMoney&&termsLink&&rewardTerms&&described&&!aggregator;
  const date=Date.parse(item.source_created_at||item.first_seen_at||'');
  const days=Number.isFinite(date)?Math.floor((now-date)/MS_DAY):Infinity;
  const fresh=days>=0 && days<=CURRENT_DAYS;
  let priority=(open?28:0)+(hasTitleWords?22:hasWords?7:0)+(techRx.test(text)?12:0)+(hasMoney?9:0)+(fresh?15:0)+(String(item.evidence||'').trim().length>=80?8:0);
  priority=Math.max(0,Math.min(90,priority));
  if(!open)reasons.push('No se confirmó que el issue esté abierto mediante la API original');
  if(!fresh)reasons.push('Fecha ausente, futura o anterior al período de revisión');
  if(!hasMoney)reasons.push('No aparece un importe publicado en el anuncio');
  if(!termsLink)reasons.push('Sin enlace a bases de recompensa en el registro');
  if(!rewardTerms)reasons.push('Sin descripción explícita de condiciones de pago');
  if(aggregator)reasons.push('Noticia o recopilación, no una oferta directa');
  if(!described)reasons.push('Descripción insuficiente para evaluar condiciones');
  if(!String(item.evidence||'').trim())reasons.push('Sin descripción de requisitos en el registro disponible');
  if(!hasWords)reasons.push('No hay indicación de incentivo remunerado');
  const status= open&&fresh&&hasTitleWords&&supportedOffer&&priority>=60?'investigar':'informativa';
  reasons.push(status==='investigar'?'Candidato para verificar bases oficiales, elegibilidad y condiciones de pago':'No cumple los criterios mínimos para priorización');
  return {status,priority,reasons,checks:{eligibility:false,ownership:false,payment:false},published_amount_usd:hasMoney?Math.max(...sums.filter(n=>n>0&&n<1000000)):null};
}

export function buildPrioritized(archive,{now=Date.now(),maxItems=MAX_ITEMS}={}){
 if(archive?.schema!=='apex-public-archive-v1'||!Array.isArray(archive.items))throw new Error('Archivo de señales no válido');
 const out=archive.items.map(x=>{
   const reviewed=classifySignal(x,now);
   return {source:x.source,title:String(x.title||'').slice(0,250),url:x.url,
    source_created_at:x.source_created_at||null,first_seen_at:x.first_seen_at||null,last_seen_at:x.last_seen_at||null,
    status:reviewed.status,priority:reviewed.priority,reasons:reviewed.reasons,
    checks:reviewed.checks,published_amount_usd:reviewed.published_amount_usd??null,
    monetary_value_received:0,verified_payment:false};
 });
 const order={investigar:0,informativa:1,descartar:2};
 out.sort((a,b)=>order[a.status]-order[b.status] || b.priority-a.priority || String(b.last_seen_at||'').localeCompare(String(a.last_seen_at||'')));
 const summary={total_evaluated:out.length,investigar:out.filter(x=>x.status==='investigar').length,
  informativa:out.filter(x=>x.status==='informativa').length,descartar:out.filter(x=>x.status==='descartar').length,
  verified_payouts:0,verified_income_usd:0};
 return {schema:'apex-prioritized-v1',generated_at:new Date(now).toISOString(),
  declaration:'Investigación pública no vinculante. Un issue abierto o una recompensa anunciada NO garantizan elegibilidad, titularidad, pago ni disponibilidad presupuestal. Sin cobros ni transferencias.',
  methodology:{version:1,fresh_days:CURRENT_DAYS,automatic_code_execution:false,automatic_claims:false,automatic_transfers:false},
  summary,items:out.slice(0,Math.max(1,Math.min(MAX_ITEMS,maxItems)))};
}

export async function verifyCandidatesOpen(data,{fetchImpl=fetch,token='',maxChecks=12}={}) {
 const candidates=data.items.filter(x=>x.status==='investigar').slice(0,maxChecks);
 await Promise.all(candidates.map(async x=>{
   const match=String(x.url||'').match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)(?:[/?#]|$)/);
   if(!match){x.status='informativa';x.reasons.push('URL del issue no verificable');return;}
   const endpoint='https://api.github.com/repos/'+encodeURIComponent(match[1])+'/'+encodeURIComponent(match[2])+'/issues/'+match[3];
   try {
     const response=await fetchImpl(endpoint,{headers:{Accept:'application/vnd.github+json','User-Agent':'APEX-PRIME-X-Public-Triage/1.1',...(token?{Authorization:'Bearer '+token}:{})},redirect:'error',signal:AbortSignal.timeout(8000)});
     if(!response.ok)throw new Error('HTTP '+response.status);
     const issue=await response.json();
     if(issue.state!=='open' || issue.pull_request){
       x.status='informativa';x.reasons.push('La API oficial confirmó que el issue ya no está abierto o no es un issue');
       x.checks.issue_open_now=false;
     }else{x.checks.issue_open_now=true;}
   }catch(error){
     x.status='informativa';x.reasons.push('Estado actual sin confirmar por API; no se prioriza ('+String(error?.message||error).slice(0,40)+')');
     x.checks.issue_open_now=null;
   }
 }));
 data.summary.investigar=data.items.filter(x=>x.status==='investigar').length;
 data.summary.informativa=data.summary.total_evaluated-data.summary.descartar-data.summary.investigar;
 const order={investigar:0,informativa:1,descartar:2};
 data.items.sort((a,b)=>order[a.status]-order[b.status]||b.priority-a.priority);
 return data;
}

async function main(){
 const archive=JSON.parse(await fs.readFile(path.join(root,'feed/archive.json'),'utf8'));
 const data=buildPrioritized(archive);
 await verifyCandidatesOpen(data,{token:process.env.GITHUB_TOKEN||''});
 const dest=path.join(root,'feed/prioritized.json');
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await fs.writeFile(dest,JSON.stringify(data,null,2)+'\n','utf8');
 console.log(JSON.stringify({time:data.generated_at,output:dest,...data.summary}));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1});
