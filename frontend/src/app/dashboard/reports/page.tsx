"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarCheck, ChevronRight, Mail, Printer } from "lucide-react";
import { toast } from "sonner";
import { api, PulseSection, WeeklyReport } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ErrorBox, PageHead } from "@/components/oversight";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";

const TONE_TEXT: Record<string, string> = {
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
  neutral: "",
};

function fmt(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function SectionCard({ s }: { s: PulseSection }) {
  return (
    <section className="print-avoid-break flex min-w-0 flex-col rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold">{s.title}</h3>
          <p className="text-sm text-muted-foreground">{s.summary}</p>
        </div>
        <Link href={s.href} className="no-print inline-flex shrink-0 items-center gap-0.5 pt-1 text-xs font-medium text-primary hover:underline">
          Open <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3">
        {s.tiles.map((t) => (
          <div key={t.label} className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground">{t.label}</dt>
            <dd className={`truncate text-sm font-semibold tabular-nums ${TONE_TEXT[t.tone]}`} title={t.value}>{t.value}</dd>
          </div>
        ))}
      </dl>
      {s.attention.length > 0 && (
        <ul className="divide-y border-t">
          {s.attention.map((a, i) => (
            <li key={i} className="flex items-start gap-2.5 px-4 py-2 text-sm">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.tone === "bad" ? "bg-red-500" : "bg-amber-500"}`} aria-hidden />
              <span className="min-w-0 break-words">{a.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [emailing, setEmailing] = useState(false);
  const allowed = user?.role === "head_of_institution" || user?.role === "group_principal" || user?.role === "super_admin";
  const schoolId = user?.school_id;

  useEffect(() => {
    if (!loading && user && !allowed) router.replace("/dashboard");
  }, [loading, user, allowed, router]);

  useEffect(() => {
    if (!token || !schoolId || !allowed) return;
    let live = true;
    api
      .getWeeklyReport(token, schoolId)
      .then((r) => {
        if (live) {
          setReport(r);
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [token, schoolId, allowed, reloadKey]);

  async function emailMe() {
    if (!token || !schoolId) return;
    setEmailing(true);
    try {
      const r = await api.emailWeeklyReport(token, schoolId);
      if (r.sent) toast.success(`Sent to ${user?.email}`);
      else toast.error("Email is not set up for this school yet, so nothing was sent.");
    } catch {
      toast.error("We couldn't send the report. Please try again.");
    } finally {
      setEmailing(false);
    }
  }

  if (loading || !user || !allowed) return <PageLoader />;
  if (failed) return <ErrorBox message="We couldn't build the report." onRetry={() => { setFailed(false); setReport(null); setReloadKey((k) => k + 1); }} />;
  if (!report) return <PageLoader label="Putting the week together..." />;

  const needs = report.sections.flatMap((s) => s.attention.map((a) => ({ section: s.title, ...a }))).sort((a, b) => (a.tone === "bad" ? 0 : 1) - (b.tone === "bad" ? 0 : 1));

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        title="Weekly report"
        subtitle={`${report.school_name} · ${fmt(report.week_start)} to ${fmt(report.week_end)}${report.term ? ` · ${report.term}` : ""}`}
      >
        <span className="no-print flex flex-wrap gap-2">
          <Button variant="outline" onClick={emailMe} disabled={emailing} className="h-10 sm:h-9"><Mail /> Email me this report</Button>
          <Button variant="outline" onClick={() => window.print()} className="h-10 sm:h-9"><Printer /> Print or save as PDF</Button>
        </span>
      </PageHead>

      <p className="no-print flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <CalendarCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        This report is emailed to you automatically every Saturday morning, so you have it even if you have not opened the system.
      </p>

      <section className={`print-avoid-break rounded-xl border p-4 sm:p-5 ${needs.length ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"}`}>
        <h2 className="font-heading text-lg font-semibold">{report.headline}</h2>
        {needs.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {needs.map((n, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.tone === "bad" ? "bg-red-500" : "bg-amber-500"}`} aria-hidden />
                <span className="min-w-0 flex-1 break-words">
                  <span className="mr-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{n.section}</span>
                  {n.text}
                </span>
                {n.href && (
                  <Link href={n.href} className="no-print shrink-0 text-xs font-medium text-primary hover:underline">Open</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {report.sections.map((s) => <SectionCard key={s.key} s={s} />)}
      </div>
    </div>
  );
}
