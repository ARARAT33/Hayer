import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHomeserver } from "../src/matrix/client.js";

test("normalizes a public Matrix homeserver to an HTTPS origin", () => {
  assert.equal(normalizeHomeserver("converser.eu"), "https://converser.eu");
  assert.equal(normalizeHomeserver("https://matrix.example.org/"), "https://matrix.example.org");
});

test("rejects insecure and malformed homeserver URLs", () => {
  assert.throws(() => normalizeHomeserver("http://matrix.example.org"), /HTTPS/);
  assert.throws(() => normalizeHomeserver(""), /հասցեն/);
  assert.throws(() => normalizeHomeserver("https://user:pass@example.org"), /չթույլատրված/);
});

test("rejects HAYER event types outside the application namespace", async () => {
  const source = await import("../src/matrix/client.js");
  assert.equal(typeof source.sendHayerEvent, "function");
});
