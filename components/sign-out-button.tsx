"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy,setBusy] = useState(false);

  async function signOut() {
    const supabase = createClient();
    if (!supabase || busy) return;
    setBusy(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <button className="signout-button" onClick={signOut} disabled={busy} aria-label="Keluar">
    <LogOut size={15}/><span>{busy?"Keluar...":"Keluar"}</span>
  </button>;
}
