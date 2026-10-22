// APEX_PRIME_X - public, read-only uptime and conversion-path monitor.
// Runs inside scheduled GitHub Actions. No customer data, scraping, login or posts.
import {writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const TARGETS = Object.freeze([
 {id:'servicios',url:'https://apxsolutionspe.github.io/Apex_Manager/servicios.html',
  required:['APEX PRIME X','https://wa.me/51931797758','./productos/cotizapro/','https://link.mercadopago.com.pe/apexprimex']},
 {id:'cotizapro',url:'https://apxsolutionspe.github.io/Apex_Manager/productos/cotizapro/',
  required:['CotizaPro','https://wa.me/51931797758','./app.mjs']},
 {id:'catalogoexpress',url:'https://apxsolutionspe.github.io/Apex_Manager/productos/catalogoexpress/',
  required:['CatálogoExpress','https://wa.me/51931797758','./app.mjs']},
 {id:'plantillas-premium',url:'https://apxsolutionspe.github.io/Apex_Manager/plantillas-premium.html',
  required:['Social Media Premium Kit','Pitch Deck Premium','https://wa.me/51931797758','https://link.mercadopago.com.pe/apexprimex']}
]);

export async function inspectTarget(target,{fetcher=fetch}={}) {
 const result={id:target.id,url:target.url,online:false,commercial_contact_ok:false};
 try{
   const response=await fetcher(target.url,{
     headers:{Accept:'text/html','User-Agent':'APEX-Prime-X-Website-Monitor/1.0'},
     redirect:'follow',signal:AbortSignal.timeout(12000)
   });
   result.http_status=response.status;
   if(!response.ok) {result.reason='http_status_'+response.status;return result;}
   const contentType=response.headers?.get('content-type')||'';
   if(!contentType.includes('text/html')){result.reason='unexpected_content_type';return result;}
   const body=await response.text();
   if(body.length>350000){result.reason='response_too_large';return result;}
   const absent=target.required.filter(s=>!body.includes(s));
   result.online=true;
   result.commercial_contact_ok=absent.length===0;
   result.reason=absent.length?'missing_required_conversion_elements':'ok';
 }catch(e){result.reason='network_unavailable';result.error_type=String(e?.name||'Error').slice(0,80);}
 return result;
}

export async function monitorSales(options={}) {
 const now=options.now||new Date();
 const results=await Promise.all(TARGETS.map(t=>inspectTarget(t,options)));
 return {
   schema:'apex-sales-health-v1',checked_at:now.toISOString(),
   results,
   healthy:results.every(t=>t.online&&t.commercial_contact_ok),
   payments_verified:false,
   note:'HTTP and contact-link checks only. Visits, leads, contracts and revenue are NOT measured.'
 };
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const output=await monitorSales();
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 await mkdir(path.join(root,'artifacts'),{recursive:true});
 await writeFile(path.join(root,'artifacts/sales-health.json'),JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({checked:output.results.map(x=>({
   id:x.id,http:x.http_status||null,contact:x.commercial_contact_ok,
   issue:x.reason})),all_healthy:output.healthy,verified_sales:'not_checked'}));
 if(!output.healthy)process.exitCode=1;
}
