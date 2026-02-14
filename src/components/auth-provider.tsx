"use client";

import { SessionProvider } from "next-auth/react";

import { EightBallTransitionProvider } from "@/components/eight-ball-transition-provider";

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  return (
    <SessionProvider>
      <EightBallTransitionProvider>{children}</EightBallTransitionProvider>
    </SessionProvider>
  );
}
