import { notFound } from "next/navigation";

import { AdminModerationPanel } from "@/components/admin-moderation-panel";
import { AppHeader } from "@/components/layout/app-header";
import { auth } from "@/lib/auth";
import { requireAdminUser } from "@/lib/admin-auth";
import { getAdminModerationTodayData } from "@/lib/admin-moderation";
import { getUpcomingResolvedPromptDays } from "@/lib/prompt-service";
import { getRequestTimeZone } from "@/lib/request-timezone";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [adminUser, session] = await Promise.all([requireAdminUser(), auth()]);
  if (!adminUser) {
    notFound();
  }
  const canManageRoles = session?.user?.isOwner === true;

  const [timeZone, moderationData, promptDays] = await Promise.all([
    getRequestTimeZone(),
    getAdminModerationTodayData(),
    getUpcomingResolvedPromptDays(),
  ]);

  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-page">
        <AdminModerationPanel
          initialData={moderationData}
          initialPromptDays={promptDays}
          timeZone={timeZone}
          canManageRoles={canManageRoles}
        />
      </main>
    </div>
  );
}
