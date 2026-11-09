import { AdminDashboard } from "@/components/admin-dashboard";
import { requireAdmin } from "@/lib/admin-auth";
import { ADMIN_SHEETS } from "@/lib/admin-sheets";

export const dynamic = "force-dynamic";

export default async function Home() {
 const {supabase,displayName}=await requireAdmin();
 const {data,error}=await (supabase as any).from("admin_sheet_records").select("sheet_key").limit(5000);
 const counts:Record<string,number>={};
 for(const sheet of ADMIN_SHEETS)counts[sheet.key]=0;
 if(!error)for(const row of data??[])counts[row.sheet_key]=(counts[row.sheet_key]??0)+1;
 return <AdminDashboard counts={counts} displayName={displayName??"Administrator"}/>;
}
