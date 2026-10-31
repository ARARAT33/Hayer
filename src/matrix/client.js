import * as sdk from "matrix-js-sdk";

const MATRIX_WELL_KNOWN = "/.well-known/matrix/client";
const MATRIX_VERSIONS = "/_matrix/client/versions";
const MATRIX_LOGIN = "/_matrix/client/v3/login";
const HAYER_EVENT_PREFIX = "org.hayer.";

export function isHayerEventType(eventType) {
  return typeof eventType === "string" && eventType.startsWith(HAYER_EVENT_PREFIX);
}

let activeClient = null;

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
    // A missing well-known file is valid; CORS/network failures are not.
    if (error.status !== 404 && error.status !== 405) throw error;
  }

  const [versions, loginFlows, registrationFlows] = await Promise.all([
    fetchJson(new URL(MATRIX_VERSIONS, baseUrl)),
    fetchJson(new URL("/_matrix/client/v3/login", baseUrl)),
    fetchJson(new URL("/_matrix/client/v3/register", baseUrl)).catch(error => {
      if ([401, 403, 404, 405].includes(error.status)) return { flows: [], unavailable: true };
      throw error;
    }),
  ]);

  return {
    origin,
    baseUrl,
    versions: versions.versions || [],
    loginFlows: loginFlows.flows || [],
    registrationFlows: registrationFlows.flows || [],
    registrationAvailable: !registrationFlows.unavailable,
  };
}

function createUnauthenticatedClient(baseUrl) {
  return sdk.createClient({ baseUrl, timelineSupport: true });
}

function createAuthenticatedClient(credentials, baseUrl) {
  return sdk.createClient({
    baseUrl,
    userId: credentials.user_id,
    accessToken: credentials.access_token,
    deviceId: credentials.device_id,
    timelineSupport: true,
  });
}

async function activateClient(credentials, baseUrl, { enableEncryption = true } = {}) {
  if (activeClient) {
    activeClient.stopClient();
    activeClient = null;
  }

  const client = createAuthenticatedClient(credentials, baseUrl);
  let encryption = { enabled: false, reason: "not-requested" };

  if (enableEncryption) {
    try {
      await client.initRustCrypto();
      encryption = { enabled: true, reason: null };
    } catch (error) {
      encryption = { enabled: false, reason: error.message || "crypto-init-failed" };
    }
  }

  activeClient = client;
  await client.startClient({ initialSyncLimit: 20 });
  return { client, credentials, encryption };
}

export async function loginWithPassword(homeserver, username, password, options = {}) {
  const server = await discoverHomeserver(homeserver);
  const localpart = String(username ?? "").trim().replace(/^@/, "").split(":")[0];
  if (!localpart || !password) throw new Error("Լրացրու օգտանունն ու գաղտնաբառը։");

  const unauthenticated = createUnauthenticatedClient(server.baseUrl);
  const credentials = await unauthenticated.loginRequest({
    type: "m.login.password",
    identifier: { type: "m.id.user", user: localpart },
    password,
    initial_device_display_name: options.deviceName || "HAYER",
  });
  if (!credentials?.access_token || !credentials?.user_id) {
    throw new Error("Սերվերը չվերադարձրեց մուտքի ամբողջական տվյալները։");
  }
  return { ...(await activateClient(credentials, server.baseUrl, options)), server };
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

  const registrationClient = createUnauthenticatedClient(server.baseUrl);
  try {
    const credentials = await registrationClient.registerRequest({
      username: localpart,
      password,
      auth: { type: "m.login.dummy" },
      initial_device_display_name: options.deviceName || "HAYER",
    });
    if (!credentials?.access_token || !credentials?.user_id) {
      return { registered: false, needsAuthentication: true, server };
    }
    return {
      registered: true,
      ...(await activateClient(credentials, server.baseUrl, options)),
      server,
    };
  } catch (error) {
    const flows = error.data?.flows || error.data?.params?.flows || [];
    if (flows.length || error.data?.session) {
      return {
        registered: false,
        needsAuthentication: true,
        session: error.data.session || null,
        flows,
        completed: error.data.completed || [],
        server,
      };
    }
    throw error;
  }
}

export function getActiveClient() {
  return activeClient;
}

export async function stopActiveClient({ logout = false } = {}) {
  if (!activeClient) return;
  const client = activeClient;
  activeClient = null;
  try {
    if (logout) await client.logout();
  } finally {
    client.stopClient();
  }
}

export async function sendHayerEvent(roomId, eventType, content) {
  if (!activeClient) throw new Error("HAYER Matrix սեսիան ակտիվ չէ։");
  if (!isHayerEventType(eventType)) {
    throw new Error("HAYER հավելվածի իրադարձության տեսակը վավեր չէ։");
  }
  return activeClient.sendEvent(roomId, eventType, content, "");
}

export async function sendTextMessage(roomId, body) {
  if (!activeClient) throw new Error("HAYER Matrix սեսիան ակտիվ չէ։");
  const text = String(body ?? "").trim();
  if (!text) throw new Error("Հաղորդագրությունը դատարկ է։");
  return activeClient.sendEvent(roomId, "m.room.message", {
    msgtype: "m.text",
    body: text,
  }, "");
}

export async function createHayerRoom(options) {
  if (!activeClient) throw new Error("HAYER Matrix սեսիան ակտիվ չէ։");
  return activeClient.createRoom(options);
}

export async function joinMatrixRoom(roomId) {
  if (!activeClient) throw new Error("HAYER Matrix սեսիան ակտիվ չէ։");
  return activeClient.joinRoom(roomId);
}

export function getJoinedRooms() {
  if (!activeClient) return [];
  return activeClient.getRooms().map(room => ({
    roomId: room.roomId,
    name: room.name,
    membership: room.getMyMembership(),
  }));
}
