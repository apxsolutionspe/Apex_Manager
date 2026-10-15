// APEX: manually source-verified campaigns. No login, claims, signing or trading.
// These publicly documented conditions do not establish wallet/account eligibility.
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const VERIFIED_ANNOUNCEMENTS=Object.freeze([
 Object.freeze({
  id:'binance-bitcoin-academy-2026-10',
  title:'Binance Academy Bitcoin — cuestionario Learn & Earn, octubre de 2026',
  issuer:'Binance Academy',
  official_url:'https://www.binance.com/en/square/post/372547852237367',
  campaign_begins:'2026-10-01T00:00:00Z',
  campaign_end:null,
  announced_reward:'0.00001 BTC mediante cupón, sujeto a disponibilidad',
  account_created_after:'2026-10-01T00:00:00Z',
  monthly_cap:5000,
  conditions:['Cuenta nueva creada después del 1 de octubre de 2026 UTC','KYC del titular','Cuestionario con todas las respuestas correctas','Cupo mensual disponible','País admitido y normas del emisor'],
  requires_new_personal_account:true,
  known_deposit_required:false,
  reward_location:'Cupón canjeable dentro de Binance, no depósito directo en MetaMask',
  geographic_eligibility:'no_verificada',
  individual_eligibility:'no_verificada',
  current_quota:'no_verificada',
  wallet_transfer_supported:false,
  automatic_claim_supported:false,
  source_checked_by_research_on:'2026-10-15'
 })
]);
export function evaluateLead(c,{asOf=new Date(),registration=null,kyc=false,eligibleCountry=null}={}){
 if(!c||typeof c!=='object'||!/^https:\/\/www\.binance\.com\/en\/square\/post\/\d+$/.test(c.official_url))throw Error('Invalid official source');
 if(asOf.getTime()<new Date(c.campaign_begins).getTime())return {status:'not_started',may_claim:false};
 if(c.campaign_end&&asOf.getTime()>new Date(c.campaign_end).getTime())return {status:'expired',may_claim:false};
 if(registration && new Date(registration).getTime()<=new Date(c.account_created_after).getTime())
  return {status:'registration_ineligible',may_claim:false};
 if(eligibleCountry===false)return {status:'region_not_eligible',may_claim:false};
 if(!kyc||!registration||eligibleCountry!==true)return {status:'personal_eligibility_pending',may_claim:false};
 // An eligible-looking account still needs the quiz and unconfirmed allocation.
 return {status:'quota_and_issuer_confirmation_pending',may_claim:false};
}
export function createReport({asOf=new Date()}={}){
 return {schema:'apex-direct-crypto-leads-v1',generated_at:asOf.toISOString(),
  note:'Publicly documented campaign, not earned assets. No verification of claimability, availability, or transferred funds.',
  data:VERIFIED_ANNOUNCEMENTS.map(x=>({...x,...evaluateLead(x,{asOf})})),
  summary:{official_announcements:VERIFIED_ANNOUNCEMENTS.length,
   personally_eligible_verified:0,automatically_claimable:0,verified_income_usd:0,received_tokens:0}};
}
async function main(){
 const data=createReport();
 const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../feed/crypto-direct-leads.json');
 await mkdir(path.dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify(data,null,2)+'\n');
 console.log('APEX official conditional reward leads updated. No claims, transfers, or personal eligibility inferred.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(()=>{console.error('APEX verified lead preparation failed');process.exitCode=1});
