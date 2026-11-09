import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminSheet } from "@/lib/admin-sheets";
import { AdminSheetWorkspace } from "@/components/admin-sheet-workspace";

export default async function AdminSheetPage({params}:{params:Promise<{sheet:string}>}) {
 await requireAdmin();
 const {sheet}=await params;
 const definition=getAdminSheet(sheet);
 if(!definition)notFound();
 return <AdminSheetWorkspace sheet={definition}/>;
}
