"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
export function SignOutButton(){
 const router=useRouter();
 async function signOut(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/login");router.refresh();}
 return <button type="button" onClick={()=>void signOut()} aria-label="Keluar" title="Keluar" className="admin-signout"><LogOut size={15}/></button>;
}
