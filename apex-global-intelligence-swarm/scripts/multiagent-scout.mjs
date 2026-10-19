// APEX bounded multi-agent research. No submissions, wallet keys, trading, or payments.
// Node.js 22; all external inputs are data, never instructions.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ISSUE_URL = /^https:\/\/github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+\/issues\/[1-9]\d*$/i;
export const SCOUTS = Object.freeze([
  { id: 'code-bounties', specialization: 'Correcciones remuneradas',
    query: 'is:issue is:open label:bounty updated:>DATE sort:updated-desc' },
  { id: 'micro-fixes', specialization: 'Errores pequeños con posible pago',
    query: 'is:issue is:open "bounty" "bug" updated:>DATE sort:updated-desc' },
  { id: 'docs-bounties', specialization: 'Documentación técnica remunerada',
    query: 'is:issue is:open "bounty" "docs" updated:>DATE sort:updated-desc' }
]);
const MAX_RESULTS = 12;
const MIN_AMOUNT_USD = 1;

export function vetIssue(raw, agent, today = new Date()) {
  if (!raw || raw.pull_request || !ISSUE_URL.test(String(raw.html_url || ''))) return null;
  if (raw.state !== 'open' || typeof raw.title !== 'string') return null;
  const updated = Date.parse(raw.updated_at || '');
  if (!Number.isFinite(updated) || updated > today.getTime() + 86400000 ||
      today.getTime() - updated > 92 * 86400000) return null;
  const title = raw.title.trim().slice(0, 220);
  const content = (title + ' ' + String(raw.body || '').slice(0, 2000)).toLowerCase();
  const amountMatch = content.match(/(?:\$\s*|usd\s*)([1-9]\d{0,5})(?!\d)/i);
  const estimatedAmount = amountMatch ? Number(amountMatch[1]) : null;
  // Titles and bodies are untrusted; amounts are unverified claims, not assets.
  const risky = /seed phrase|private key|connect your wallet|deposit first|upfront fee|pay to join|guaranteed profit|casino|betting/i.test(content);
  const labels = (Array.isArray(raw.labels) ? raw.labels : [])
    .map(x => String(typeof x === 'string' ? x : x.name || '').toLowerCase()).slice(0, 16);
  // Stronger relevance gate: don't treat arbitrary mentions of "paid" or
  // a dollar amount in noisy issue text as a real paid assignment.
  const labelledBounty = labels.some(x => /\bbounty\b|\breward\b/.test(x));
  const titledBounty = /\bbounty\b|\bpaid task\b|\bpaid issue\b/.test(title.toLowerCase());
  const mirroredAlert = /\bradar\b|\bmirror\b|\brelay log\b|\bwatchlist\b|\bmonitor\b|\bqueue\b/i.test(title) ||
    /bounty-plaza|sn-monetization-runtime|bounty-feed/i.test(String(raw.repository_url || ''));
  const tooCrowded = Number(raw.comments || 0) > 30;
  if ((!labelledBounty && !titledBounty) || !estimatedAmount || mirroredAlert || tooCrowded) return null;
  let score = 0;
  if (estimatedAmount >= MIN_AMOUNT_USD) score += 20;
  if (labels.some(x => /bounty|paid/.test(x))) score += 10;
  if ((raw.comments || 0) < 5) score += 12;
  if ((raw.comments || 0) > 25) score -= 15;
  if (today.getTime() - updated < 14 * 86400000) score += 12;
  if (risky) score = 0;
  return {
    agent: agent.id, title, url: raw.html_url,
    repository: String(raw.repository_url || '').replace('https://api.github.com/repos/', '').slice(0, 160),
    comments: Number(raw.comments) || 0, last_updated: new Date(updated).toISOString(),
    advertised_usd_unverified: estimatedAmount,
    risk: risky ? 'potential_fraud_or_required_payment' : 'payment_and_eligibility_unverified',
    stage: risky ? 'rejected_review' : 'needs_manual_sponsor_verification',
    priority_score: score,
    sponsor_verified: false, award_funded_verified: false,
    eligibility_peru_verified: false, payout_verified: false, assignment_verified: false
  };
}

export async function scout(agent, opts = {}) {
  const now = opts.now || new Date();
  const daysAgo = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const query = agent.query.replace('DATE', daysAgo);
  const url = 'https://api.github.com/search/issues?' + new URLSearchParams({
    q: query, per_page: '30'
  }).toString();
  const headers = { Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'APEX-Prime-X-ReadOnlyScout' };
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
  const fetcher = opts.fetcher || fetch;
  const res = await fetcher(url, { headers, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error('GitHub issue search HTTP ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data.items)) throw new Error('GitHub returned unexpected data');
  const findings = data.items.map(x => vetIssue(x, agent, now)).filter(Boolean)
    .filter(x => x.stage !== 'rejected_review')
    .sort((a, b) => b.priority_score - a.priority_score).slice(0, MAX_RESULTS);
  return { id: agent.id, specialization: agent.specialization,
    checked_public_items: data.items.length, status: 'complete', findings };
}

async function readCryptoFeed(read, dir) {
  try {
    const feed = JSON.parse(await read(path.join(dir, 'feed/crypto.json'), 'utf8'));
    return { id: 'crypto-watch', status: 'external_radar_observed',
      monitored: Number(feed.stats?.monitored || 0),
      received_tokens_reported: Number(feed.economics?.verified_tokens_received || 0),
      note: 'Separate crypto workflow remains responsible; feed figures are NOT independently verified balances.' };
  } catch (e) {
    return { id: 'crypto-watch', status: 'unavailable', note: String(e.message).slice(0, 150) };
  }
}

export async function runAgents(opts = {}) {
  const now = opts.now || new Date();
  const read = opts.read || readFile;
  const dir = opts.root || ROOT;
  const jobs = [
    ...SCOUTS.map(agent => scout(agent, opts)),
    readCryptoFeed(read, dir),
    Promise.resolve({ id: 'commercial-outreach', status: 'delegated',
      note: 'GitHub Pages self-service sales and voluntarily initiated WhatsApp enquiries; no third-party posting, accounts, or mass messaging.' }),
    Promise.resolve({ id: 'payment-auditor', status: 'read_only',
      note: 'No confirmed invoice, sponsor acceptance, bank credit, or on-chain receipt is provided to this process.' })
  ];
  const results = await Promise.allSettled(jobs);
  const agents = results.map((r, i) => r.status === 'fulfilled' ? r.value :
    { id: i < SCOUTS.length ? SCOUTS[i].id : 'unknown',
      status: 'error', reason: String(r.reason?.message || r.reason).slice(0, 180) });
  // Verifier deduplicates across worker streams, and rejects suspicious items.
  const unique = new Map();
  for (const agent of agents) for (const item of agent.findings || []) {
    if (!unique.has(item.url) || unique.get(item.url).priority_score < item.priority_score)
      unique.set(item.url, item);
  }
  const leads = [...unique.values()].sort((a,b) => b.priority_score - a.priority_score).slice(0, 30);
  agents.push({ id: 'risk-verifier', status: 'complete', inspected: leads.length,
    accepted_payments: 0, note: 'GitHub issue text and amount do not prove available funds.' });
  const failed = agents.filter(a => a.status === 'error').length;
  return {
    schema: 'apex-multiagent-v1', generated_at: now.toISOString(), execution_mode: 'bounded_read_only',
    parallel_agents: agents.length, network_requests_max: SCOUTS.length,
    external_accounts_created: 0, messages_sent: 0, transactions_executed: 0,
    verified_new_income_usd: null,
    income_status: 'no_payment_evidence_in_this_run',
    worker_failures: failed, agents, candidate_count: leads.length,
    verified_payable_opportunities: 0,
    candidates: leads,
    next_steps: ['Validate sponsor and payment terms on primary source',
      'Check whether issue accepts new submissions before implementing',
      'Use authorized account to submit tested PR, await acceptance and actual payment'],
    safeguards: ['no self-replication', 'no autonomous wallet signing',
      'no impersonation or spam', 'no invented revenue', 'rate-limited official API']
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runAgents({ token: process.env.GITHUB_TOKEN });
  const dir = path.join(ROOT, 'artifacts');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'multiagent-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    agents: report.parallel_agents, candidate_count: report.candidate_count,
    failures: report.worker_failures, verified_income: 'not evidenced',
    report: 'artifacts/multiagent-report.json'
  }));
  if (report.worker_failures === SCOUTS.length) process.exitCode = 1;
}