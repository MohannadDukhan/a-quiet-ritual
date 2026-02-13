import { prisma } from "@/lib/db";
import { getTodaysPrompt } from "@/lib/prompt-service";

export type AdminModerationReply = {
  id: string;
  content: string;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
};

export type AdminModerationEntry = {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  userEmail: string;
  replies: AdminModerationReply[];
};

export type AdminBannedUser = {
  id: string;
  email: string;
};

export type AdminModerationTodayData = {
  prompt: {
    id: string;
    text: string;
  };
  entries: AdminModerationEntry[];
  bannedUsers: AdminBannedUser[];
};

export async function getAdminModerationTodayData(): Promise<AdminModerationTodayData> {
  const todaysPrompt = await getTodaysPrompt();

  const entries = await prisma.entry.findMany({
    where: {
      type: "PROMPT",
      isCollective: true,
      promptId: todaysPrompt.id,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      user: {
        select: {
          email: true,
        },
      },
      collectiveReplies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          userId: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  const bannedUsers = await prisma.user.findMany({
    where: { collectiveBanned: true },
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
    },
  });

  return {
    prompt: {
      id: todaysPrompt.id,
      text: todaysPrompt.text,
    },
    entries: entries.map((entry) => ({
      id: entry.id,
      content: entry.content,
      createdAt: entry.createdAt.toISOString(),
      userId: entry.userId,
      userEmail: entry.user.email,
      replies: entry.collectiveReplies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt.toISOString(),
        userId: reply.userId,
        userEmail: reply.user?.email || null,
      })),
    })),
    bannedUsers,
  };
}
