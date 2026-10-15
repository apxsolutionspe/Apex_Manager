import {isEvmAddress,parseWei,formatWei,compareBalances,requestWalletAccount,isPendingPermissionError} from './wallet-core.mjs';
const el=id=>document.getElementById(id);
const button=el('connect');
let provider=null,address=null,chain=null,prior=null,busy=false,timer=null,generation=0;
function status(message){el('status').textContent=message}
function reset(){
 generation++;address=null;chain=null;prior=null;
 el('address').textContent='—';el('chain').textContent='—';el('balance').textContent='—';el('change').textContent='—';
 if(timer!==null){clearInterval(timer);timer=null}
}
// EIP-6963 discovers MetaMask explicitly when Brave Wallet also injects a provider.
const advertisedMetaMask=[];
window.addEventListener('eip6963:announceProvider',event=>{
 const {info,provider:announced}=event?.detail||{};
 if(info?.rdns==='io.metamask'&&announced?.isMetaMask&&typeof announced.request==='function'&&!advertisedMetaMask.includes(announced))advertisedMetaMask.push(announced);
});
window.dispatchEvent(new Event('eip6963:requestProvider'));
function selectedMetaMask(){
 const p=advertisedMetaMask[0]||window.ethereum?.providers?.find(x=>x?.isMetaMask)||window.ethereum;
 return p?.isMetaMask&&typeof p.request==='function'?p:null;
}
async function refresh(){
 if(!provider||!address||busy)return;
 busy=true;const rev=generation;
 try{
  const [chainHex,weiHex]=await Promise.all([
   provider.request({method:'eth_chainId'}),
   provider.request({method:'eth_getBalance',params:[address,'latest']})
  ]);
  if(rev!==generation)return;
  if(typeof chainHex!=='string'||!/^0x[0-9a-fA-F]{1,16}$/.test(chainHex))throw Error('Identificador de red inválido');
  if(chainHex!==chain){chain=chainHex;prior=null}
  const current=parseWei(weiHex);
  const comparison=compareBalances(prior,current);
  prior=current;
  el('chain').textContent='Chain ID: '+BigInt(chainHex).toString();
  el('balance').textContent=formatWei(current)+' (token nativo)';
  el('change').textContent=comparison.type==='increase'?'Entrada detectada: +'+formatWei(comparison.delta):
    comparison.type==='decrease'?'Salida o reducción: −'+formatWei(comparison.delta):
    comparison.type==='unchanged'?'Sin cambios':'Lectura inicial';
  status('Saldo leído mediante MetaMask: '+new Date().toLocaleTimeString('es-PE')+
    '. No confirma ganancias, origen de fondos ni elegibilidad.');
 }catch(e){if(rev===generation)status('No se pudo consultar el saldo: '+String(e?.message||e).slice(0,160))}
 finally{busy=false}
}
async function connect(){
 if(busy)return;
 const p=selectedMetaMask();
 if(!p){status('MetaMask no está disponible. Abre esta página con su navegador o instala la extensión oficial.');return}
 button.disabled=true;
 try{
  status('Comprobando permisos existentes de MetaMask. Si aparece una ventana de autorización, revísala una sola vez.');
  const {address:first}=await requestWalletAccount(p);
  if(provider!==p){provider=p;
   p.on?.('accountsChanged',onAccounts);
   p.on?.('chainChanged',()=>{chain=null;prior=null;void refresh()});
   p.on?.('disconnect',()=>{reset();status('La billetera se desconectó')});
  }
  reset();address=first;
  el('address').textContent=address;
  status('Conectado con permisos de lectura. Consultando saldo...');
  await refresh();
  timer=setInterval(()=>{if(!document.hidden)void refresh()},30000);
 }catch(e){
  if(isPendingPermissionError(e)){
   status('MetaMask tiene una solicitud anterior pendiente. No pulses Conectar otra vez. Abre MetaMask y revisa sus notificaciones; si no aparece nada, sigue la guía Brave bajo este botón.');
   document.getElementById('brave-help')?.setAttribute('open','');
  }else status('Conexión cancelada o fallida: '+String(e?.message||e).slice(0,140));
 }
 finally{button.disabled=false}
}
function onAccounts(accounts){
 const first=Array.isArray(accounts)?accounts[0]:null;
 reset();
 if(!isEvmAddress(first)){status('MetaMask desconectada o sin acceso a cuentas');return}
 address=first;el('address').textContent=address;void refresh();
 timer=setInterval(()=>{if(!document.hidden)void refresh()},30000);
}
button.addEventListener('click',()=>void connect());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
