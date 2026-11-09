import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const { data: profile } = await supabase.from("member_profiles").select("role,display_name").eq("user_id",String(userId)).maybeSingle();
  if (profile?.role !== "admin") redirect("/login?reason=admin-only");
  return { supabase, userId:String(userId), displayName:profile.display_name };
}
