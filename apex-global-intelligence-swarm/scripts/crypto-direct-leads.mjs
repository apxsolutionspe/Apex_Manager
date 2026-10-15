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
 }) ,
 Object.freeze({
  id:'binance-wotd-intelligence-2026-10',
  title:'Binance Word of the Day · 5 palabras correctas, categoría sin trading',
  issuer:'Binance',
  official_url:'https://www.binance.com/en/square/post/376351996964354',
  campaign_begins:'2026-10-12T00:00:00Z',
  campaign_end:'2026-10-18T23:59:00Z',
  announced_reward:'Participación proporcional en fondo de 3,000 USDC, sujeto a elegibilidad y resultados',
  account_created_after:null,
  monthly_cap:null,
  conditions:['Cuenta de Binance verificada (antigua o nueva)','País admitido','Acertar al menos 5 palabras antes del cierre','Canje de cualquier vale en Rewards Hub; premios variables y no garantizados','La categoría adicional de 7,000 USDC exige trading: NO priorizada'],
  requires_new_personal_account:false,
  known_deposit_required:false,
  reward_location:'Binance Rewards Hub; no depósito directo en MetaMask',
  geographic_eligibility:'no_verificada',
  individual_eligibility:'no_verificada',
  current_quota:'no_verificada',
  wallet_transfer_supported:false,
  automatic_claim_supported:false,
  source_checked_by_research_on:'2026-10-15'
 }),
 Object.freeze({
  id:'binance-ai-feedback-2026-10',
  title:'Binance AI · opiniones auténticas, 25 premios de 20 USDC',
  issuer:'Binance',
  official_url:'https://www.binance.com/en/support/announcement/detail/8fd1fe0094b34442b322c177894666bf',
  campaign_begins:'2026-10-12T12:00:00Z',
  campaign_end:'2026-10-18T23:59:00Z',
  announced_reward:'20 USDC en vales para 25 ganadores seleccionados por calidad',
  account_created_after:null,
  monthly_cap:25,
  conditions:['Cuenta Binance verificada de país participante','Probar Binance AI y redactar opiniones verdaderas','Seguir Binance Angels en X y republicar el post oficial con #BinanceAI','Enviar enlace del post al canal #builders-chat del Discord oficial','Ganadores elegidos por criterio del organizador; distribución prevista hasta 30 de octubre'],
  requires_new_personal_account:false,
  known_deposit_required:false,
  reward_location:'Binance Rewards Hub; no depósito directo en MetaMask',
  geographic_eligibility:'no_verificada',
  individual_eligibility:'no_verificada',
  current_quota:'no_verificada',
  wallet_transfer_supported:false,
  automatic_claim_supported:false,
  source_checked_by_research_on:'2026-10-15'
 })
]);
export function evaluateLead(c,{asOf=new Date(),registration=null,kyc=false,eligibleCountry=null}={}){
 if(!c||typeof c!=='object'||!/^https:\/\/www\.binance\.com\/(?:en\/square\/post\/\d+|en\/support\/announcement\/detail\/[a-f0-9]{32})$/.test(c.official_url))throw Error('Invalid official source');
 if(asOf.getTime()<new Date(c.campaign_begins).getTime())return {status:'not_started',may_claim:false};
 if(c.campaign_end&&asOf.getTime()>new Date(c.campaign_end).getTime())return {status:'expired',may_claim:false};
 if(c.requires_new_personal_account && registration && new Date(registration).getTime()<=new Date(c.account_created_after).getTime())
  return {status:'registration_ineligible',may_claim:false};
 if(eligibleCountry===false)return {status:'region_not_eligible',may_claim:false};
 if(!kyc||!registration||eligibleCountry!==true)return {status:'personal_eligibility_pending',may_claim:false};
 // An eligible-looking account still needs the quiz and unconfirmed allocation.
 return {status:'quota_and_issuer_confirmation_pending',may_claim:false};
}
export function createReport({asOf=new Date(),includeNewUserOnly=false}={}){
 // The actionable dashboard is tailored to already-existing accounts by default.
 // No private registration date or customer/account information is ever published.
 const excluded=VERIFIED_ANNOUNCEMENTS.filter(x=>x.requires_new_personal_account&&!includeNewUserOnly);
 const eligibleForResearch=VERIFIED_ANNOUNCEMENTS.filter(x=>includeNewUserOnly||!x.requires_new_personal_account);
 return {schema:'apex-direct-crypto-leads-v1',generated_at:asOf.toISOString(),
  note:'Only informational research. No personal eligibility, account metadata, earned assets or transactions are stored.',
  data:eligibleForResearch.map(x=>({...x,...evaluateLead(x,{asOf})})),
  summary:{official_announcements:VERIFIED_ANNOUNCEMENTS.length,
   excluded_new_account_only:excluded.length,actionable_research_candidates:eligibleForResearch.length,
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
