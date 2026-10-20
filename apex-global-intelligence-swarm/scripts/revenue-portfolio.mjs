// APEX PRIME X: 120 product-market hypotheses, NOT 120 buyers or paid jobs.
// AI may build software and run tests, but cannot fabricate consent, clients,
// contract acceptance, processor onboarding or a payout receipt.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const CUSTOMER_SEGMENTS = Object.freeze([
  {id:'ferreterias',name:'ferreterías',needs:['catalog','quote','landing','contact'],weight:5},
  {id:'restaurantes',name:'restaurantes y cafeterías',needs:['catalog','landing','contact','site'],weight:5},
  {id:'servicios-ti',name:'técnicos de computadoras',needs:['quote','contact','landing','audit'],weight:5},
  {id:'instaladores',name:'instaladores de cámaras y redes',needs:['quote','catalog','landing','contact'],weight:5},
  {id:'repuestos',name:'tiendas de repuestos',needs:['catalog','contact','landing','seo'],weight:4},
  {id:'belleza',name:'salones y barberías',needs:['catalog','contact','landing','site'],weight:4},
  {id:'profesionales',name:'consultores independientes',needs:['quote','contact','landing','seo'],weight:4},
  {id:'contabilidad',name:'estudios contables',needs:['quote','contact','landing','seo'],weight:4},
  {id:'educacion',name:'academias y tutores',needs:['catalog','landing','contact','site'],weight:3},
  {id:'turismo',name:'agencias de turismo',needs:['catalog','landing','contact','site'],weight:3},
  {id:'agro',name:'distribuidores agrícolas',needs:['catalog','quote','contact','landing'],weight:3},
  {id:'logistica',name:'servicios de transporte y logística',needs:['quote','contact','landing','site'],weight:3}
]);

export const SOFTWARE_OFFERS = Object.freeze([
  {id:'catalog',name:'Catálogo digital con carrito y pedido por WhatsApp',value:'Mostrar productos y recibir solicitudes',asset:'productos/catalogoexpress/',maturity:3},
  {id:'quote',name:'Cotizador en soles con exportación CSV',value:'Preparar presupuestos y compartirlos',asset:'productos/cotizapro/',maturity:3},
  {id:'landing',name:'Página de servicios profesional responsive',value:'Presentar soluciones y recibir contactos',asset:'servicios.html',maturity:2},
  {id:'contact',name:'Formulario guiado de solicitud por WhatsApp',value:'Facilitar una consulta comercial voluntaria',asset:'servicios.html',maturity:3},
  {id:'site',name:'Micrositio de marca optimizado para móviles',value:'Presentar información corporativa',asset:'servicios.html',maturity:2},
  {id:'seo',name:'Auditoría SEO técnica de sitio existente',value:'Corregir metadatos y rutas públicas',asset:'servicios.html',maturity:2},
  {id:'audit',name:'Pruebas automáticas de enlaces comerciales',value:'Evitar enlaces de contacto rotos',asset:'servicios.html',maturity:3},
  {id:'faq',name:'Página de preguntas frecuentes verificadas',value:'Responder dudas con información suministrada',asset:'servicios.html',maturity:1},
  {id:'proposal',name:'Plantilla editable de propuesta comercial',value:'Estandarizar alcance y condiciones',asset:'productos/cotizapro/',maturity:2},
  {id:'mobile',name:'Diagnóstico y corrección de experiencia móvil',value:'Reducir errores de visualización y formularios',asset:'servicios.html',maturity:2}
]);

const REPOSITORY_BASE = 'https://apxsolutionspe.github.io/Apex_Manager/';
const ISSUE = /^https:\/\/github\.com\/[a-z\d_.-]+\/[a-z\d_.-]+\/issues\/[1-9]\d*$/i;
const BLOCK = /bounty[-_ ]plaza|awesome[-_ ]agent[-_ ]bounties|sn[-_ ]monetization[-_ ]runtime|bounty[-_ ]feed/i;
const UNFUNDED = /\b(?:proposal|proposed|tentative|unfunded|to be posted|undecided|pending funding|not funded|on hold)\b/i;
const DANGER = /\b(?:private key|seed phrase|wallet credentials|deposit first|pay to join|pay a fee to claim|guaranteed profit|staking required|escrow bond)\b/i;

export function makePortfolio({max=120}={}){
  if (!Number.isInteger(max) || max<1 || max>120) throw Error('Máximo de ideas inválido');
  const ideas=[];
  for(const offer of SOFTWARE_OFFERS)for(const sector of CUSTOMER_SEGMENTS){
    const fit=sector.needs.includes(offer.id)?3:1;
    const score=Math.min(100,30+sector.weight*6+offer.maturity*8+fit*3);
    ideas.push({
      id:offer.id+'-'+sector.id,
      description:offer.name+' para '+sector.name,
      target_segment:sector.name,
      value_proposition:offer.value,
      prototype_url:REPOSITORY_BASE+offer.asset,
      idea_only:true, buyer_interest_verified:false,
      payer_connected_verified:false, paid_contract_verified:false,
      received_amount_pen:0,
      technical_delivery_automatable:true,
      payment_acceptance_automatable:false,
      source:'internal-product-market-hypothesis',
      fit_score:score,
      commercial_action:'publica una página útil; permite que el cliente solicite presupuesto voluntariamente'
    });
  }
  ideas.sort((a,b)=>b.fit_score-a.fit_score||a.id.localeCompare(b.id));
  return ideas.slice(0,max);
}

export function assessPublicBounty(row, now=new Date()){
  const url=String(row?.url||'');
  if(!ISSUE.test(url) || BLOCK.test(url))return null;
  const title=String(row?.title||'').slice(0,240);
  const amount=Number(row?.advertised_usd_unverified??row?.published_amount_usd??0);
  const text=(title+' '+String(row?.evidence||'')).slice(0,1000);
  const created=Date.parse(row?.source_created_at||row?.first_seen_at||row?.last_updated||'');
  if(!title || !Number.isFinite(created)||created>now.getTime()+86400000||now.getTime()-created>92*86400000)return null;
  if(!Number.isFinite(amount)||amount<=0||amount>10000||DANGER.test(text))return null;
  const markedUnfunded=UNFUNDED.test(text);
  const proposalOnly=/\b(?:bounty proposal|proposed tier|proposed reward)\b/i.test(text);
  const eligibleNow=!(markedUnfunded||proposalOnly);
  return {
    title,issue_url:url,advertised_usd_unverified:amount,
    sponsor_verified:false, funded_reward_verified:false,
    claimed_by_apex:false,payment_eligibility_verified:false,
    received_income_usd:0,
    stage:eligibleNow?'needs_original_sponsor_and_payout_review':'not_funded_or_merely_proposed',
    suitability:eligibleNow?'investigate_original_terms':'reject_unconfirmed_promise',
    priority_score:(eligibleNow?40:0)+Math.max(0,20-Math.floor((now.getTime()-created)/86400000))
  };
}

export function buildReport({archive,at=new Date()}={}){
  const data=archive?.items&&Array.isArray(archive.items)?archive.items:[];
  const ideas=makePortfolio();
  const checked=data.map(x=>assessPublicBounty(x,at)).filter(Boolean);
  const filtered=checked.filter(x=>x.suitability==='investigate_original_terms')
    .sort((a,b)=>b.priority_score-a.priority_score)
    .slice(0,12);
  return {
    schema:'apex-revenue-portfolio-v1',generated_at:at.toISOString(),
    status:'research_only_not_revenue',
    summary:{
      product_market_hypotheses:ideas.length,existing_software_offers:SOFTWARE_OFFERS.length,
      target_segments:CUSTOMER_SEGMENTS.length,
      public_records_evaluated:data.length,
      public_issue_candidates_requiring_primary_verification:filtered.length,
      funded_jobs_verified:0,paid_contracts_verified:0,
      verified_new_income_pen:0, verified_new_income_usd:0,
      payments_not_connected_to_this_report:true
    },
    ideas:ideas.slice(0,25),
    code_opportunities:filtered,
    blockers:[
      'No hay un procesador o cuenta de cobro confirmada en esta automatización',
      'Un anuncio con monto no demuestra presupuesto depositado, aceptación ni elegibilidad en Perú',
      'Los clientes deben solicitar y aprobar un encargo de forma voluntaria',
      'Una mejora técnica publicada no es una venta',
      'No se puede completar KYC, aceptar acuerdos ni retirar fondos sin el titular'
    ],
    protections:[
      'Presupuesto S/20 reservado: ningún gasto ejecutado',
      'Sin promesas de rentabilidad ni ventas ficticias',
      'Sin spam, scraping protegido, cuentas ajenas, inversiones ni pagos',
      'Las 120 combinaciones son ideas comerciales, NO 120 agentes en ejecución'
    ]
  };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const tryRead=async f=>{try{return JSON.parse(await readFile(f,'utf8'));}catch{return null;}};
 const archive=await tryRead(path.join(ROOT,'feed/prioritized.json'));
 const report=buildReport({archive});
 await mkdir(path.join(ROOT,'artifacts'),{recursive:true});
 await writeFile(path.join(ROOT,'artifacts/revenue-portfolio.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report.summary));
}
