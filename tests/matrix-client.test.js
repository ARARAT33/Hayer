import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHomeserver, isHayerEventType } from "../src/matrix/client.js";

test("normalizes a public Matrix homeserver to an HTTPS origin", () => {
  assert.equal(normalizeHomeserver("converser.eu"), "https://converser.eu");
  assert.equal(normalizeHomeserver("https://matrix.example.org/"), "https://matrix.example.org");
});

test("rejects insecure and malformed homeserver URLs", () => {
  assert.throws(() => normalizeHomeserver("http://matrix.example.org"), /HTTPS/);
  assert.throws(() => normalizeHomeserver(""), /հասցեն/);
  assert.throws(() => normalizeHomeserver("https://user:pass@example.org"), /չթույլատրված/);
});

test("accepts only HAYER-namespaced application events", () => {
  assert.equal(isHayerEventType("org.hayer.post"), true);
  assert.equal(isHayerEventType("org.hayer.community.post"), true);
  assert.equal(isHayerEventType("m.room.message"), false);
  assert.equal(isHayerEventType("org.other.post"), false);
});
