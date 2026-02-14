import { prisma } from "@/lib/db";
import { getTodaysPrompt } from "@/lib/prompt-service";

export type AdminModerationReply = {
  id: string;
  content: string;
  createdAt: string;
  userId: string | null;
  userUsername: string | null;
  userImage: string | null;
};

export type AdminModerationEntry = {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  userUsername: string | null;
  userImage: string | null;
  replies: AdminModerationReply[];
};

export type AdminBannedUser = {
  id: string;
  username: string | null;
  image: string | null;
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
          username: true,
          image: true,
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
              username: true,
              image: true,
            },
          },
        },
      },
    },
  });

  const bannedUsers = await prisma.user.findMany({
    where: { collectiveBanned: true },
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      image: true,
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
      userUsername: entry.user.username,
      userImage: entry.user.image,
      replies: entry.collectiveReplies.map((reply) => ({
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt.toISOString(),
        userId: reply.userId,
        userUsername: reply.user?.username || null,
        userImage: reply.user?.image || null,
      })),
    })),
    bannedUsers,
  };
}
