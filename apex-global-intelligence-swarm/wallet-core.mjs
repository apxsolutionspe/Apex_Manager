// APEX read-only EVM wallet observations. No imports, signing, keys or transactions.
export function isEvmAddress(value){return typeof value==='string' && /^0x[0-9a-fA-F]{40}$/.test(value);}
export function parseWei(value){
 if(typeof value!=='string'||!/^0x[0-9a-fA-F]{1,64}$/.test(value))throw Error('Respuesta RPC de saldo inválida');
 return BigInt(value);
}
export function formatWei(wei,decimals=6){
 if(typeof wei!=='bigint'||wei<0n)throw Error('Saldo inválido');
 const whole=(wei/1000000000000000000n).toString();
 const fraction=(wei%1000000000000000000n).toString().padStart(18,'0').slice(0,Math.max(0,Math.min(18,decimals)));
 const trimmed=fraction.replace(/0+$/,'');
 return whole+(trimmed?'.'+trimmed:'');
}
export function compareBalances(previous,current){
 if(typeof current!=='bigint'||current<0n)throw Error('Saldo inválido');
 if(previous===null)return {type:'baseline',delta:0n};
 if(typeof previous!=='bigint'||previous<0n)throw Error('Comparación inválida');
 return {type:current>previous?'increase':current<previous?'decrease':'unchanged',delta:current>=previous?current-previous:previous-current};
}
export const READ_METHODS=Object.freeze(['eth_requestAccounts','eth_accounts','eth_chainId','eth_getBalance']);

/**
 * Check existing dapp permission before requesting a new one.
 * Only reads connected accounts or asks to disclose an account.
 * No transactions, signatures, seed phrases or network writes.
 */
export async function requestWalletAccount(provider){
 if(!provider||typeof provider.request!=='function')throw Error('Proveedor MetaMask no disponible');
 const existing=await provider.request({method:'eth_accounts'});
 if(!Array.isArray(existing))throw Error('Respuesta de cuentas inválida');
 const authorized=existing.find(isEvmAddress);
 if(authorized)return {address:authorized,requestedPermission:false};
 const next=await provider.request({method:'eth_requestAccounts'});
 if(!Array.isArray(next))throw Error('Respuesta de conexión inválida');
 const address=next.find(isEvmAddress);
 if(!address)throw Error('MetaMask no entregó una dirección EVM válida');
 return {address,requestedPermission:true};
}
export function isPendingPermissionError(error){
 const message=String(error?.message||'');
 return Number(error?.code)===-32002||/already pending|request.*pending|wallet_requestPermissions/i.test(message);
}
