import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";

export async function requireAdmin() {
 const admin=await getCurrentAdmin();
 if(!admin)redirect("/login");
 return admin;
}
