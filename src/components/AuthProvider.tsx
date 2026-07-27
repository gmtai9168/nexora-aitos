"use client";

import { SessionProvider } from "next-auth/react";

/** Client boundary so the whole tree can read the auth session via useSession(). */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
