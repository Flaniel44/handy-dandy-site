import { redirect } from "next/navigation";

import { requireAdmin } from "../../../lib/admin-auth";

export default async function ProtectedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!await requireAdmin()) redirect("/admin/login");
  return children;
}
