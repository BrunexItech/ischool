"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, CircleAlert, CircleCheck } from "lucide-react";
import { api, PulseSection } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const TONE_TEXT: Record<string, string> = {
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
  neutral: "",
};

/** The head's view of a department: how it is doing this week, in a few
 *  figures, and the specific things that need a person to look. Shown at the
 *  top of a module for school leadership; teachers and others never see it. */
export function DepartmentPulse({ dept, collapsible = true }: { dept: string; collapsible?: boolean }) {
  const { user, token } = useAuth();
  const [section, setSection] = useState<PulseSection | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(true);
  const leadership = user?.role === "head_of_institution" || user?.role === "group_principal" || user?.role === "super_admin" || user?.role === "secretary";
  const schoolId = user?.school_id;

  useEffect(() => {
    if (!token || !schoolId || !leadership) return;
    let live = true;
    api
      .getPulse(token, schoolId, dept)
      .then((s) => {
        if (live) setSection(s);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [token, schoolId, leadership, dept]);

  if (!leadership || failed) return null;
  if (!section) return <div className="h-28 animate-pulse rounded-xl border bg-muted/40" aria-hidden />;

  const hasAttention = section.attention.length > 0;
  return (
    <section aria-label={`${section.title} this week`} className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
      >
        {hasAttention ? <CircleAlert className="size-5 shrink-0 text-amber-600" aria-hidden /> : <CircleCheck className="size-5 shrink-0 text-emerald-600" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">This week at a glance</span>
          <span className="block font-heading text-base leading-snug font-semibold break-words sm:text-lg">{section.summary}</span>
        </span>
        {collapsible && <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />}
      </button>
      {open && (
        <div className="border-t">
          <div className="overflow-hidden"><dl className="-mr-px -mb-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]">
            {section.tiles.map((t) => (
              <div key={t.label} className="min-w-0 border-r border-b px-4 py-3">
                <dt className="truncate text-xs text-muted-foreground">{t.label}</dt>
                <dd className={`mt-0.5 truncate font-heading text-xl font-semibold tabular-nums ${TONE_TEXT[t.tone]}`} title={t.value}>{t.value}</dd>
                {t.hint && <p className="truncate text-xs text-muted-foreground" title={t.hint}>{t.hint}</p>}
              </div>
            ))}
          </dl></div>
          {hasAttention && (
            <ul className="divide-y border-t">
              {section.attention.map((a, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm sm:px-5">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.tone === "bad" ? "bg-red-500" : "bg-amber-500"}`} aria-hidden />
                  <span className="min-w-0 flex-1 break-words">{a.text}</span>
                  {a.href && (
                    <Link href={a.href} className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                      Open <ChevronRight className="size-3.5" aria-hidden />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
