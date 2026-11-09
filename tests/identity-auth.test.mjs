import test from "node:test";
import assert from "node:assert/strict";
import { createOpaqueToken, hashOpaqueToken, createOAuthState, verifyOAuthState } from "../lib/identity/crypto.mjs";

test("opaque session token is cryptographically random and URL-safe", () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test("session token hash is fixed-length SHA-256 hex and not the raw token", () => {
  const token = createOpaqueToken();
  const hash = hashOpaqueToken(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(hashOpaqueToken(token), hash);
});

test("OAuth state accepts only the exact issued value", () => {
  const state = createOAuthState();
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(verifyOAuthState(state, state), true);
  assert.equal(verifyOAuthState(state, "different-state"), false);
  assert.equal(verifyOAuthState(undefined, state), false);
  assert.equal(verifyOAuthState(state, null), false);
});
