import * as sdk from "matrix-js-sdk";

const MATRIX_WELL_KNOWN = "/.well-known/matrix/client";
const MATRIX_VERSIONS = "/_matrix/client/versions";
const HAYER_EVENT_PREFIX = "org.hayer.";
let activeClient = null;
let activeServer = null;

export function isHayerEventType(eventType) {
  return typeof eventType === "string" && eventType.startsWith(HAYER_EVENT_PREFIX);
}

export function normalizeHomeserver(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("Մուտքագրիր Matrix սերվերի հասցեն։");
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "https:") throw new Error("Հանրային Matrix սերվերը պետք է օգտագործի HTTPS։");
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Սերվերի հասցեն պարունակում է չթույլատրված տվյալներ։");
  }
  return url.origin;
}

async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json", ...(options.headers || {}) },
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {
      throw new Error("Սերվերը վերադարձրեց սխալ JSON պատասխան։");
    }
    if (!response.ok) {
      const error = new Error(data.error || data.errcode || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Սերվերի հարցման ժամանակը լրացավ։");
    if (error instanceof TypeError) {
      throw new Error("Չհաջողվեց կապվել սերվերին։ Հնարավոր է՝ սերվերի CORS-ը չի թույլատրում HAYER-ին միանալ։");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverHomeserver(input) {
  const origin = normalizeHomeserver(input);
  let baseUrl = origin;
  try {
    const wellKnown = await fetchJson(new URL(MATRIX_WELL_KNOWN, origin));
    const advertised = wellKnown?.["m.homeserver"]?.base_url;
    if (advertised) baseUrl = normalizeHomeserver(advertised);
  } catch (error) {
    if (error.status !== 404 && error.status !== 405) throw error;
  }

  const [versions, loginFlows] = await Promise.all([
    fetchJson(new URL(MATRIX_VERSIONS, baseUrl)),
    fetchJson(new URL("/_matrix/client/v3/login", baseUrl)),
  ]);
  return {
    origin,
    baseUrl,
    versions: versions.versions || [],
    loginFlows: loginFlows.flows || [],
  };
}

function createClient(baseUrl, credentials = null) {
  const config = { baseUrl, timelineSupport: true };
  if (credentials) {
    config.userId = credentials.user_id;
    config.accessToken = credentials.access_token;
    if (credentials.device_id) config.deviceId = credentials.device_id;
    if (credentials.refresh_token) config.refreshToken = credentials.refresh_token;
  }
  return sdk.createClient(config);
}

async function activateClient(credentials, baseUrl, { enableEncryption = true } = {}) {
  if (!credentials?.user_id || !credentials?.access_token) {
    throw new Error("Matrix սերվերը չվերադարձրեց վավեր հաշվի տվյալներ։");
  }
  if (activeClient) {
    activeClient.stopClient();
    activeClient = null;
  }

  const client = createClient(baseUrl, credentials);
  let encryption = { enabled: false, reason: "disabled" };
  if (enableEncryption) {
    try {
      await client.initRustCrypto();
      encryption = { enabled: true, reason: null };
    } catch (error) {
      encryption = { enabled: false, reason: error?.message || "crypto-init-failed" };
    }
  }

  activeClient = client;
  activeServer = baseUrl;
  await client.startClient({ initialSyncLimit: 30 });
  return { client, credentials, encryption, baseUrl };
}

export async function loginWithPassword(homeserver, username, password, options = {}) {
  const server = await discoverHomeserver(homeserver);
  const localpart = String(username ?? "").trim().replace(/^@/, "").split(":")[0];
  if (!localpart || !password) throw new Error("Լրացրու օգտանունն ու գաղտնաբառը։");
  const unauthenticated = createClient(server.baseUrl);
  const credentials = await unauthenticated.loginRequest({
    type: "m.login.password",
    identifier: { type: "m.id.user", user: localpart },
    password,
    initial_device_display_name: options.deviceName || "HAYER",
    refresh_token: true,
  });
  const active = await activateClient(credentials, server.baseUrl, options);
  return { ...active, server };
}

export async function registerAccount(homeserver, username, password, options = {}) {
  const server = await discoverHomeserver(homeserver);
  const localpart = String(username ?? "").trim().replace(/^@/, "").split(":")[0];
  if (!/^[a-z0-9._=-]{1,64}$/i.test(localpart)) {
    throw new Error("Օգտանունը պետք է պարունակի միայն տառեր, թվեր և թույլատրված նշաններ։");
  }
  if (String(password ?? "").length < 8) {
    throw new Error("Գաղտնաբառը պետք է լինի առնվազն 8 նիշ։");
  }

  const registrationClient = createClient(server.baseUrl);
  try {
    const credentials = await registrationClient.registerRequest({
      username: localpart,
      password,
      auth: { type: "m.login.dummy" },
      initial_device_display_name: options.deviceName || "HAYER",
      refresh_token: true,
    });
    if (!credentials?.access_token || !credentials?.user_id) {
      return { registered: false, needsAuthentication: true, challenge: null, server };
    }
    return {
      registered: true,
      ...(await activateClient(credentials, server.baseUrl, options)),
      server,
    };
  } catch (error) {
    const data = error?.data || error?.body || {};
    const flows = data.flows || data.params?.flows || [];
    if (flows.length || data.session) {
      return {
        registered: false,
        needsAuthentication: true,
        challenge: {
          session: data.session || null,
          flows,
          completed: data.completed || [],
          params: data.params || {},
        },
        server,
      };
    }
    throw error;
  }
}

export async function resumeSession(credentials, baseUrl, options = {}) {
  const server = normalizeHomeserver(baseUrl);
  return activateClient(credentials, server, options);
}

export function getActiveClient() {
  return activeClient;
}

export function getSyncState() {
  return activeClient?.getSyncState?.() || "STOPPED";
}

export async function stopActiveClient({ logout = false } = {}) {
  if (!activeClient) return;
  const client = activeClient;
  activeClient = null;
  activeServer = null;
  try {
    if (logout) await client.logout();
  } finally {
    client.stopClient();
  }
}

function requireClient() {
  if (!activeClient) throw new Error("HAYER Matrix սեսիան ակտիվ չէ։");
  return activeClient;
}

export async function sendHayerEvent(roomId, eventType, content) {
  if (!isHayerEventType(eventType)) {
    throw new Error("HAYER հավելվածի իրադարձության տեսակը վավեր չէ։");
  }
  return requireClient().sendEvent(roomId, eventType, content, "");
}

export async function sendRoomEvent(roomId, eventType, content) {
  const allowedStandardTypes = new Set(["m.room.message", "m.reaction"]);
  if (!isHayerEventType(eventType) && !allowedStandardTypes.has(eventType)) {
    throw new Error("Matrix event type is not allowed by the HAYER client.");
  }
  return requireClient().sendEvent(roomId, eventType, content, "");
}

export async function sendTextMessage(roomId, body) {
  const text = String(body ?? "").trim();
  if (!text) throw new Error("Հաղորդագրությունը դատարկ է։");
  return sendRoomEvent(roomId, "m.room.message", {
    msgtype: "m.text",
    body: text,
  });
}

export async function createHayerRoom(options) {
  return requireClient().createRoom(options);
}

export async function joinMatrixRoom(roomId) {
  return requireClient().joinRoom(roomId);
}

export async function setRoomStateEvent(roomId, eventType, content, stateKey = "") {
  if (!isHayerEventType(eventType) && !["m.room.name", "m.room.topic", "m.room.avatar"].includes(eventType)) {
    throw new Error("Matrix state event type is not allowed by the HAYER client.");
  }
  return requireClient().sendStateEvent(roomId, eventType, content, stateKey);
}

export async function getJoinedRooms() {
  return requireClient().getRooms()
    .filter(room => room.getMyMembership() === "join")
    .map(room => ({
      roomId: room.roomId,
      name: room.name,
      membership: room.getMyMembership(),
    }));
}

export function getRoomTimeline(roomId) {
  const room = requireClient().getRoom(roomId);
  return room ? room.getLiveTimeline().getEvents() : [];
}

export function getServerBaseUrl() {
  return activeServer;
}
