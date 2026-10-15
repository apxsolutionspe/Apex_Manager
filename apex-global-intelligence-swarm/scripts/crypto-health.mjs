// Public diagnostic roll-up. Never access secrets, wallet addresses, or private balances.
// Do not infer income or eligibility from announcements, rewards, or transfers.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const discoveryPath=path.join(ROOT,'feed/crypto-discovery.json');
const out=path.join(ROOT,'feed/crypto-health.json');
export const GROUPS=Object.freeze([
 'security_blocked','capital_or_trading','historical_reference',
 'work_or_security_review','project_grant_not_passive',
 'gas_fee_and_conditions_review','manual_participation',
 'informational_not_passive','unverified_no_capital_evidence'
]);
export function summarizeResearch(discovery,{now=new Date()}={}){
 if(discovery?.schema!=='apex-crypto-discovery-v1'||!Array.isArray(discovery.sources)||
    !Array.isArray(discovery.opportunities)||!discovery.stats||
    !Number.isFinite(new Date(discovery.generated_at).getTime()))
  throw Error('Invalid discovery evidence');
 const categories=Object.fromEntries(GROUPS.map(group=>[group,0]));
 for(const item of discovery.opportunities){
  if(!GROUPS.includes(item.review_group))throw Error('Unrecognized opportunity category');
  categories[item.review_group]++;
  if(item.claimed!==false||item.reward_received!==false)
   throw Error('Unverified announcement cannot declare receipt');
 }
 const failureByType={access_denied:0,upstream_error:0,network_failure:0,size_limit:0,unexpected_type:0,other:0};
 const unsuccessful=[];
 for(const source of discovery.sources){
  if(source.result==='read')continue;
  const kind=source.result==='http_403'||source.result==='http_401'?'access_denied':
   /^http_5\d{2}$/.test(source.result)?'upstream_error':
   source.result==='network_or_redirect_error'?'network_failure':
   source.result==='size_limit'?'size_limit':
   source.result==='unexpected_type'?'unexpected_type':'other';
  failureByType[kind]++;
  unsuccessful.push({source:source.id,reason:kind});
 }
 const checked=discovery.sources.length,available=discovery.sources.filter(x=>x.result==='read').length;
 const ageHours=Math.max(0,Math.floor((now-new Date(discovery.generated_at))/3600000));
 const prioritizable=categories.unverified_no_capital_evidence;
 // Still not verified as free: an absence of capital keywords in headlines is not proof.
 return {schema:'apex-crypto-health-v1',generated_at:now.toISOString(),
  observed_at:discovery.generated_at,
  automation:'bounded scheduled public-source monitoring; not unrestricted browsing',
  health:{sources_configured:checked,sources_read:available,sources_unavailable:checked-available,
   failure_types:failureByType,unavailable_sources:unsuccessful,source_report_age_hours:ageHours,
   native_classifier_confirmed:discovery.stats.native_classifier_used===true},
  triage:{announcements_seen:discovery.opportunities.length,
   classified:categories,research_candidates_without_obvious_capital_keywords:prioritizable,
   independently_verified_free_rewards:0,personally_eligible_verified:0,
   verified_received_rewards:0,verified_income_usd:0},
  note:'No amount of scans proves ownership, eligibility, a free grant or a deposit. Private wallet state is never sent to this report.'};
}
async function main(){
 const discovery=JSON.parse(await readFile(discoveryPath,'utf8'));
 const summary=summarizeResearch(discovery);
 await mkdir(path.dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(summary,null,2)+'\n');
 console.log('APEX HEALTH: public source diagnostics updated. Confirmed reward income remains 0.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(()=>{console.error('APEX HEALTH: public diagnostics unavailable; no inferred earnings');process.exitCode=1});
