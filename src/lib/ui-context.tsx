"use client";

import { createContext, useCallback, useContext, useState } from "react";

/** Shared UI state — currently the mobile navigation drawer. */
type UiState = {
  navOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
  toggleNav: () => void;
};

const UiContext = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const openNav = useCallback(() => setNavOpen(true), []);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const toggleNav = useCallback(() => setNavOpen((v) => !v), []);

  return (
    <UiContext.Provider value={{ navOpen, openNav, closeNav, toggleNav }}>
      {children}
    </UiContext.Provider>
  );
}

export function useUi(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside <UiProvider>");
  return ctx;
}
