// Pure public-source processors. Never handles secrets or financial transfers.
export const MIN_INTERVAL_MS = 5*60*1000;
export const SOURCES = [
  {id:'hackernews',label:'Hacker News (Algolia)',endpoint:'https://hn.algolia.com/api/v1/search_by_date?query=bounty&tags=story&hitsPerPage=25'},
  {id:'github',label:'GitHub — Issues abiertos',endpoint:'https://api.github.com/search/issues?q=bounty+is%3Aissue+is%3Aopen&sort=created&order=desc&per_page=25'}
];
export function safeText(v,max=600) {
  return String(v??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
export function safeUrl(v) {
  try { const u=new URL(String(v)); if(!['https:','http:'].includes(u.protocol)) return null;u.username='';u.password='';return u.toString(); } catch {return null;}
}
export function allowedSource(u) {try{const x=new URL(u);return x.protocol==='https:' && ['hn.algolia.com','api.github.com'].includes(x.hostname)}catch{return false}}
export function safeHtml(v) {return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function dedupeKey(link) { try {const u=new URL(link);u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_')||k==='ref')u.searchParams.delete(k);return u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/+$/,'')+u.search} catch{return String(link)} }
export function normalize(source,data){
 const arr=source==='hackernews'?(Array.isArray(data?.hits)?data.hits:[]):(Array.isArray(data?.items)?data.items:[]);
 return arr.map(x=>{
   const url=safeUrl(source==='hackernews'?(x.url||('https://news.ycombinator.com/item?id='+x.objectID)):x.html_url);
   const title=safeText(x.title,250);
   if(!url||!title) return null;
   if(source==='github' && new URL(url).hostname!=='github.com')return null;
   return {source, external_id:String(source==='hackernews'?x.objectID:x.id),title,url,
    evidence:safeText(source==='hackernews'?x.story_text:x.body,550),
    author:safeText(source==='hackernews'?x.author:x.user?.login,90),
    source_created_at:source==='hackernews'?x.created_at:x.created_at,
    api_open:source==='github'&&x.state==='open',
    engagement:Number(source==='hackernews'?(x.points||0)+(x.num_comments||0):x.comments||0)};
 }).filter(Boolean);
}
export function classify(x) {
 const t=(x.title+' '+x.evidence).toLowerCase();
 if(/security|vulnerab|bug bounty|cve|seguridad/.test(t))return 'bug_bounty';
 if(/grant|funding|subvenci|financia/.test(t))return 'subvencion';
 if(/prize|hackathon|concurso|contest|premio/.test(t))return 'concurso';
 if(/bounty|reward|recompensa/.test(t))return 'bounty_codigo';
 return 'otro';
}
export function score(x,keywords=['bounty','grant','reward','funding','prize'],now=Date.now()){
 const t=x.title.toLowerCase(), b=x.evidence.toLowerCase();
 const ks=keywords.map(s=>String(s).trim().toLowerCase()).filter(Boolean);
 const a=Math.min(45,ks.filter(k=>t.includes(k)).length*15);
 const txt=Math.min(20,ks.filter(k=>b.includes(k)).length*5);
 const age=x.source_created_at?(now-Date.parse(x.source_created_at))/86400000:Infinity;
 const recent=age>=0&&age<=7?15:age<=30&&age>=0?8:0;
 return Math.max(0,Math.min(100,a+txt+recent+(x.api_open?10:0)+Math.min(10,Math.round(Math.log2(1+Math.max(0,x.engagement||0))*2))));
}
export function validateSecret(s){
 const t=String(s||'').trim();
 if(/-----BEGIN .*PRIVATE KEY-----/i.test(t)||/\b(?:0x)?[a-f\d]{64}\b/i.test(t)) return 'Posible clave privada';
 if(/\b(?:sk_live_|github_pat_|ghp_|xoxb-|AKIA)[\w-]{10,}/i.test(t))return 'Posible credencial';
 if(/\b\d{12,19}\b/.test(t.replace(/[ -]/g,'')))return 'Posible número de cuenta';
 const words=t.split(/\s+/);
 if(words.length>=12&&words.length<=24&&words.every(w=>/^[a-z]{3,10}$/.test(w)))return 'Posible frase semilla';
 if(/(?:frase semilla|private key|contraseña|seed phrase|password)\s*[:=]/i.test(t))return 'Posible secreto';
 return null;
}
export function csv(rows) {
 if(!rows.length)return '';
 const cols=Object.keys(rows[0]);
 const cell=v=>{let t=typeof v==='object'?JSON.stringify(v):String(v??'');if(/^[=+\-@]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
 return [cols.map(cell).join(','),...rows.map(x=>cols.map(k=>cell(x[k])).join(','))].join('\n');
}
