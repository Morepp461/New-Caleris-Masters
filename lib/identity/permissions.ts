import { AppError } from "@/lib/server/errors";
import type { SessionPrincipal } from "./session";
import { getMongoDatabase } from "@/lib/db/mongodb";
import { isRolePermissionAllowed } from "./policy.mjs";

export async function hasPermission(
  principal: SessionPrincipal,
  permissionKey: string,
  scope = "GLOBAL",
): Promise<boolean> {
  if (principal.isOperator) return true;
  if (!principal.activeRole) return false;

  const db = await getMongoDatabase();
  const [permission, policy] = await Promise.all([
    db.collection("permissions").findOne({ key: permissionKey, status: "ACTIVE" }),
    db.collection("role_permission_policies").findOne({
      role: principal.activeRole,
      permission_key: permissionKey,
      allowed: true,
      scope,
    }),
  ]);
  return isRolePermissionAllowed(permission, policy, scope);
}

export async function requirePermission(
  principal: SessionPrincipal | null,
  permissionKey: string,
  scope = "GLOBAL",
) {
  if (!principal) throw new AppError("UNAUTHENTICATED", "Authentication is required.", 401);
  if (!(await hasPermission(principal, permissionKey, scope))) {
    throw new AppError("FORBIDDEN", "You do not have permission to perform this action.", 403);
  }
}

export async function requireOperator(principal: SessionPrincipal | null) {
  if (!principal) throw new AppError("UNAUTHENTICATED", "Authentication is required.", 401);
  if (!principal.isOperator) throw new AppError("FORBIDDEN", "Operator access is required.", 403);
}
