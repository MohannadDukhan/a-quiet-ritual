import { notFound } from "next/navigation";

import { AdminModerationPanel } from "@/components/admin-moderation-panel";
import { AppHeader } from "@/components/layout/app-header";
import { requireAdminUser } from "@/lib/admin-auth";
import { getAdminModerationTodayData } from "@/lib/admin-moderation";
import { getUpcomingResolvedPromptDays } from "@/lib/prompt-service";
import { getRequestTimeZone } from "@/lib/request-timezone";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const adminUser = await requireAdminUser();
  if (!adminUser) {
    notFound();
  }

  const [timeZone, moderationData, promptDays] = await Promise.all([
    getRequestTimeZone(),
    getAdminModerationTodayData(),
    getUpcomingResolvedPromptDays(),
  ]);

  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-journalWrap">
        <AdminModerationPanel initialData={moderationData} initialPromptDays={promptDays} timeZone={timeZone} />
      </main>
    </div>
  );
}
