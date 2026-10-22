import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const base = new URL('../../.github/workflows/apex-multiagent.yml',import.meta.url);
const yaml = await readFile(base,'utf8');
const studio = await readFile(new URL('../plantillas-premium.html',import.meta.url),'utf8');
const services = await readFile(new URL('../servicios.html',import.meta.url),'utf8');

test('APEX hourly nominal schedule has bounded timeouts and read-only GitHub access',()=>{
 assert.match(yaml,/- cron: '27 \* \* \* \*'/);
 assert.match(yaml,/permissions:\s*\n  contents: read/);
 assert.match(yaml,/timeout-minutes: 8/);
 assert.match(yaml,/if: github\.event_name != 'pull_request'/);
 assert.match(yaml,/if: github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/);
 assert.match(yaml,/node scripts\/multiagent-scout\.mjs/);
 assert.match(yaml,/node scripts\/sales-health\.mjs/);
 assert.match(yaml,/retention-days: 3/);
 assert.match(yaml,/cancel-in-progress: false/);
 assert.doesNotMatch(yaml,/permissions:\s*\n  contents: write/);
});

test('sales changes, premium products and operations tests trigger CI',()=>{
 for(const target of [
  "apex-global-intelligence-swarm/scripts/sales-health.mjs",
  "apex-global-intelligence-swarm/plantillas-premium.html",
  "apex-global-intelligence-swarm/tests/premium-storefront.test.mjs",
  "apex-global-intelligence-swarm/tests/apex-operations.test.mjs"
 ]) assert.equal(yaml.split("      - '"+target+"'").length-1,2,target);
});

test('both public sales funnels link to merchant checkout only after price agreement',()=>{
 for(const [name,source] of [['premium',studio],['services',services]]){
  assert.match(source,/https:\/\/link\.mercadopago\.com\.pe\/apexprimex/,name);
  assert.match(source,/acordad[oa]/i,name);
  assert.match(source,/https:\/\/wa\.me\/51931797758/,name);
 }
 assert.match(studio,/no confirma automáticamente un pedido/);
 assert.match(services,/no genera contratos ni entrega automática/);
});
