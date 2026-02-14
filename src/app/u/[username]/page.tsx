import { notFound, redirect } from "next/navigation";

import { PublicProfilePanel } from "@/components/public-profile-panel";
import { AppHeader } from "@/components/layout/app-header";
import { prisma } from "@/lib/db";
import { getProfileSharedEntriesPage } from "@/lib/profile-shared-entries";
import { getRequestTimeZone } from "@/lib/request-timezone";
import { normalizeUsername, validateNormalizedUsername } from "@/lib/username";

type PublicProfilePageProps = {
  params: Promise<{ username: string }>;
};

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username: usernameParam } = await params;
  const normalizedUsername = normalizeUsername(usernameParam);
  const validationError = validateNormalizedUsername(normalizedUsername);
  if (validationError) {
    notFound();
  }

  if (usernameParam !== normalizedUsername) {
    redirect(`/u/${encodeURIComponent(normalizedUsername)}`);
  }

  const [timeZone, user] = await Promise.all([
    getRequestTimeZone(),
    prisma.user.findUnique({
      where: { username: normalizedUsername },
      select: {
        id: true,
        username: true,
        image: true,
        createdAt: true,
      },
    }),
  ]);

  if (!user) {
    notFound();
  }

  const sharedEntriesPage = await getProfileSharedEntriesPage({
    userId: user.id,
    limit: 10,
  });

  return (
    <div className="bw-bg">
      <AppHeader />

      <main className="bw-journalWrap">
        <PublicProfilePanel
          username={user.username || normalizedUsername}
          image={user.image}
          createdAt={user.createdAt.toISOString()}
          timeZone={timeZone}
          initialSharedEntries={sharedEntriesPage.items}
          initialSharedEntriesNextCursor={sharedEntriesPage.nextCursor}
        />
      </main>
    </div>
  );
}
