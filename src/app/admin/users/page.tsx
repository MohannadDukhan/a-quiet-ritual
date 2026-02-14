import { notFound } from "next/navigation";

import { AdminUserRolesPanel } from "@/components/admin-user-roles-panel";
import { AppHeader } from "@/components/layout/app-header";
import { requireOwnerAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const adminUser = await requireOwnerAdminUser();
  if (!adminUser) {
    notFound();
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { email: "asc" },
    select: { email: true },
  });

  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-journalWrap">
        <AdminUserRolesPanel initialAdmins={admins.map((admin) => admin.email)} />
      </main>
    </div>
  );
}
