#!/usr/bin/env node
/**
 * Build HAYER's public-only federated registry from upstream public directories.
 * This is a scheduled GitHub Actions job: HAYER requires no user-operated server.
 * Discovery is read-only. It never creates accounts or bypasses instance policies.
 */
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const SOURCES = {
  matrix: "https://servers.joinmatrix.org/servers.json",
  peertube: "https://instances.joinpeertube.org/api/v1/instances",
  lemmy: "https://raw.githubusercontent.com/LemmyNet/lemmy-statistics/main/instances/joinlemmy.json.gz",
  mastodonPeers: "https://mastodon.social/api/v1/instance/peers",
  pixelfedPeers: "https://pixelfed.social/api/v1/instance/peers",
};
const TIMEOUT_MS = 15000;
const MAX_PEERTUBE_PAGES = 10;
const PAGE_SIZE = 100;
const MAX_FEDIVERSE_PEERS = 100;
const MAX_LEMMY_CANDIDATES = 120;

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "HAYER-public-registry/2.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}
function httpsBase(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const candidate = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    if (candidate.protocol !== "https:" || candidate.username || candidate.password) return null;
    return candidate.origin;
  } catch { return null; }
}
function node(type, host, extra = {}) {
  const url = httpsBase(host);
  if (!url) return null;
  return {
    id: `${type}:${new URL(url).host}`,
    name: String(extra.name || new URL(url).host).slice(0, 100),
    type, url, statusUrl: extra.statusUrl || null,
    region: String(extra.region || "").slice(0, 100),
    source: extra.source || SOURCES[type] || "public peer discovery",
    software: extra.software || type,
    integrationModes: ["federated_public"],
    capabilities: ["public_read", "federation"],
    registration: extra.registration || "unknown",
    health: "healthy",
    lastCheckedAt: new Date().toISOString(),
    policyUrls: extra.policyUrls || [],
    verified: true,
    notes: extra.notes || "Discovered from a public directory and checked through its public read-only API. Account creation and write access remain subject to the operator's policy.",
  };
}
function matrixNodes(payload) {
  if (!Array.isArray(payload?.public_servers)) throw new Error("Matrix directory returned an unexpected schema");
  return payload.public_servers.flatMap((row) => {
    const host = httpsBase(row.client_domain || row.server_domain);
    if (!host) return [];
    return [{
      ...node("matrix", host, {
        name: row.name, statusUrl: `${host}/_matrix/client/versions`, source: SOURCES.matrix,
        region: row.staff_jur || row.isp, registration: "unknown",
        capabilities: ["public_read", "messaging", "federation"],
        notes: "Listed by the public Matrix directory. Registration and HAYER SSO are not guaranteed; check the operator's rules.",
      }),
      capabilities: ["public_read", "messaging", "federation"],
      health: "unknown", verified: false,
    }];
  });
}
async function peerTubeNodes() {
  const output = [];
  for (let page = 0; page < MAX_PEERTUBE_PAGES; page += 1) {
    const url = new URL(SOURCES.peertube);
    url.searchParams.set("start", String(page * PAGE_SIZE));
    url.searchParams.set("count", String(PAGE_SIZE));
    const payload = await getJson(url);
    if (!Array.isArray(payload?.data)) throw new Error("PeerTube index returned an unexpected schema");
    for (const row of payload.data) {
      const host = httpsBase(row.host || row.domain || row.url);
      if (!host) continue;
      output.push({
        ...node("peertube", host, {
          name: row.name, statusUrl: `${host}/api/v1/config`, source: SOURCES.peertube,
          region: row.country || row.location, registration: "unknown",
          notes: "Listed by the public PeerTube index. Signup, uploads and OAuth depend on this instance's policy.",
        }),
        health: "unknown", verified: false,
      });
    }
    if (payload.data.length < PAGE_SIZE) break;
  }
  return output;
}
async function peerNodes(seedUrl, fallbackType) {
  const peers = await getJson(seedUrl);
  if (!Array.isArray(peers)) throw new Error(`Peer list returned an unexpected schema: ${seedUrl}`);
  const hosts = [...new Set(peers.map(httpsBase).filter(Boolean))].slice(0, MAX_FEDIVERSE_PEERS);
  const output = [];
  for (let i = 0; i < hosts.length; i += 8) {
    const batch = await Promise.allSettled(hosts.slice(i, i + 8).map(async (host) => {
      const info = await getJson(`${host}/api/v2/instance`);
      const version = String(info.version || "");
      const type = /pixelfed/i.test(version) ? "pixelfed" : fallbackType;
      const registrationValue = info.registrations?.enabled ?? info.registrations;
      const registration = registrationValue === true ? "open" : registrationValue === false ? "closed" : "unknown";
      return node(type, host, {
        name: info.title || info.domain,
        statusUrl: `${host}/api/v2/instance`,
        source: seedUrl,
        software: version || type,
        registration,
        policyUrls: [info.configuration?.urls?.privacy_policy, info.configuration?.urls?.about].filter(Boolean),
        notes: `Public peer discovered through ${new URL(seedUrl).hostname}; public instance metadata responded. Signup and app permissions are controlled by its operator.`,
      });
    }));
    for (const result of batch) if (result.status === "fulfilled" && result.value) output.push(result.value);
  }
  return output;
}
function extractLemmyHosts(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.instances || payload?.data || [];
  return [...new Set(rows.map((row) => row.domain || row.host || row.base_url || row.url).map(httpsBase).filter(Boolean))].slice(0, MAX_LEMMY_CANDIDATES);
}
async function lemmyNodes() {
  const response = await fetch(SOURCES.lemmy, {
    headers: { "user-agent": "HAYER-public-registry/2.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${SOURCES.lemmy}`);
  const raw = Buffer.from(await response.arrayBuffer());
  let payload;
  try { payload = JSON.parse(gunzipSync(raw).toString("utf8")); }
  catch { throw new Error("Lemmy statistics archive could not be decoded"); }
  const hosts = extractLemmyHosts(payload);
  if (!hosts.length) throw new Error("Lemmy statistics contained no recognizable instance hosts");
  const output = [];
  for (let i = 0; i < hosts.length; i += 8) {
    const batch = await Promise.allSettled(hosts.slice(i, i + 8).map(async (host) => {
      const site = await getJson(`${host}/api/v3/site`);
      const view = site.site_view || {};
      const name = view.site?.name || new URL(host).host;
      const registration = view.local_site?.registration_mode;
      return node("lemmy", host, {
        name, statusUrl: `${host}/api/v3/site`, source: SOURCES.lemmy,
        registration: registration === "Open" ? "open" : registration === "Closed" ? "closed" : "unknown",
        notes: "Discovered in the Lemmy community statistics dataset and verified with the public /api/v3/site endpoint. Signup and federation rules are controlled by the operator.",
      });
    }));
    for (const result of batch) if (result.status === "fulfilled" && result.value) output.push(result.value);
  }
  return output;
}

const jobs = [
  ["matrix", () => getJson(SOURCES.matrix).then(matrixNodes)],
  ["peertube", peerTubeNodes],
  ["lemmy", lemmyNodes],
  ["mastodon", () => peerNodes(SOURCES.mastodonPeers, "mastodon")],
  ["pixelfed", () => peerNodes(SOURCES.pixelfedPeers, "pixelfed")],
];
const results = await Promise.allSettled(jobs.map(([, run]) => run()));
const nodes = [];
const failures = [];
const failedTypes = new Set();
for (const [index, result] of results.entries()) {
  if (result.status === "fulfilled") nodes.push(...result.value.filter(Boolean));
  else {
    failedTypes.add(jobs[index][0]);
    failures.push(`${jobs[index][0]}: ${String(result.reason?.message || result.reason)}`);
  }
}
if (failedTypes.size) {
  try {
    const previous = JSON.parse(await readFile("registry.json", "utf8"));
    for (const item of previous.nodes || []) {
      if (failedTypes.has(item.type)) nodes.push({ ...item, health: "unknown" });
    }
  } catch { /* First run has no previous snapshot. */ }
}
const deduped = [...new Map(nodes.map((item) => [item.id, item])).values()]
  .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
if (!deduped.length) throw new Error(`No public instances discovered; refusing to overwrite the last good registry. ${failures.join("; ")}`);
const registry = {
  version: 2,
  generatedAt: new Date().toISOString(),
  sources: Object.values(SOURCES),
  nodes: deduped,
  discoveryWarnings: failures,
};
await writeFile("registry.json", `${JSON.stringify(registry, null, 2)}\\n`);
console.log(`Wrote ${deduped.length} public instances: ${Object.entries(Object.groupBy(deduped, (item) => item.type)).map(([type, items]) => `${type}=${items.length}`).join(", ")}.`);
if (failures.length) console.warn("Some sources failed:", failures.join("; "));
