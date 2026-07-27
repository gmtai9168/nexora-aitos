"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { accessFor, canEdit, canOpen, type Access, type Role } from "./rbac";

const STORAGE_KEY = "nexora-role";
const DEFAULT_ROLE: Role = "founder";

const VALID: Role[] = [
  "guest",
  "personal",
  "pro",
  "company",
  "quant",
  "fund",
  "risk",
  "admin",
  "founder",
];

function loadOverride(): Role | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && VALID.includes(raw as Role) ? (raw as Role) : null;
  } catch {
    return null;
  }
}

type RoleState = {
  role: Role;
  /** True when the active role comes from a real signed-in session. */
  authenticated: boolean;
  /** Whether the current role may use the manual role switcher (preview). */
  canSwitch: boolean;
  setRole: (r: Role) => void;
  access: (href: string) => Access;
  canOpen: (href: string) => boolean;
  canEdit: (href: string) => boolean;
};

const RoleContext = createContext<RoleState | null>(null);

/**
 * Resolves the active role. When a user is signed in, their real role (from the
 * session JWT) is authoritative — only admin/founder keep the manual switcher
 * for previewing other roles. When nobody is signed in, the app falls back to a
 * local override (default: founder) so the live owner is never locked out and
 * the permission matrix stays demonstrable.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const sessionRole = session?.user?.role as Role | undefined;

  const [override, setOverrideState] = useState<Role | null>(loadOverride);

  useEffect(() => {
    try {
      if (override) localStorage.setItem(STORAGE_KEY, override);
    } catch {
      /* storage full — keep it in memory */
    }
  }, [override]);

  const authed = status === "authenticated" && !!sessionRole;
  const privileged = !authed || sessionRole === "founder" || sessionRole === "admin";

  const role: Role = privileged
    ? override ?? sessionRole ?? DEFAULT_ROLE
    : sessionRole ?? DEFAULT_ROLE;

  const setRole = useCallback(
    (r: Role) => {
      if (privileged) setOverrideState(r);
    },
    [privileged],
  );

  const value = useMemo<RoleState>(
    () => ({
      role,
      authenticated: authed,
      canSwitch: privileged,
      setRole,
      access: (href: string) => accessFor(role, href),
      canOpen: (href: string) => canOpen(role, href),
      canEdit: (href: string) => canEdit(role, href),
    }),
    [role, authed, privileged, setRole],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleState {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>");
  return ctx;
}
