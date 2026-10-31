#!/usr/bin/env node
/**
 * Build a public-only HAYER instance registry from upstream open directories.
 * Runs on GitHub Actions; HAYER does not need a VPS or an operator-owned server.
 */
import { readFile, writeFile } from "node:fs/promises";

const SOURCES = {
  matrix: "https://servers.joinmatrix.org/servers.json",
  peertube: "https://instances.joinpeertube.org/api/v1/instances",
};

const TIMEOUT_MS = 15000;
const MAX_PEERTUBE_PAGES = 10;
const PAGE_SIZE = 100;

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "HAYER-public-registry/1.0" },
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
    candidate.pathname = candidate.pathname.replace(/\/$/, "") || "/";
    candidate.search = "";
    candidate.hash = "";
    return candidate.origin + (candidate.pathname === "/" ? "" : candidate.pathname);
  } catch {
    return null;
  }
}

function matrixNodes(payload) {
  if (!Array.isArray(payload?.public_servers)) throw new Error("Matrix directory returned an unexpected schema");
  const rows = payload.public_servers;
  return rows.flatMap((row) => {
    const host = httpsBase(row.client_domain || row.server_domain);
    if (!host) return [];
    return [{
      id: `matrix:${new URL(host).host}`,
      name: String(row.name || new URL(host).host).slice(0, 100),
      type: "matrix",
      url: host,
      statusUrl: `${host}/_matrix/client/versions`,
      region: String(row.staff_jur || row.isp || "").slice(0, 100),
      source: SOURCES.matrix,
      integrationModes: ["federated_public"],
      capabilities: ["public_read", "messaging", "federation"],
      registration: "unknown",
      health: "unknown",
      verified: false,
      notes: "Listed as public by the upstream directory. Registration and HAYER SSO are not guaranteed; check the operator's rules.",
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
    const rows = payload.data;
    for (const row of rows) {
      const host = httpsBase(row.host || row.domain || row.url);
      if (!host) continue;
      output.push({
        id: `peertube:${new URL(host).host}`,
        name: String(row.name || new URL(host).host).slice(0, 100),
        type: "peertube",
        url: host,
        statusUrl: `${host}/api/v1/config`,
        region: String(row.country || row.location || "").slice(0, 100),
        source: SOURCES.peertube,
        integrationModes: ["federated_public"],
        capabilities: ["public_read", "federation"],
        registration: "unknown",
        health: "unknown",
        verified: false,
        notes: "Listed by the public PeerTube index. Account creation, uploads and OAuth depend on this instance's policy.",
      });
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return output;
}

const results = await Promise.allSettled([
  getJson(SOURCES.matrix).then(matrixNodes),
  peerTubeNodes(),
]);

const nodes = [];
const failures = [];
const failedTypes = new Set();
for (const [index, result] of results.entries()) {
  if (result.status === "fulfilled") nodes.push(...result.value);
  else {
    failedTypes.add(index === 0 ? "matrix" : "peertube");
    failures.push(String(result.reason?.message || result.reason));
  }
}

// Preserve the last known entries for a source that temporarily failed.
if (failedTypes.size) {
  try {
    const previous = JSON.parse(await readFile("registry.json", "utf8"));
    for (const node of previous.nodes || []) {
      if (failedTypes.has(node.type)) nodes.push({ ...node, health: "unknown" });
    }
  } catch {
    // First run: there is no previous snapshot to preserve.
  }
}

const deduped = [...new Map(nodes.map((node) => [node.id, node])).values()]
  .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

if (deduped.length === 0) {
  throw new Error(`No public instances discovered. Refusing to overwrite the last good registry. ${failures.join("; ")}`);
}

const registry = {
  version: 1,
  generatedAt: new Date().toISOString(),
  sources: Object.values(SOURCES),
  nodes: deduped,
  discoveryWarnings: failures,
};

await writeFile("registry.json", `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Wrote ${deduped.length} public instances (${deduped.filter((node) => node.type === "matrix").length} Matrix, ${deduped.filter((node) => node.type === "peertube").length} PeerTube).`);
if (failures.length) console.warn("Some sources failed:", failures.join("; "));
