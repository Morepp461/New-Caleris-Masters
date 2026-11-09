import test from "node:test";
import assert from "node:assert/strict";
import {
  isDiscordLinkLoginEligible,
  isRolePermissionAllowed,
} from "../lib/identity/policy.mjs";

test("Discord login accepts only provisioned pending or active links", () => {
  assert.equal(isDiscordLinkLoginEligible("PENDING"), true);
  assert.equal(isDiscordLinkLoginEligible("ACTIVE"), true);
  assert.equal(isDiscordLinkLoginEligible("REVOKED"), false);
  assert.equal(isDiscordLinkLoginEligible("SUSPENDED"), false);
  assert.equal(isDiscordLinkLoginEligible(undefined), false);
  assert.equal(isDiscordLinkLoginEligible(null), false);
});

test("permission requires an active permission and an explicitly allowed matching-scope policy", () => {
  assert.equal(
    isRolePermissionAllowed(
      { status: "ACTIVE" },
      { allowed: true, scope: "GLOBAL" },
      "GLOBAL",
    ),
    true,
  );
});

test("permission fails closed when permission is missing or disabled", () => {
  assert.equal(isRolePermissionAllowed(null, { allowed: true, scope: "GLOBAL" }, "GLOBAL"), false);
  assert.equal(
    isRolePermissionAllowed(
      { status: "DISABLED" },
      { allowed: true, scope: "GLOBAL" },
      "GLOBAL",
    ),
    false,
  );
});

test("permission fails closed when policy is missing, denied, or scoped differently", () => {
  const activePermission = { status: "ACTIVE" };
  assert.equal(isRolePermissionAllowed(activePermission, null, "GLOBAL"), false);
  assert.equal(
    isRolePermissionAllowed(activePermission, { allowed: false, scope: "GLOBAL" }, "GLOBAL"),
    false,
  );
  assert.equal(
    isRolePermissionAllowed(activePermission, { allowed: true, scope: "TEAM" }, "GLOBAL"),
    false,
  );
  assert.equal(
    isRolePermissionAllowed(activePermission, { allowed: 1, scope: "GLOBAL" }, "GLOBAL"),
    false,
  );
});
