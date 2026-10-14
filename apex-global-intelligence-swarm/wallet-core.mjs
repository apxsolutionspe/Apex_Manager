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
 return whole+(fraction&&/[1-9]/.test(fraction)?'.'+fraction:'');
}
export function compareBalances(previous,current){
 if(typeof current!=='bigint'||current<0n)throw Error('Saldo inválido');
 if(previous===null)return {type:'baseline',delta:0n};
 if(typeof previous!=='bigint'||previous<0n)throw Error('Comparación inválida');
 return {type:current>previous?'increase':current<previous?'decrease':'unchanged',delta:current>=previous?current-previous:previous-current};
}
export const READ_METHODS=Object.freeze(['eth_requestAccounts','eth_accounts','eth_chainId','eth_getBalance']);
