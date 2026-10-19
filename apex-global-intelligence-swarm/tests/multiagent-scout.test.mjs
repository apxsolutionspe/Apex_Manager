import test from 'node:test';
import assert from 'node:assert/strict';
import {SCOUTS, vetIssue, scout, runAgents} from '../scripts/multiagent-scout.mjs';

const NOW = new Date('2026-10-19T14:00:00Z');
const safe = {
  html_url: 'https://github.com/example-org/project/issues/42',
  repository_url: 'https://api.github.com/repos/example-org/project',
  state: 'open', title: 'Bounty $50: repair a TypeScript parsing bug',
  body: 'An issue with a possible reward and standard PR review.',
  updated_at: '2026-10-18T11:00:00Z', comments: 2,
  labels: [{name: 'bounty'}]
};

test('accepts only fresh, primary, open GitHub issues with explicit evidence flags', () => {
  const result = vetIssue(safe, SCOUTS[0], NOW);
  assert.equal(result.advertised_usd_unverified, 50);
  assert.equal(result.payout_verified, false);
  assert.equal(result.stage, 'needs_manual_sponsor_verification');
  assert.ok(result.priority_score > 0);
  assert.equal(vetIssue({...safe, state:'closed'}, SCOUTS[0], NOW), null);
  assert.equal(vetIssue({...safe, pull_request:{url:'anything'}}, SCOUTS[0], NOW), null);
  assert.equal(vetIssue({...safe, html_url:'https://bad.example/issues/42'}, SCOUTS[0], NOW), null);
  assert.equal(vetIssue({...safe, updated_at:'2025-01-01T00:00:00Z'}, SCOUTS[0], NOW), null);
});

test('rejects paid access, wallet credentials and misleading security tasks', () => {
  const outcome = vetIssue({...safe, body:'Pay to join first; send private key.'}, SCOUTS[0], NOW);
  assert.equal(outcome.stage, 'rejected_review');
  assert.equal(outcome.priority_score, 0);
});

test('scout only performs a bounded read-only GitHub search', async () => {
  let calls = 0;
  const result = await scout(SCOUTS[0], { now: NOW, fetcher: async (url, init) => {
    calls += 1;
    assert.match(url, /^https:\/\/api\.github\.com\/search\/issues\?/);
    assert.equal(init.method, undefined);
    assert.equal(init.headers.Authorization, undefined);
    return { ok:true, json:async() => ({items:[safe]}) };
  }});
  assert.equal(calls, 1);
  assert.equal(result.findings.length, 1);
});

test('parallel multiagent run deduplicates candidates and never treats rewards as income', async () => {
  let started = 0;
  const report = await runAgents({
    now:NOW,
    fetcher: async () => {
      started++;
      return {ok:true, json:async() => ({items:[safe, {...safe, html_url:'https://other.example/not-issue'}]})};
    },
    read: async () => JSON.stringify({
      stats:{monitored:3},
      economics:{verified_tokens_received:10}
    })
  });
  assert.equal(started, 3);
  assert.equal(report.parallel_agents, 7);
  assert.equal(report.network_requests_max, 3);
  assert.equal(report.candidate_count, 1);
  assert.equal(report.transactions_executed, 0);
  assert.equal(report.messages_sent, 0);
  assert.equal(report.verified_new_income_usd, null);
  assert.equal(report.agents[3].received_tokens_reported, 10);
  assert.ok(report.safeguards.includes('no self-replication'));
});

test('one failing agent does not block other independent workers', async () => {
  const report = await runAgents({
    now:NOW,
    fetcher: async url => {
      if (url.includes('label%3Abounty')) throw Error('rate limited');
      return {ok:true, json:async() => ({items:[safe]})};
    },
    read: async () => '{}'
  });
  assert.equal(report.worker_failures, 1);
  assert.equal(report.candidate_count, 1);
});