import {MIN_INTERVAL_MS,SOURCES,safeHtml,safeUrl,allowedSource,normalize,classify,score,dedupeKey,validateSecret,csv} from './core.js';

// SUPABASE_PUBLISHABLE_KEY is a public client key, never a service-role secret.
// The database enforces private per-user rows via RLS.
const CLOUD_URL='https://c--16c5cc6e-4412-4810-bac2-450de50a424f-prod.lovable.cloud';
const PUBLIC_KEY='sb_publishable_YIrgK1sba_v0uUJy-OnDgQ_4XgR0fvt';
const KEYS=['bounty','grant','reward','funding','prize'];
const DEFAULTS={keywords:KEYS,interval_minutes:15,max_items:20,min_score:0,enabled_sources:['hackernews','github']};
const META={
 dashboard:['Centro de inteligencia','Visión general de hallazgos, fuentes y actividad en tiempo real.'],
 explore:['Exploración autónoma','Ciclos de consulta públicos con agentes lógicos trazables y límites de red.'],
 opportunities:['Oportunidades','Señales detectadas. Ninguna constituye un activo o derecho económico acreditado.'],
 approval:['Centro de aprobaciones','La revisión y el archivo personal requieren intervención humana.'],
 vault:['Mi bóveda personal','Expedientes privados y evidencia descriptiva; nunca custodia de fondos.'],
 agents:['Enjambre de agentes','Módulos lógicos verificables: v0.1 NO despliega miles de procesos.'],
 sources:['Fuentes públicas','Conectores habilitados, estado de consultas y restricciones de proveedores.'],
 audit:['Auditoría','Historial de escaneos y decisiones de tu cuenta.'],
 settings:['Configuración','Parámetros del sistema y controles de autonomía durante sesión.']
};
const NAV=[['dashboard','◫','Panel general'],['explore','◎','Exploración'],['opportunities','⌕','Oportunidades'],['approval','✓','Aprobaciones'],['vault','▣','Mi bóveda'],['agents','⬡','Agentes'],['sources','◉','Fuentes'],['audit','≡','Auditoría'],['settings','⚙','Configuración']];
const state={page:'dashboard',client:null,user:null,authAvailable:false,booted:false,busy:false,auto:false,killed:false,
 nextAt:0,lastRun:0,abort:null,opps:[],runs:[],vault:[],decisions:[],logs:[],settings:{...DEFAULTS},
 filter:'',type:'todos',status:'todos',selected:'',modal:'',lastError:'',latestSteps:[],lastSources:[],activeScan:0,feed:null,feedError:''};
const root=document.getElementById('root');
const h=x=>safeHtml(x);
const date=x=>x?new Date(x).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'}):'—';
const statusName={pendiente:'Pendiente',revisar:'En revisión',aprobada:'Aprobada seguimiento',rechazada:'Rechazada'};
const oppType={bug_bounty:'Seguridad / bounty',bounty_codigo:'Recompensa técnica',subvencion:'Financiación',concurso:'Premio / concurso',otro:'Otro'};
let toastTimer;
function toast(message,kind='info'){
 let el=document.getElementById('toast');
 if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el);}
 el.textContent=message;el.style.borderColor=kind==='error'?'#b75a6e':kind==='ok'?'#27d6b0':'#4e7788';
 el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},6200);
}
function tag(label,tone=''){return '<span class="tag '+tone+'">'+h(label)+'</span>'}
function btn(text,action,cls='',attrs=''){return '<button class="btn '+cls+'" data-action="'+h(action)+'" '+attrs+'>'+text+'</button>'}
function activeUser(){return Boolean(state.user&&state.client)}
function nsource(id){return SOURCES.find(s=>s.id===id)?.label||id}
function count(status){return state.opps.filter(o=>o.status===status).length}
function latestRun(){return state.runs[0]||null}
function fmt(v){return Number(v||0).toLocaleString('es-PE')}
function sectionHeader(text,tip){return '<div class="spread" style="align-items:flex-start;flex-wrap:wrap;margin-bottom:14px"><div><h2 style="margin:0">'+text+'</h2><p class="subtitle">'+tip+'</p></div></div>'}
function formAuth(){
 if(!state.modal)return '';
 const signing=state.modal==='signup';
 return '<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="login-title"><div class="spread"><h2 id="login-title">'+(signing?'Crear cuenta personal':'Acceder a mi cuenta')+'</h2>'+btn('✕','close-modal','ghost')+'</div><p class="subtitle">La cuenta privada utiliza autenticación y políticas de aislamiento de registros (RLS) en Supabase. No ingreses claves financieras.</p>'+
 '<form data-form="auth"><div class="field"><label>Correo electrónico</label><input type="email" name="email" autocomplete="email" required></div>'+
 '<div class="field"><label>Contraseña (mínimo 8 caracteres)</label><input name="password" type="password" minlength="8" autocomplete="'+(signing?'new-password':'current-password')+'" required></div>'+
 '<button class="btn primary" type="submit">'+(signing?'Crear cuenta':'Iniciar sesión')+'</button></form>'+
 '<div class="auth-toggle" style="margin-top:14px">'+btn(signing?'Ya tengo cuenta':'Registrarme',signing?'login':'signup')+'</div>'+
 '<div style="margin-top:18px;padding-top:14px;border-top:1px solid #385065"><h3>Acceso seguro sin contraseña compartida</h3><p class="tiny muted">Recibe un enlace de ingreso en tu correo y confirma la propiedad de la cuenta.</p><form data-form="email-link"><div class="field"><label>Correo electrónico</label><input type="email" name="email" autocomplete="email" required></div><button type="submit" class="btn primary">✉ Enviar enlace de acceso</button></form><p class="tiny muted" style="margin-top:12px">Si ya registraste una contraseña y tu correo aún no está confirmado:</p><form data-form="resend"><div class="field"><label>Correo de la cuenta pendiente</label><input type="email" name="email" required></div><button type="submit" class="btn">Reenviar confirmación</button></form></div></div></div>'
}
function render(){
 const [heading,sub]=META[state.page]||META.dashboard;
 const userTitle=activeUser()?'Cuenta privada · '+h(state.user.email||'Autenticada'):'Modo visitante · sin registro permanente';
 root.innerHTML='<div class="app"><aside class="sidebar"><div class="brand"><span class="logo-mark">AX</span><div><strong>APEX_PRIME_X</strong><small>GLOBAL INTELLIGENCE SWARM</small></div></div>'+
 '<nav class="nav" aria-label="Secciones">'+NAV.map(n=>'<button class="'+(state.page===n[0]?'active':'')+'" data-action="nav" data-page="'+n[0]+'"><span class="ico">'+n[1]+'</span>'+n[2]+'</button>').join('')+'</nav>'+
 '<div class="sidebar-foot"><p><span class="status-dot"></span> CORE V0.1 · LECTURA PÚBLICA</p><div>Dos conectores de consulta.<br>Sin transferencias ni comercio automático.</div></div></aside>'+
 '<main class="main"><header class="top"><div><div class="eyebrow">APEX / CENTRO DE OPERACIONES</div><h1>'+h(heading)+'</h1><p class="subtitle">'+h(sub)+'</p></div>'+
 '<div class="topright">'+tag('v0.1 · '+(state.auto?'Auto en sesión':state.killed?'Parada de emergencia':'Supervisado'),state.killed?'bad':'mint')+
 (activeUser()?btn('Salir','logout','ghost'):btn('Entrar / Cuenta','login','primary'))+'</div></header>'+
 (!activeUser()?'<div class="notice blue">Estás en modo visitante. Puedes ejecutar búsquedas públicas en vivo para probar el sistema. Para guardar aprobaciones, historial y expedientes privados, inicia sesión o crea tu cuenta. La plataforma nunca recibe ni custodia dinero.</div>':'<p class="eyebrow" style="color:#8fb7c7">'+userTitle+'</p>')+
 (state.lastError?'<div class="notice red">'+h(state.lastError)+'</div>':'')+
 (state.busy?'<div class="runprogress"><span class="loader"></span>Escaneo en curso: recolectando y clasificando datos públicos…</div>':'')+
 view()+'<div class="footer">© 2026 APEX_PRIME_X · Datos sujetos a verificación · Sin garantías de ingresos · Cuenta documental, no custodia de activos.</div></main></div>'+formAuth();
}
function kpi(label,value,tip){return '<div class="card"><div class="k-label">'+h(label)+'</div><div class="k-value number">'+h(String(value))+'</div><small>'+h(tip)+'</small></div>'}
function runControls(){
 return '<div class="button-row">'+btn(state.busy?'⏳ Escaneando…':'▶ Ejecutar ciclo','scan','primary',(state.busy||state.killed?'disabled':''))+
 btn(state.auto?'❚❚ Pausar autonomía':'⟳ Autonomía en sesión',state.auto?'auto-off':'auto-on','',state.killed?'disabled':'')+
 btn('■ Parada de emergencia','kill','red',state.killed?'disabled':'')+
 (state.killed?btn('Rearmar','rearm','ghost'):'')+'</div>'+
 '<p class="subtitle tiny">Ritmo mínimo: 5 minutos entre ciclos. La autonomía solo funciona mientras esta pestaña permanece abierta. No se ejecutan trabajos en equipos ajenos ni se mueven activos.</p>'+
 (state.auto?'<div class="pill mint">Siguiente comprobación: <span id="countdown">calculando…</span></div>':'');
}
function dashboard(){
 const latest=latestRun();
 const done=state.runs.filter(r=>r.status!=='running').length;
 return '<div class="cards">'+kpi('Señales encontradas',fmt(state.opps.length),'Total de registros, no activos recuperados')+
 kpi('En revisión',fmt(count('revisar')),'Requieren aprobación humana')+kpi('Expedientes privados',fmt(state.vault.length),'Metadatos, no depósitos')+
 kpi('Ciclos registrados',fmt(done),'Ejecuciones de tu cuenta / sesión')+'</div>'+
 '<div class="grid2"><section class="panel"><h2>Control del enjambre</h2>'+runControls()+
 '<div class="notice blue" style="margin-top:20px">Al ejecutar un ciclo se consultan APIs públicas de GitHub y Hacker News. Una coincidencia es únicamente una <b>señal no verificada</b>.</div>'+
 '<h3 style="margin-top:22px">Última ejecución</h3>'+(!latest?'<div class="empty">Aún no hay ejecuciones. Pulsa «Ejecutar ciclo» para consultar las fuentes.</div>':
 '<div class="spread"><span>'+tag(latest.status||'desconocido',latest.status==='ok'?'mint':latest.status==='error'?'bad':'warn')+'</span><small class="muted">'+date(latest.started_at)+'</small></div>'+
 '<p class="sm muted">'+fmt(latest.stats?.inserted)+' señales nuevas · '+fmt(latest.stats?.collected)+' registros examinados</p>')+'</section>'+
 '<section class="panel"><h2>Distribución de oportunidades</h2>'+typeSummary()+
 '<div class="notice">⚠ Un puntaje alto indica coincidencia temática, <b>no</b> dinero disponible, éxito, propiedad ni rentabilidad.</div></section></div>'+
 '<section class="panel section"><h2>Ruta de procesamiento de los agentes</h2>'+agentFlow()+'</section>'+
 '<section class="panel section"><h2>Radar público en segundo plano</h2>'+feedPanel()+'</section><section class="panel section"><h2>Señales de tu cuenta o sesión</h2>'+opTable(state.opps.slice(0,7))+'</section>';
}
function feedPanel(){
 const d=state.feed;
 if(!d)return '<div class="empty">'+h(state.feedError||'El radar público todavía no tiene una actualización programada.')+'</div>';
 const rows=Array.isArray(d.items)?d.items:[];
 return '<div class="spread" style="margin-bottom:14px;flex-wrap:wrap">'+tag('Actualización automática · GitHub Actions','mint')+'<span class="tiny muted">Último ciclo: '+date(d.generated_at)+' · '+h(d.status)+'</span></div><div class="notice blue">Investigación pública cada 6 horas, aunque cierres el navegador. No guarda automáticamente registros en tu cuenta ni mueve activos.</div>'+
 (rows.length?'<div class="tablewrap"><table class="datatable"><thead><tr><th>Señal pública</th><th>Categoría</th><th>Relevancia</th></tr></thead><tbody>'+rows.slice(0,12).map(x=>'<tr><td class="titlecell"><b>'+h(x.title)+'</b><small>'+h(nsource(x.source))+'</small><p><a href="'+h(safeUrl(x.url)||'#')+'" target="_blank" rel="noopener noreferrer">↗ Abrir fuente</a></p></td><td>'+tag(oppType[x.opp_type]||'Otro')+'</td><td>'+fmt(x.score)+'/100</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">La última recolección no produjo registros válidos.</div>');
}
function typeSummary(){
 const total=state.opps.length;
 if(!total)return '<div class="empty">Las categorías aparecerán cuando exista información consultada.</div>';
 return Object.entries(oppType).map(([k,name])=>{
 const c=state.opps.filter(o=>o.opp_type===k).length;if(!c)return '';
 return '<div class="spread" style="margin:13px 0"><span class="sm">'+h(name)+'</span><div class="flex"><div class="bar"><i style="width:'+Math.round(c/total*100)+'%"></i></div><span class="tiny number">'+c+'</span></div></div>';
 }).join('');
}
const STAGES=[['Recolector','Consulta únicamente a APIs públicas autorizadas'],['Normalizador','Sanea campos y enlaces, sin ejecutar el texto remoto'],['Deduplicador','Agrupa las señales por URL canónica'],['Clasificador','Identifica temática con reglas reproducibles'],['Verificador','Confirma solo lo que la API permite confirmar'],['Evaluador económico','No inventa beneficios, propiedad ni rentabilidad'],['Auditor','Registra fuente, fecha, resultados y decisiones']];
function agentFlow(){
 const steps=state.latestSteps.length?state.latestSteps:latestRun()?.steps||[];
 return '<div class="agentflow">'+STAGES.map((x,i)=>{
 const found=steps.find(s=>s.agent===x[0]);return (i?'<span class="arrow">→</span>':'')+
 '<div class="agentstep"><strong>'+h(x[0])+'</strong><small class="muted">'+h(x[1])+'</small><p><em>'+h(found?.status||'Esperando')+'</em></p>'+
 (found?'<small class="muted">'+h(found.detail||'')+'</small>':'')+'</div>';
 }).join('')+'</div><p class="tiny muted">Son módulos lógicos de una canalización local; no representan robots propagándose por servidores.</p>';
}
function explore(){
 const runs=state.runs;
 return '<section class="panel">'+sectionHeader('Motor de exploración pública','Ejecuta consultas reales; observa el resultado por fuente y paso del pipeline.')+
 runControls()+agentFlow()+'</section>'+
 '<section class="panel section"><h2>Registro de ciclos</h2>'+(!runs.length?'<div class="empty">Todavía no hay ejecuciones.</div>':
 '<div class="tablewrap"><table class="datatable"><thead><tr><th>Momento</th><th>Activación</th><th>Estado</th><th>Recibidos</th><th>Nuevos</th></tr></thead><tbody>'+
 runs.slice(0,30).map(r=>'<tr><td>'+date(r.started_at)+'</td><td>'+h(r.trigger)+'</td><td>'+tag(r.status,r.status==='ok'?'mint':'warn')+'</td><td>'+fmt(r.stats?.collected)+'</td><td>'+fmt(r.stats?.inserted)+'</td></tr>').join('')+
 '</tbody></table></div>')+'</section>';
}
function filtered(){
 return state.opps.filter(x=>{
 const f=state.filter.trim().toLowerCase();
 return (!f||(x.title+' '+x.evidence+' '+x.source).toLowerCase().includes(f)) &&
 (state.type==='todos'||x.opp_type===state.type) &&
 (state.status==='todos'||x.status===state.status);
 }).sort((a,b)=>(b.score||0)-(a.score||0));
}
function filters(){
 return '<form class="filters" data-form="filter">'+
 '<div class="field"><label>Palabra clave</label><input name="search" value="'+h(state.filter)+'" placeholder="Buscar en títulos y fuentes"></div>'+
 '<div class="field"><label>Categoría</label><select name="type"><option value="todos">Todas</option>'+Object.entries(oppType).map(([k,v])=>'<option value="'+k+'" '+(state.type===k?'selected':'')+'>'+h(v)+'</option>').join('')+'</select></div>'+
 '<div class="field"><label>Estado</label><select name="status"><option value="todos">Todos</option>'+Object.entries(statusName).map(([k,v])=>'<option value="'+k+'" '+(state.status===k?'selected':'')+'>'+h(v)+'</option>').join('')+'</select></div>'+
 '<div class="field" style="flex:0;min-width:95px;margin-top:18px"><button class="btn primary" type="submit">Filtrar</button></div></form>';
}
function opTable(rows){
 if(!rows.length)return '<div class="empty">Sin oportunidades en esta vista. Ejecuta un ciclo o ajusta los filtros. Los resultados no se simulan.</div>';
 return '<div class="tablewrap"><table class="datatable"><thead><tr><th>Oportunidad / evidencia</th><th>Tipo</th><th>Relevancia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+
 rows.map(o=>'<tr><td class="titlecell"><b>'+h(o.title)+'</b><small>'+h(nsource(o.source))+' · '+date(o.source_created_at||o.discovered_at)+'</small><p class="tiny muted">'+h(String(o.evidence||'').slice(0,160))+'</p><a href="'+h(safeUrl(o.url)||'#')+'" target="_blank" rel="noopener noreferrer">↗ Ver fuente original</a></td>'+
 '<td>'+tag(oppType[o.opp_type]||'Otro')+'</td><td><div class="flex"><div class="bar"><i style="width:'+Math.max(0,Math.min(100,Number(o.score)||0))+'%"></i></div><b class="number">'+fmt(o.score)+'</b></div><small class="muted">No es retorno económico</small></td>'+
 '<td>'+tag(statusName[o.status]||'Pendiente',o.status==='aprobada'?'mint':o.status==='rechazada'?'bad':'warn')+'</td>'+
 '<td>'+ (activeUser()?btn('Revisar','select','ghost','data-id="'+h(o.id)+'"'):tag('Entrar para aprobar'))+'</td></tr>').join('')+
 '</tbody></table></div>';
}
function opportunities(){return '<section class="panel">'+sectionHeader('Señales económicas no verificadas',fmt(filtered().length)+' registros · Pueden ser antiguos, estar cerrados o carecer de recompensa real.')+
 filters()+opTable(filtered())+'</section>';}
function approval(){
 const selected=state.opps.find(o=>o.id===state.selected);
 const waiting=state.opps.filter(o=>o.status==='pendiente'||o.status==='revisar');
 return '<section class="panel"><h2>Cadena de aprobación humana</h2><div class="notice blue">1. Revisar una señal → 2. Autorizar seguimiento → 3. Archivar expediente. Aprobar no acredita titularidad ni autoriza transacciones.</div>'+
 (selected?'<div class="asset"><div class="spread"><strong>'+h(selected.title)+'</strong>'+btn('✕','clear-select','ghost')+'</div><p class="tiny muted">'+h(selected.evidence)+'</p><p class="sm">'+h(selected.eligibility_notes||'Elegibilidad no evaluada')+'</p><div class="button-row">'+
 (selected.status==='pendiente'?btn('Marcar para revisión','review','primary'):'')+
 (selected.status==='revisar'?btn('Aprobar seguimiento','approve','primary')+btn('Rechazar','reject','red'):'')+
 (selected.status==='aprobada'?btn('Archivar en mi bóveda','archive','primary'):'')+
 (selected.status==='rechazada'?btn('Volver a pendiente','reset','ghost'):'')+
 '</div></div>':'')+
 (!activeUser()?'<div class="notice">Para tomar decisiones persistentes debes entrar en una cuenta privada.</div>':'')+
 '<h2 style="margin-top:22px">Pendientes de análisis ('+waiting.length+')</h2>'+
 opTable(waiting)+'</section>';
}
function vault(){
 return '<section class="panel">'+sectionHeader('Expedientes personales ('+state.vault.length+')','La bóveda almacena información y decisiones de seguimiento. No guarda dinero, valores, tokens ni claves privadas.')+
 '<div class="button-row">'+btn('Exportar JSON','export-json','ghost',state.vault.length?'':'disabled')+
 btn('Exportar CSV','export-csv','ghost',state.vault.length?'':'disabled')+'</div>'+
 '<div class="notice">Solo un titular acreditado puede reclamar activos. Una declaración personal no constituye comprobación legal de propiedad. Nunca ingreses frases semilla, claves privadas o números de cuenta.</div>'+
 (!state.vault.length?'<div class="empty">No hay expedientes guardados. Revisa y aprueba señales antes de archivarlas.</div>':
 state.vault.map(v=>'<div class="asset"><div class="spread"><div>'+tag(v.ownership_status==='propio_autodeclarado'?'Propiedad autodeclarada':'Titularidad sin verificar',v.ownership_status==='propio_autodeclarado'?'warn':'')+'<strong>'+h(v.title)+'</strong><div class="source">'+h(nsource(v.source))+' · archivado '+date(v.created_at)+'</div></div>'+
 '<div class="button-row">'+(v.ownership_status==='titularidad_no_verificada'?btn('Declarar titularidad','declare','ghost','data-id="'+h(v.id)+'"'):'')+btn('Eliminar expediente','delete-vault','red','data-id="'+h(v.id)+'"')+'</div></div>'+
 '<p class="tiny muted">'+h(v.evidence_description||'Sin evidencia documental declarada')+'</p>'+
 '<a href="'+h(safeUrl(v.url)||'#')+'" target="_blank" rel="noopener noreferrer">↗ Fuente del expediente</a></div>').join(''))+'</section>';
}
function agents(){
 return '<section class="panel"><h2>Agentes especializados</h2>'+agentFlow()+'</section>'+
 '<div class="grid3 section">'+STAGES.map((a,i)=>'<div class="panel"><div class="eyebrow">AGENTE '+String(i+1).padStart(2,'0')+'</div><h2 style="margin-top:9px">'+h(a[0])+'</h2><p class="sm muted">'+h(a[1])+'</p>'+tag('Reglas reproducibles','mint')+'</div>').join('')+'</div>'+
 '<div class="notice blue">Arquitectura v0.1: los pasos son módulos dentro de la aplicación, NO microbots persistentes, redes autoexpansibles ni un clúster de mil trabajadores.</div>';
}
function sources(){
 const last=latestRun()?.source_results||state.lastSources;
 return '<section class="panel">'+sectionHeader('Conectores de consulta','Los dos proveedores están sujetos a límites propios, fallos y políticas de uso.')+
 '<div class="grid3">'+SOURCES.map(s=>{const res=last?.find(x=>x.source===s.id);return '<div class="panel"><div class="eyebrow">'+h(s.id)+'</div><h2 style="margin-top:8px">'+h(s.label)+'</h2>'+tag(res?(res.ok?'Último ciclo: OK':'Último ciclo: ERROR'):'Sin ejecutar',res?.ok?'mint':res?'bad':'')+
 '<p class="sm muted">Registros última consulta: '+fmt(res?.count||0)+'</p>'+
 (res?.error?'<p class="tiny" style="color:var(--bad)">'+h(res.error)+'</p>':'')+
 '<a class="tiny" href="'+h(s.endpoint)+'" rel="noopener noreferrer" target="_blank">Abrir API pública ↗</a></div>'}).join('')+'</div>'+
 '<div class="notice blue">La cobertura es parcial. No se consulta Internet completa. Las fuentes pueden responder HTTP 403/429 por cuotas; el sistema lo registra como error.</div></section>';
}
function audit(){
 return '<section class="panel"><h2>Bitácora de auditoría</h2>'+
 (!state.logs.length?'<div class="empty">Sin eventos auditados en esta cuenta o sesión.</div>':
 '<div class="tablewrap"><table class="datatable"><thead><tr><th>Fecha</th><th>Evento</th><th>Actor</th><th>Detalle</th></tr></thead><tbody>'+
 state.logs.slice(0,80).map(x=>'<tr><td>'+date(x.created_at)+'</td><td>'+h(x.event)+'</td><td>'+h(x.actor)+'</td><td class="tiny muted">'+h(JSON.stringify(x.detail||{}).slice(0,220))+'</td></tr>').join('')+'</tbody></table></div>')+'</section>';
}
function settings(){
 const s=state.settings;
 return '<section class="panel">'+sectionHeader('Parámetros del enjambre','Ajusta el ritmo y filtros sin eludir límites de fuentes. Los cambios se guardan por cuenta.')+
 '<form data-form="settings" class="grid2"><div class="field"><label>Palabras clave (separadas por comas)</label><input name="keywords" value="'+h((s.keywords||KEYS).join(', '))+'"></div>'+
 '<div class="field"><label>Frecuencia automática (minutos, mínimo 5)</label><input type="number" name="interval" min="5" max="1440" value="'+h(s.interval_minutes||15)+'"></div>'+
 '<div class="field"><label>Máximo de resultados por ciclo (1–50)</label><input type="number" name="max_items" min="1" max="50" value="'+h(s.max_items||20)+'"></div>'+
 '<div class="field"><label>Puntaje mínimo de relevancia (0–100)</label><input type="number" name="min_score" min="0" max="100" value="'+h(s.min_score||0)+'"></div>'+
 '<div class="field"><label>Fuentes habilitadas</label><select name="sources"><option value="all">Hacker News y GitHub</option><option value="hackernews" '+((s.enabled_sources||[]).join(',')==='hackernews'?'selected':'')+'>Solo Hacker News</option><option value="github" '+((s.enabled_sources||[]).join(',')==='github'?'selected':'')+'>Solo GitHub</option></select></div>'+
 '<div class="field" style="justify-content:end"><button class="btn primary" type="submit">Guardar parámetros</button></div></form>'+
 '<div class="notice">Los ciclos privados se ejecutan solo mientras la pestaña esté abierta. El radar PÚBLICO se actualiza mediante GitHub Actions cada 6 horas, sin acceso a tu cuenta personal.</div></section>'+
 '<section class="panel section"><h2>Arquitectura y límites</h2><p class="sm muted">El escaneo y clasificación se realiza en el navegador del usuario. Si inicias sesión, las oportunidades, decisiones y expedientes se almacenan en una base de datos con políticas RLS por usuario. La información recuperada es de fuentes públicas y se marca como no verificada. No se ejecutan transferencias, firmas blockchain, arbitraje ni compras bursátiles.</p>'+
 '<p class="sm muted">Los costes de API, tiempos de respuesta, cuotas y la disponibilidad de la base de datos dependen de servicios externos. La escalabilidad a miles de trabajadores requiere un backend especializado, límites de tráfico y presupuesto.</p></section>';
}
function view(){
 switch(state.page){case'dashboard':return dashboard();case'explore':return explore();case'opportunities':return opportunities();
 case'approval':return approval();case'vault':return vault();case'agents':return agents();case'sources':return sources();
 case'audit':return audit();case'settings':return settings();default:return dashboard();}
}
async function auditEvent(event,detail={}){
 if(!activeUser()){state.logs.unshift({created_at:new Date().toISOString(),event,detail,actor:'visitante'});return;}
 try{await state.client.from('audit_log').insert({user_id:state.user.id,actor:state.user.email||'usuario',event,detail});}catch{/* non-critical */}
}
async function loadPrivate(){
 if(!activeUser())return;
 const tables=['opportunities','scan_runs','vault_items','decisions','audit_log'];
 const result=await Promise.all(tables.map(t=>state.client.from(t).select('*').order(t==='scan_runs'?'started_at':t==='opportunities'?'discovered_at':'created_at',{ascending:false}).limit(700)));
 const dest=['opps','runs','vault','decisions','logs'];
 result.forEach((r,i)=>{if(!r.error)state[dest[i]]=r.data||[];else state.lastError='Error al cargar '+tables[i]+': '+r.error.message});
 const {data,error}=await state.client.from('user_settings').select('*').eq('user_id',state.user.id).maybeSingle();
 if(!error&&data)state.settings={...DEFAULTS,...data};
 state.lastRun=state.runs[0]?Date.parse(state.runs[0].started_at):0;
 state.latestSteps=state.runs[0]?.steps||[];
 state.lastSources=state.runs[0]?.source_results||[];
 render();
}
async function init(){
 render();
 void loadPublicFeed();
 try{
   const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm');
   state.client=mod.createClient(CLOUD_URL,PUBLIC_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
   state.authAvailable=true;
   const {data:{user},error}=await state.client.auth.getUser();
   if(!error&&user){state.user=user;await loadPrivate();}
   state.client.auth.onAuthStateChange((_,session)=>{
     const previous=state.user?.id;
     state.user=session?.user||null;
     if(state.user&&previous!==state.user.id) setTimeout(()=>{void loadPrivate().catch(e=>toast('Error de sincronización: '+e.message,'error'));},0);
     if(!state.user&&previous){state.opps=[];state.runs=[];state.vault=[];state.logs=[];state.decisions=[];state.settings={...DEFAULTS};state.auto=false;}
     render();
   });
 }catch(e){state.authAvailable=false;toast('No fue posible cargar el servicio de cuentas. La exploración pública continúa disponible.','error');}
 state.booted=true;render();
}
async function loadPublicFeed(){
 try{
   const r=await fetch('./feed/latest.json',{cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const v=await r.json();
   if(v.schema!=='apex-public-research-v1'||!Array.isArray(v.items))throw Error('Formato de radar no válido');
   state.feed=v;state.feedError='';
 }catch(e){state.feedError='El radar aún no está disponible ('+(e.message||'error de red')+').';}
 render();
}
async function emailAuth(form,resend=false){
 if(!state.client)return toast('Autenticación temporalmente no disponible.','error');
 const email=String(new FormData(form).get('email')||'').trim();
 if(!email)return toast('Indica un correo válido.','error');
 const url=window.location.origin+window.location.pathname;
 const result=resend
  ?await state.client.auth.resend({type:'signup',email,options:{emailRedirectTo:url}})
  :await state.client.auth.signInWithOtp({email,options:{emailRedirectTo:url,shouldCreateUser:true}});
 if(result.error)return toast('El servicio de correo respondió: '+result.error.message,'error');
 state.modal='';toast('Solicitud enviada. Revisa el correo y abre el enlace de confirmación; no compartas códigos.','ok');render();
}
async function authSubmit(form){
 if(!state.client){toast('Servicio de autenticación temporalmente no disponible.','error');return;}
 const fd=new FormData(form),email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||'');
 if(!email||password.length<8)return toast('Completa correo y contraseña de al menos 8 caracteres.','error');
 const signing=state.modal==='signup';
 const r=signing?await state.client.auth.signUp({email,password}):await state.client.auth.signInWithPassword({email,password});
 if(r.error)return toast('Autenticación: '+r.error.message,'error');
 state.modal='';
 if(signing&&!r.data.session)toast('Cuenta registrada. Confirma tu dirección de correo antes de entrar.','ok');
 else toast('Sesión iniciada. Expedientes privados habilitados.','ok');
 if(r.data.user&&r.data.session){state.user=r.data.user;await loadPrivate();}
 render();
}
async function saveSettings(form){
 const f=new FormData(form);
 const keywords=String(f.get('keywords')||'').split(',').map(x=>x.toLowerCase().replace(/[^a-z0-9áéíóúñü -]/g,'').trim()).filter(x=>x.length>=2&&x.length<=30).slice(0,12);
 const interval_minutes=Math.max(5,Math.min(1440,Number(f.get('interval'))||15));
 const max_items=Math.max(1,Math.min(50,Number(f.get('max_items'))||20));
 const min_score=Math.max(0,Math.min(100,Number(f.get('min_score'))||0));
 const fsrc=String(f.get('sources')||'all');
 const enabled_sources=fsrc==='all'?['hackernews','github']:[fsrc];
 const s={keywords,interval_minutes,max_items,min_score,enabled_sources};
 state.settings={...state.settings,...s};
 if(activeUser()){
   const {error}=await state.client.from('user_settings').upsert({user_id:state.user.id,...s},{onConflict:'user_id'});
   if(error)return toast('No se guardaron ajustes: '+error.message,'error');
 }
 await auditEvent('configuracion_modificada',{interval_minutes,max_items,min_score,enabled_sources});
 toast(activeUser()?'Preferencias guardadas en tu cuenta.':'Preferencias de esta sesión actualizadas.','ok');render();
}
async function cycle(trigger='manual'){
 if(state.busy||state.killed){toast('El motor está ocupado o detenido.','error');return;}
 if(state.lastRun&&Date.now()-state.lastRun<MIN_INTERVAL_MS){
  const mins=Math.ceil((MIN_INTERVAL_MS-(Date.now()-state.lastRun))/60000);toast('Ritmo de protección: espera '+mins+' minuto(s) antes del siguiente ciclo.','error');return;
 }
 if(activeUser()){
  const {data}=await state.client.from('scan_runs').select('started_at').order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(data&&Date.now()-Date.parse(data.started_at)<MIN_INTERVAL_MS){toast('Límite de 5 minutos por cuenta todavía activo.','error');return;}
 }
 state.busy=true;state.abort=new AbortController();const my=++state.activeScan;state.lastError='';state.latestSteps=[];render();
 const begun=new Date().toISOString();let runId=null;
 if(activeUser()){
  const {data,error}=await state.client.from('scan_runs').insert({user_id:state.user.id,trigger,status:'running'}).select('id').single();
  if(error){state.busy=false;toast('No es posible registrar el escaneo: '+error.message,'error');render();return;}
  runId=data.id;
 }
 state.lastRun=Date.now();
 let results=[],steps=[],sourceResults=[],fresh=[],added=0;
 try{
  const enabled=SOURCES.filter(s=>(state.settings.enabled_sources||DEFAULTS.enabled_sources).includes(s.id));
  if(!enabled.length)throw Error('No hay fuentes habilitadas.');
  const start=Date.now();
  const responses=await Promise.all(enabled.map(async source=>{
   const ts=Date.now();if(!allowedSource(source.endpoint))return {source:source.id,ok:false,count:0,error:'Host no permitido'};
   try{
     const tm=setTimeout(()=>state.abort?.abort(),14000);
     let response;try{response=await fetch(source.endpoint,{signal:state.abort.signal,headers:{Accept:'application/json'}});}finally{clearTimeout(tm);}
     if(!response.ok)throw Error('HTTP '+response.status+(response.status===403||response.status===429?' — cuota o acceso restringido':''));
     const data=await response.json();const items=normalize(source.id,data);
     return {source:source.id,ok:true,count:items.length,ms:Date.now()-ts,items};
   }catch(e){return {source:source.id,ok:false,count:0,ms:Date.now()-ts,error:e instanceof Error?e.message:'Error de red'};}
  }));
  if(my!==state.activeScan||state.killed)throw Error('Ciclo detenido por el usuario.');
  sourceResults=responses.map(({items,...r})=>r);
  const collected=responses.flatMap(r=>r.items||[]);
  steps.push({agent:'Recolector',status:responses.some(r=>r.ok)?'ok':'error',detail:sourceResults.map(r=>r.source+': '+(r.ok?r.count+' elementos':r.error)).join(' · '),ms:Date.now()-start});
  steps.push({agent:'Normalizador',status:'ok',detail:collected.length+' documentos normalizados, enlaces y texto saneados',ms:0});
  const seen=new Set(state.opps.map(x=>x.dedupe_key||dedupeKey(x.url)));
  let duplicate=0;
  for(const item of collected){const k=dedupeKey(item.url);if(seen.has(k)){duplicate++;continue;}seen.add(k);fresh.push(item);}
  const cap=Math.max(1,Math.min(50,Number(state.settings.max_items)||20));
  fresh=fresh.slice(0,cap);
  steps.push({agent:'Deduplicador',status:'ok',detail:duplicate+' ya existentes o repetidos · '+fresh.length+' únicos nuevos',ms:0});
  const keywords=state.settings.keywords||KEYS,min=state.settings.min_score||0;
  results=fresh.map(x=>({
    source:x.source,external_id:x.external_id,title:x.title,url:x.url,
    source_host:new URL(x.url).hostname,dedupe_key:dedupeKey(x.url),evidence:x.evidence,
    author:x.author,source_created_at:x.source_created_at||null,
    opp_type:classify(x),score:score(x,keywords),score_breakdown:{tipo:'heuristico',algoritmo:'v0.1'},
    link_check:x.api_open?'confirmado_api':'formato_valido',
    eligibility_notes:x.api_open?'La API confirmó que el issue figura abierto; elegibilidad NO verificada.':'Solo formato de URL validado. Elegibilidad NO evaluada.',
    economic_notes:'Monto, titularidad, derecho e ingresos NO verificados.',
    status:'pendiente',discovered_at:new Date().toISOString()
  })).filter(x=>x.score>=min);
  steps.push({agent:'Clasificador',status:'ok',detail:results.length+' registros clasificados por categorías',ms:0});
  steps.push({agent:'Verificador',status:'ok',detail:results.filter(x=>x.link_check==='confirmado_api').length+' issues abiertos según API · elegibilidad no comprobada',ms:0});
  steps.push({agent:'Evaluador económico',status:'ok',detail:'Sin rendimientos supuestos; requiere verificación comercial y de titularidad',ms:0});
  if(activeUser()&&results.length){
    const rows=results.map(x=>({...x,user_id:state.user.id,run_id:runId}));
    const {data,error}=await state.client.from('opportunities').upsert(rows,{onConflict:'user_id,dedupe_key',ignoreDuplicates:true}).select('id');
    if(error){state.lastError='No se pudieron guardar todas las señales: '+error.message;}
    added=data?.length||0;
  }else if(!activeUser()){
    results.forEach((x,i)=>state.opps.unshift({...x,id:'guest-'+Date.now()+'-'+i,user_id:null}));
    added=results.length;
  }
  const ok=sourceResults.filter(x=>x.ok).length;
  const runStatus=ok===0?'error':ok===enabled.length?'ok':'parcial';
  steps.push({agent:'Auditor',status:'ok',detail:'Ciclo '+runStatus+'. '+added+' señales registradas; no se ejecutaron transacciones.',ms:0});
  const stats={collected:collected.length,duplicates:duplicate,inserted:added,max_items:cap};
  if(activeUser())await state.client.from('scan_runs').update({status:runStatus,finished_at:new Date().toISOString(),steps,source_results:sourceResults,stats}).eq('id',runId);
  else state.runs.unshift({id:'guest-run-'+Date.now(),trigger,status:runStatus,started_at:begun,steps,source_results:sourceResults,stats});
  await auditEvent('ciclo_completado',{trigger,status:runStatus,...stats});
  toast('Ciclo '+runStatus+' · '+added+' señales nuevas. '+(ok===0?'Ninguna fuente respondió correctamente.':''),ok?'ok':'error');
 }catch(e){
  const msg=e instanceof Error?e.message:'Error desconocido';
  state.lastError=msg;toast(msg,'error');
  if(activeUser()&&runId)await state.client.from('scan_runs').update({status:'error',finished_at:new Date().toISOString(),steps,source_results:sourceResults,stats:{error:msg}}).eq('id',runId);
 }finally{
  if(my===state.activeScan){state.busy=false;state.abort=null;state.latestSteps=steps;state.lastSources=sourceResults;}
  if(activeUser())await loadPrivate();else render();
 }
}
async function decision(to){
 if(!activeUser())return toast('Inicia sesión para aprobar o rechazar.','error');
 const opp=state.opps.find(x=>x.id===state.selected);if(!opp)return;
 const allow={pendiente:['revisar'],revisar:['aprobada','rechazada','pendiente'],rechazada:['pendiente'],aprobada:[]};
 if(!(allow[opp.status]||[]).includes(to))return toast('Transición no permitida.','error');
 const note=prompt(to==='aprobada'?'Motivo y comprobaciones realizadas (obligatorio):':'Nota de revisión (no ingreses datos sensibles):');
 if(note===null)return;
 if((to==='aprobada')&&note.trim().length<10)return toast('La aprobación requiere una explicación de al menos 10 caracteres.','error');
 if(validateSecret(note))return toast('No ingreses credenciales ni secretos en las notas.','error');
 const {error}=await state.client.from('opportunities').update({status:to}).eq('id',opp.id);
 if(error)return toast(error.message,'error');
 await state.client.from('decisions').insert({user_id:state.user.id,actor_email:state.user.email,opportunity_id:opp.id,from_status:opp.status,to_status:to,note:note.slice(0,2000),evidence:'Revisión manual pendiente de validación independiente'});
 await auditEvent('decision_aprobacion',{title:opp.title,from:opp.status,to});
 toast('Estado actualizado: '+(statusName[to]||to),'ok');await loadPrivate();
}
async function archive(){
 if(!activeUser())return toast('Inicia sesión.','error');
 const o=state.opps.find(x=>x.id===state.selected);
 if(!o||o.status!=='aprobada')return toast('Solo se archivan oportunidades aprobadas para seguimiento.','error');
 const snapshot={evidence:o.evidence,score:o.score,opp_type:o.opp_type,eligibility_notes:o.eligibility_notes,discovered_at:o.discovered_at};
 const {error}=await state.client.from('vault_items').insert({user_id:state.user.id,opportunity_id:o.id,title:o.title,url:o.url,source:o.source,snapshot,ownership_status:'titularidad_no_verificada'});
 if(error)return toast('No se pudo archivar (quizá ya existe): '+error.message,'error');
 await auditEvent('expediente_archivado',{opportunity_id:o.id,title:o.title});state.page='vault';state.selected='';toast('Expediente documental privado guardado. NO es un depósito o saldo.','ok');await loadPrivate();
}
async function declare(id){
 if(!activeUser())return;
 const v=state.vault.find(x=>x.id===id);if(!v)return;
 if(!confirm('¿Quieres registrar una AUTODECLARACIÓN de titularidad? No valida derechos legales ni recupera dinero. No ingreses credenciales.'))return;
 const declaration=prompt('Declara en al menos 20 caracteres por qué consideras que posees derecho sobre esta oportunidad o activo. No introduzcas información financiera sensible.');
 if(declaration===null)return;
 const evidence=prompt('Describe la evidencia no sensible que posees (mínimo 10 caracteres). No cargues ni pegues claves, números de cuenta ni frases semilla.');
 if(evidence===null)return;
 if(declaration.trim().length<20||evidence.trim().length<10)return toast('La declaración y la descripción de evidencia son demasiado breves.','error');
 if(validateSecret(declaration)||validateSecret(evidence))return toast('Detectamos un posible secreto. No se guardó.','error');
 const {error}=await state.client.from('vault_items').update({ownership_status:'propio_autodeclarado',declaration:declaration.slice(0,2000),evidence_description:evidence.slice(0,2000),declared_at:new Date().toISOString()}).eq('id',id);
 if(error)return toast(error.message,'error');
 await auditEvent('titularidad_autodeclarada',{expediente:id});
 toast('Autodeclaración registrada. Todavía no es verificación jurídica.','ok');await loadPrivate();
}
function download(content,name,type){
 const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function toggleAuto(on){
 if(on&&state.killed)return;
 state.auto=on;
 if(on){state.nextAt=Date.now()+1000;toast('Automatización activada. Solo ejecutará mientras la pestaña esté abierta.','ok');}
 else{state.nextAt=0;toast('Automatización pausada.');}
 void auditEvent(on?'autonomia_iniciada':'autonomia_pausada',{interval:state.settings.interval_minutes||15});render();
}
function kill(){
 state.killed=true;state.auto=false;state.nextAt=0;state.activeScan++;
 if(state.abort)state.abort.abort();
 state.busy=false;state.abort=null;
 void auditEvent('parada_emergencia',{notes:'Se detienen ciclos próximos y solicitudes de navegador; operaciones remotas ya iniciadas pueden finalizar.'});
 toast('PARADA ACTIVADA. Solicitudes en curso se abortaron cuando fue posible.','error');render();
}
document.addEventListener('click',async e=>{
 const target=e.target.closest('[data-action]');if(!target)return;
 const action=target.dataset.action,id=target.dataset.id;
 if(action==='nav'){state.page=target.dataset.page;state.selected='';render();return;}
 if(action==='login'||action==='signup'){state.modal=action;render();return;}
 if(action==='close-modal'){state.modal='';render();return;}
 if(action==='logout'){if(state.client)await state.client.auth.signOut();state.user=null;state.modal='';state.auto=false;state.opps=[];state.vault=[];state.runs=[];state.decisions=[];state.logs=[];state.latestSteps=[];state.settings={...DEFAULTS};toast('Sesión cerrada.','ok');render();return;}
 if(action==='scan'){await cycle('manual');return;}
 if(action==='auto-on'){toggleAuto(true);return;}
 if(action==='auto-off'){toggleAuto(false);return;}
 if(action==='kill'){kill();return;}
 if(action==='rearm'){state.killed=false;state.busy=false;state.lastRun=0;void auditEvent('rearme_manual');toast('Motor rearmado. El límite de tasa de la cuenta sigue vigente.','ok');render();return;}
 if(action==='select'){state.selected=id;state.page='approval';render();return;}
 if(action==='clear-select'){state.selected='';render();return;}
 if(action==='review'){await decision('revisar');return;}
 if(action==='approve'){await decision('aprobada');return;}
 if(action==='reject'){await decision('rechazada');return;}
 if(action==='reset'){await decision('pendiente');return;}
 if(action==='archive'){await archive();return;}
 if(action==='declare'){await declare(id);return;}
 if(action==='delete-vault'){
  if(!activeUser()||!confirm('¿Eliminar este expediente de tu bóveda? Esta acción no afecta activos externos.'))return;
  const {error}=await state.client.from('vault_items').delete().eq('id',id);
  if(error)return toast(error.message,'error');
  await auditEvent('expediente_eliminado',{expediente:id});await loadPrivate();return;
 }
 if(action==='export-json'){download(JSON.stringify(state.vault,null,2),'apex-boveda-'+new Date().toISOString().slice(0,10)+'.json','application/json');return;}
 if(action==='export-csv'){download(csv(state.vault),'apex-boveda-'+new Date().toISOString().slice(0,10)+'.csv','text/csv;charset=utf-8');return;}
});
document.addEventListener('submit',async e=>{
 const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();
 if(form.dataset.form==='auth')await authSubmit(form);
 if(form.dataset.form==='email-link')await emailAuth(form,false);
 if(form.dataset.form==='resend')await emailAuth(form,true);
 if(form.dataset.form==='settings')await saveSettings(form);
 if(form.dataset.form==='filter'){const d=new FormData(form);state.filter=String(d.get('search')||'');state.type=String(d.get('type')||'todos');state.status=String(d.get('status')||'todos');render();}
});
setInterval(()=>{
 if(!state.auto||state.killed)return;
 const remaining=state.nextAt-Date.now(),el=document.getElementById('countdown');
 if(el)el.textContent=remaining>0?Math.ceil(remaining/1000)+' s':'ahora';
 if(remaining<=0&&!state.busy){
  state.nextAt=Date.now()+Math.max(5,Number(state.settings.interval_minutes)||15)*60000;
  void cycle('auto');
 }
},1000);
init();