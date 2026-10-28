"use client";

import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type SectionTheme = { from: string; to: string };

/** The header of one section of a child's record. Each section has its own colour, icon and figures,
 *  so moving from Timetable to Fees to Conduct feels like moving between different places. */
export function SectionBanner({ icon: Icon, theme, title, subtitle, visual, chips }: { icon: LucideIcon; theme: SectionTheme; title: string; subtitle?: string; visual?: ReactNode; chips?: { label: string; value: ReactNode }[] }) {
  return (
    <header className="relative overflow-hidden rounded-3xl p-5 text-white shadow-md sm:p-6" style={{ backgroundImage: `linear-gradient(120deg, ${theme.from}, ${theme.to})` }}>
      <Icon aria-hidden className="pointer-events-none absolute -right-3 -bottom-5 size-36 opacity-[0.13] sm:size-44" strokeWidth={1.25} />
      <span aria-hidden className="pointer-events-none absolute -top-12 left-1/3 size-44 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4">
        {visual && <div className="shrink-0">{visual}</div>}
        <div className="min-w-0 flex-1 basis-52">
          <p className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-white/80 uppercase"><Icon className="size-4" aria-hidden /> {title}</p>
          {subtitle && <h1 className="mt-1 font-heading text-xl leading-snug font-semibold tracking-tight break-words sm:text-2xl">{subtitle}</h1>}
        </div>
        {chips && chips.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {chips.map((c) => (
              <div key={c.label} className="min-w-20 rounded-2xl bg-white/15 px-3.5 py-2 text-center backdrop-blur-sm">
                <p className="font-heading text-lg leading-tight font-semibold tabular-nums">{c.value}</p>
                <p className="text-[10px] tracking-wide text-white/80 uppercase">{c.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
