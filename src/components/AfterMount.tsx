"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders its children only once the client has mounted.
 *
 * The dashboard is made entirely of live market data, so its markup starts
 * changing the moment the first poll returns. If that lands while React is
 * still hydrating, panels it has not reached yet mismatch the server HTML.
 * Prerendering placeholder numbers buys nothing here, so we skip it.
 */
export function AfterMount({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  return <>{mounted ? children : fallback}</>;
}

/** Panel-shaped placeholder used while the first data poll is in flight. */
export function PanelSkeleton({ height = 120 }: { height?: number }) {
  return (
    <div
      className="panel animate-pulse"
      style={{ height }}
      aria-hidden="true"
    />
  );
}
