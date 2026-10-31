'use strict';

const ALLOWED_TYPES = new Set([
  'matrix', 'mastodon', 'lemmy', 'peertube', 'pixelfed',
  'discourse', 'mobilizon', 'nextcloud', 'xmpp', 'zulip',
  'humhub', 'rocketchat'
]);

const SIGNUP_PATHS = Object.freeze({
  mastodon: '/auth/sign_up',
  pixelfed: '/register',
  peertube: '/signup',
  lemmy: '/signup'
});

function safeHttps(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Validate and normalize the public registry snapshot. This function never
 * creates accounts, contacts private endpoints, or treats unknown as healthy.
 */
function normalizeRegistry(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.nodes)) {
    throw new TypeError('Registry must contain a nodes array');
  }

  const unique = new Map();
  for (const input of snapshot.nodes) {
    if (!input || typeof input !== 'object') continue;
    const type = String(input.type || '').toLowerCase();
    const url = safeHttps(input.url);
    if (!ALLOWED_TYPES.has(type) || !url) continue;

    const key = type + ':' + url.hostname.toLowerCase();
    const status = safeHttps(input.statusUrl || '');
    const node = {
      id: String(input.id || key).slice(0, 180),
      name: String(input.name || url.hostname).slice(0, 100),
      type,
      url: url.origin,
      statusUrl: status && status.hostname === url.hostname ? status.href : null,
      region: String(input.region || '').slice(0, 80),
      registration: ['open', 'closed', 'unknown'].includes(input.registration)
        ? input.registration : 'unknown',
      health: ['healthy', 'unhealthy', 'unknown'].includes(input.health)
        ? input.health : 'unknown',
      verified: input.verified === true,
      source: String(input.source || 'public-registry').slice(0, 160)
    };
    unique.set(key, node);
  }

  return {
    version: Number.isInteger(snapshot.version) ? snapshot.version : 1,
    generatedAt: snapshot.generatedAt || null,
    nodes: [...unique.values()]
  };
}

/** Select a public instance for browsing; never implies cross-instance SSO. */
function selectInstance(nodes, type) {
  const wanted = String(type || '').toLowerCase();
  if (!ALLOWED_TYPES.has(wanted) || !Array.isArray(nodes)) return null;
  return nodes
    .filter(node => node.type === wanted && node.health !== 'unhealthy' && safeHttps(node.url))
    .sort((a, b) => {
      const score = node =>
        (node.registration === 'open' ? 8 : 0) +
        (node.health === 'healthy' ? 4 : 0) +
        (node.verified ? 2 : 0);
      return score(b) - score(a) || a.url.localeCompare(b.url);
    })[0] || null;
}

/** Return a registration URL only when the public directory says it is open. */
function getLaunchUrl(node) {
  if (!node || !safeHttps(node.url)) return null;
  const url = new URL(node.url);
  if (node.registration === 'open' && SIGNUP_PATHS[node.type]) {
    url.pathname = SIGNUP_PATHS[node.type];
  }
  return url.href;
}

module.exports = { ALLOWED_TYPES, normalizeRegistry, selectInstance, getLaunchUrl };
