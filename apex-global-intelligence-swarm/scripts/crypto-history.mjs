// Deterministic audit and ranking of public crypto research, not an income prediction.
// Read-only. No seed phrases, wallets, exchanges, signatures or account operations.
export const MAX_HISTORY_RUNS=168; // one week at an hourly cadence
function checksOf(x){return x?.source_confirmed===true?1:0;}
function allowedPrevious(x){return x?.schema==='apex-crypto-watch-v1' && Array.isArray(x.opportunities);}
function urgency(x,now){
 if(x.status==='plazo_finalizado')return 0;
 const deadline=Date.parse(x.deadline||'');
 if(!Number.isFinite(deadline))return 0;
 const hours=(deadline-now.getTime())/3600000;
 return hours>=0&&hours<=48?10:0;
}
export function researchPriority(x,now=new Date()){
 if(x.status==='plazo_finalizado')return {score:0,reason:'Plazo registrado como finalizado; no recomendar cobro'};
 // Score is research urgency ONLY, not profitability, odds or legal eligibility.
 let score=10+urgency(x,now)+(x.source_confirmed===true?30:0);
 if(x.requires_prior_assets)score-=35;
 if(x.requires_human_action)score-=8;
 if(x.requires_kyc)score-=7;
 if(x.official_page_access?.startsWith('error_'))score-=10;
 score=Math.max(0,Math.min(50,score));
 return {score,reason:x.source_confirmed===true?
  'Texto público coincidente; faltan elegibilidad, cupos y verificación del pago':
  'Fuente o condiciones pendientes de verificación independiente'};
}
export function applyResearchHistory(feed,previous=null){
 if(feed?.schema!=='apex-crypto-watch-v1'||!Array.isArray(feed.opportunities))throw new Error('Radar cripto actual inválido');
 if(previous!==null && !allowedPrevious(previous))throw new Error('Historial previo incompatible: no sobrescribir');
 const prevHistory=previous?.research_history?.runs;
 const oldRuns=Array.isArray(prevHistory)?prevHistory.slice(0,MAX_HISTORY_RUNS-1):[];
 const oldMap=new Map((previous?.research_history?.campaigns||[]).filter(x=>typeof x?.id==='string').map(x=>[x.id,x]));
 const now=new Date(feed.generated_at);
 if(!Number.isFinite(now.getTime()))throw new Error('Fecha de informe inválida');
 const items=feed.opportunities.map(x=>{
  const old=oldMap.get(x.id)||{};
  const matching=checksOf(x);
  const count=Math.max(0,Math.min(100000,Number(old.checked_runs)||0))+1;
  const matches=Math.max(0,Math.min(count-1,Number(old.source_matches)||0))+matching;
  const quality=matches/count;
  const rank=researchPriority(x,now);
  return {...x,research_priority:rank.score,research_reason:rank.reason,
   history:{checked_runs:count,source_matches:matches,source_match_rate_pct:Math.round(quality*100),
    last_status:x.status,last_seen_at:feed.generated_at,
    status_changed:typeof old.last_status==='string'&&old.last_status!==x.status}};
 });
 const record={at:feed.generated_at,checked_sources:Number(feed.stats?.checked_public_sources)||0,
  matching_sources:Number(feed.stats?.public_source_matches)||0,
  finished_by_date:items.filter(x=>x.status==='plazo_finalizado').length};
 const campaigns=items.map(x=>({id:x.id,...x.history}));
 const runs=[record,...oldRuns.filter(x=>x?.at!==record.at)].slice(0,MAX_HISTORY_RUNS);
 return {...feed,opportunities:items,research_history:{
  description:'Aprendizaje técnico limitado: tasa histórica de coincidencias de páginas, no rendimiento de inversiones ni pagos.',
  version:1,runs,campaigns,
  total_checks:runs.reduce((s,x)=>s+(x.checked_sources||0),0),
  total_public_matches:runs.reduce((s,x)=>s+(x.matching_sources||0),0)
 },ranking_note:'Prioridad de investigación, no predicción de ganancia, propiedad, elegibilidad ni cobro.'};
}
