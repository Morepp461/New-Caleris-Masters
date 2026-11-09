import { AdminDashboard } from "@/components/admin-dashboard";
import { requireAdmin } from "@/lib/admin-auth";
import { ADMIN_SHEETS } from "@/lib/admin-sheets";
import { getDatabase } from "@/lib/mongodb";
export const dynamic="force-dynamic";
export default async function Home(){
 const admin=await requireAdmin();
 const db=await getDatabase();
 const grouped=await db.collection("admin_sheet_records").aggregate([{$group:{_id:"$sheet_key",count:{$sum:1}}}]).toArray();
 const counts:Record<string,number>={};for(const sheet of ADMIN_SHEETS)counts[sheet.key]=0;
 for(const row of grouped)counts[String(row._id)]=Number(row.count);
 return <AdminDashboard counts={counts} displayName={admin.displayName}/>;
}
