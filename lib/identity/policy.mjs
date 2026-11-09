export function isDiscordLinkLoginEligible(status) {
  return status === "PENDING" || status === "ACTIVE";
}

export function isRolePermissionAllowed(permission, policy, requestedScope) {
  return Boolean(
    permission &&
    permission.status === "ACTIVE" &&
    policy &&
    policy.allowed === true &&
    policy.scope === requestedScope
  );
}
