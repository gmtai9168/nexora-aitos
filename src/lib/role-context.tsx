"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

function loadRole(): Role {
  if (typeof window === "undefined") return DEFAULT_ROLE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && VALID.includes(raw as Role) ? (raw as Role) : DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

type RoleState = {
  role: Role;
  setRole: (r: Role) => void;
  access: (href: string) => Access;
  canOpen: (href: string) => boolean;
  canEdit: (href: string) => boolean;
};

const RoleContext = createContext<RoleState | null>(null);

/**
 * Holds the active role client-side (until a real auth backend replaces it) so
 * the whole permission matrix is enforced and demonstrable via the switcher.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(loadRole);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, role);
    } catch {
      /* storage full — keep it in memory */
    }
  }, [role]);

  const setRole = useCallback((r: Role) => setRoleState(r), []);

  const value = useMemo<RoleState>(
    () => ({
      role,
      setRole,
      access: (href: string) => accessFor(role, href),
      canOpen: (href: string) => canOpen(role, href),
      canEdit: (href: string) => canEdit(role, href),
    }),
    [role, setRole],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleState {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>");
  return ctx;
}
