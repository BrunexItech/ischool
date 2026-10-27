"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { themeFor } from "@/components/ModuleBanner";

/** The "nothing here yet" panel: the page's own icon and colour, so empty never looks broken. */
export function EmptyNote({ children }: { children: ReactNode }) {
  const t = themeFor(usePathname());
  const Icon = t.icon;
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed bg-card/60 px-6 py-9 text-center">
      <span className="flex size-11 items-center justify-center rounded-full text-white/95 shadow-xs" style={{ backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.to})`, opacity: 0.9 }}>
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="max-w-md text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
