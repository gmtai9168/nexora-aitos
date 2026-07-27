"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

const LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  apple: "Apple",
  "microsoft-entra-id": "Microsoft",
};

/** Renders sign-in buttons only for OAuth providers the server has configured. */
export function OAuthButtons({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/account/providers")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setProviders(Array.isArray(d.providers) ? d.providers : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 py-1 text-[11px] text-muted">
        <span className="h-px flex-1 bg-line" />
        หรือเข้าสู่ระบบด้วย
        <span className="h-px flex-1 bg-line" />
      </div>
      {providers.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => signIn(p, { callbackUrl })}
          className="w-full rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium text-txt transition hover:border-brand/60 hover:bg-panel-2"
        >
          ดำเนินการต่อด้วย {LABELS[p] ?? p}
        </button>
      ))}
    </div>
  );
}
