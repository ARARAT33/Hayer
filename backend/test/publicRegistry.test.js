'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRegistry, selectInstance, getLaunchUrl } = require('../src/services/publicRegistry.service');

test('normalizes HTTPS public instances and removes unsafe or unsupported entries', () => {
  const result = normalizeRegistry({ version: 2, nodes: [
    { type: 'mastodon', url: 'https://social.example', registration: 'open', health: 'healthy' },
    { type: 'mastodon', url: 'https://social.example/', registration: 'closed', health: 'unknown' },
    { type: 'matrix', url: 'http://insecure.example' },
    { type: 'unknown', url: 'https://unknown.example' }
  ] });
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].url, 'https://social.example');
  assert.equal(result.nodes[0].registration, 'closed');
});

test('does not allow status endpoints on a different host', () => {
  const result = normalizeRegistry({ nodes: [
    { type: 'matrix', url: 'https://matrix.example', statusUrl: 'https://attacker.example/probe' }
  ] });
  assert.equal(result.nodes[0].statusUrl, null);
});

test('selects a healthy open instance ahead of unknown instances', () => {
  const nodes = normalizeRegistry({ nodes: [
    { type: 'lemmy', url: 'https://closed.example', registration: 'closed', health: 'healthy' },
    { type: 'lemmy', url: 'https://open.example', registration: 'open', health: 'healthy' },
    { type: 'lemmy', url: 'https://down.example', registration: 'open', health: 'unhealthy' }
  ] }).nodes;
  assert.equal(selectInstance(nodes, 'lemmy').url, 'https://open.example');
});

test('only returns signup paths when registration is explicitly open', () => {
  assert.equal(getLaunchUrl({ type: 'mastodon', url: 'https://social.example', registration: 'open' }),
    'https://social.example/auth/sign_up');
  assert.equal(getLaunchUrl({ type: 'mastodon', url: 'https://social.example', registration: 'unknown' }),
    'https://social.example/');
});

test('rejects malformed registry payloads and unsafe launch URLs', () => {
  assert.throws(() => normalizeRegistry({ nodes: {} }), /nodes array/);
  assert.equal(getLaunchUrl({ type: 'mastodon', url: 'javascript:alert(1)', registration: 'open' }), null);
});
