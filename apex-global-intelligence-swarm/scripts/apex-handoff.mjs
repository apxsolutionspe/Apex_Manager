// Public cross-chat continuity snapshot; only public research evidence, never wallet secrets.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const INPUTS=['crypto-discovery.json','crypto-health.json','crypto-direct-leads.json','crypto.json'];
const OUT=path.join(ROOT,'feed/apex-handoff.json');
export function buildHandoff({discovery,health,leads,crypto,now=new Date()}){
 if(discovery?.schema!=='apex-crypto-discovery-v1'||
    health?.schema!=='apex-crypto-health-v1'||
    leads?.schema!=='apex-direct-crypto-leads-v1'||
    crypto?.schema!=='apex-crypto-watch-v1')throw Error('Missing or invalid public feeds');
 if(!Number.isFinite(new Date(discovery.generated_at).getTime())||
    !Number.isFinite(new Date(health.generated_at).getTime())||
    !Number.isFinite(new Date(leads.generated_at).getTime()))throw Error('Invalid source timestamps');
 const eligible=Number(leads.summary?.personally_eligible_verified);
 const verifiedIncome=Number(crypto.economics?.verified_income_usd);
 if(eligible!==0||verifiedIncome!==0||Number(leads.summary?.verified_income_usd)!==0||
    health.triage?.verified_income_usd!==0||discovery.stats?.confirmed_eligible!==0||
    discovery.stats?.verified_deposits!==0)throw Error('Unverified financial evidence; require manual validation');
 const safeInt=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max?v:null;
 const checked=safeInt(health.health?.sources_configured,1000);
 const read=safeInt(health.health?.sources_read,1000);
 const candidates=safeInt(discovery.stats?.candidate_announcements,1000);
 const newCandidates=safeInt(discovery.stats?.new_candidate_count,1000);
 if(checked===null||read===null||read>checked||candidates===null||newCandidates===null||newCandidates>candidates)
  throw Error('Invalid public research counters');
 const data={
  schema:'apex-project-handoff-v1',
  generated_at:now.toISOString(),
  research_observed_at:discovery.generated_at,
  project:'APEX PRIME X / Apex_Manager',
  repository:'https://github.com/apxsolutionspe/Apex_Manager',
  continuity_guide:'https://github.com/apxsolutionspe/Apex_Manager/blob/main/APEX_CONTINUIDAD.md',
  radar:'https://apxsolutionspe.github.io/Apex_Manager/crypto.html',
  job:'https://github.com/apxsolutionspe/Apex_Manager/actions/workflows/apex-crypto-hourly.yml',
  state:{
   sources_configured:checked,sources_read:read,
   announcements_for_review:candidates,new_announcements_in_last_scan:newCandidates,
   user_specific_eligibility_verified:0,verified_income_usd:0
  },
  operating_mode:'scheduled source checks, public reports, private watch-only wallet checks; no unattended transfers',
  pending:[
   'Validate qualifying rewards with original issuer and country conditions',
   'Activate and test encrypted deposit audit once APEX_WALLET_AUDIT_KEY is saved in GitHub Actions secrets',
   'Add private incident notifications without exposing the monitored wallet',
   'Improve availability of official blocked/oversized sources without bypassing protections'
  ],
  note:'Public research statistics only. Never include wallet addresses, balances, seed phrases, keys, transfers, or account registration.'
 };
 // Defense in depth: serialize only fixed fields above; no full input feeds are copied.
 return data;
}
export function continuityPrompt(doc='https://github.com/apxsolutionspe/Apex_Manager/blob/main/APEX_CONTINUIDAD.md'){
 return 'Continúa APEX PRIME X. Lee '+doc+
 '. Después revisa https://github.com/apxsolutionspe/Apex_Manager/blob/main/apex-global-intelligence-swarm/feed/apex-handoff.json y la última ejecución de GitHub Actions. Verifica pruebas y reportes, continúa las fases pendientes sin empezar de cero. No divulgues secretos, no firmes transacciones ni declares ganancias sin evidencia de pago real.';
}
async function main(){
 const [discovery,health,leads,crypto]=await Promise.all(INPUTS.map(async name=>
  JSON.parse(await readFile(path.join(ROOT,'feed',name),'utf8'))));
 const handoff=buildHandoff({discovery,health,leads,crypto});
 await mkdir(path.dirname(OUT),{recursive:true});
 await writeFile(OUT,JSON.stringify(handoff,null,2)+'\n');
 console.log('APEX HANDOFF: public continuity snapshot updated without wallet data.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(()=>{console.error('APEX HANDOFF: public evidence invalid; nothing published');process.exitCode=1});
