"use client";

import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { api, FinanceActivity } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDaysStr, localDateStr } from "@/lib/dates";
import { Initials, PageHead, Pill, ViewOnly } from "@/components/oversight";
import { PageLoader } from "@/components/Spinner";
import { Input } from "@/components/ui/input";

const ROLE_LABEL: Record<string, string> = { bursar: "Bursar", accountant: "Accountant", procurement_officer: "Procurement officer", store_keeper: "Store keeper", staff: "Staff", head_of_institution: "Head of institution", group_principal: "Group principal", super_admin: "Administrator" };
const KIND_LABEL: Record<string, string> = { payment: "Payment", expense: "Expense", approval: "Approval", journal: "Journal", requisition: "Purchase request", order: "Purchase order", stock: "Stock", store_request: "Store request" };
const KIND_TONE: Record<string, "good" | "warn" | "info" | "brand" | "muted"> = { payment: "good", expense: "warn", approval: "brand", journal: "info", requisition: "muted", order: "info", stock: "info", store_request: "muted" };
const kes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function FinanceActivityPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const schoolId = user?.school_id ?? null;
  const today = localDateStr();
  const [start, setStart] = useState(addDaysStr(today, -6));
  const [end, setEnd] = useState(today);
  const [actor, setActor] = useState<number | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ key: string; value: FinanceActivity | null } | null>(null);
  const key = `${start}|${end}|${actor ?? ""}`;

  useEffect(() => {
    if (!loading && user && !["head_of_institution", "group_principal", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    api.getFinanceActivity(token, schoolId, { start, end, actor_id: actor ?? undefined }).then((value) => !cancelled && setData({ key, value })).catch(() => !cancelled && setData({ key, value: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, start, end, actor, key]);

  const ready = data && data.key === key ? data.value : undefined;
  const q = query.trim().toLowerCase();
  const events = (ready?.events ?? []).filter((e) => (!kind || e.kind === kind) && (!q || `${e.title} ${e.detail} ${e.actor ?? ""}`.toLowerCase().includes(q)));
  const kinds = [...new Set((ready?.events ?? []).map((e) => e.kind))];
  const preset = (days: number) => { setStart(addDaysStr(today, -days)); setEnd(today); };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHead title="Finance desk activity" subtitle="Everything the bursar, accountant, procurement officer and store keeper did, person by person." />
      <ViewOnly label="Oversight">These desks keep the records. You see every action here, and you can still record an item yourself from Fees, Finance, Procurement or Stores when you need to.</ViewOnly>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">From<Input type="date" value={start} max={end} onChange={(e) => e.target.value && setStart(e.target.value)} className="h-10 w-40" /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">To<Input type="date" value={end} min={start} max={today} onChange={(e) => e.target.value && setEnd(e.target.value)} className="h-10 w-40" /></label>
        <div className="flex gap-1.5">
          {[["Today", 0], ["7 days", 6], ["30 days", 29]].map(([label, d]) => <button key={label} type="button" onClick={() => preset(d as number)} className="h-10 rounded-full border px-3.5 text-sm font-medium hover:bg-accent">{label}</button>)}
        </div>
        <div className="relative sm:w-64"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the activity..." aria-label="Search" className="h-10 pl-8" /></div>
      </div>

      {ready === undefined ? (
        <PageLoader />
      ) : ready === null ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">We couldn&apos;t load the activity.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
            <div className="rounded-xl border bg-card p-3.5"><p className="text-sm text-muted-foreground">Fees received</p><p className="font-heading text-2xl font-semibold tabular-nums">{kes(ready.totals.payment ?? 0)}</p></div>
            <div className="rounded-xl border bg-card p-3.5"><p className="text-sm text-muted-foreground">Expenses recorded</p><p className="font-heading text-2xl font-semibold tabular-nums">{kes(ready.totals.expense ?? 0)}</p></div>
            <div className="rounded-xl border bg-card p-3.5"><p className="text-sm text-muted-foreground">People active</p><p className="font-heading text-2xl font-semibold tabular-nums">{ready.people.length}</p></div>
            <div className="rounded-xl border bg-card p-3.5"><p className="text-sm text-muted-foreground">Actions</p><p className="font-heading text-2xl font-semibold tabular-nums">{ready.events.length}</p></div>
          </section>

          <div className="grid items-start gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-xl border bg-card" aria-label="People">
              <h2 className="border-b px-4 py-3 font-heading text-base font-semibold">By person</h2>
              <ul className="divide-y">
                <li><button type="button" onClick={() => setActor(null)} aria-pressed={actor === null} className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${actor === null ? "bg-primary/5 font-medium" : "hover:bg-accent/40"}`}>Everyone</button></li>
                {ready.people.map((p) => (
                  <li key={p.user_id}>
                    <button type="button" onClick={() => setActor(actor === p.user_id ? null : p.user_id)} aria-pressed={actor === p.user_id} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${actor === p.user_id ? "bg-primary/5" : "hover:bg-accent/40"}`}>
                      <Initials name={p.name} seed={p.user_id} size="sm" />
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium break-words">{p.name}</span><span className="block text-xs text-muted-foreground">{ROLE_LABEL[p.role] ?? p.role} · {p.actions} action{p.actions === 1 ? "" : "s"}{p.amount ? ` · ${kes(p.amount)}` : ""}</span></span>
                    </button>
                  </li>
                ))}
                {ready.people.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No one recorded anything in this period.</li>}
              </ul>
            </aside>

            <section className="overflow-hidden rounded-xl border bg-card" aria-label="Activity">
              <div className="flex flex-wrap gap-1.5 border-b px-4 py-3" role="group" aria-label="Filter by kind">
                <button type="button" aria-pressed={kind === null} onClick={() => setKind(null)} className={`h-8 rounded-full border px-3 text-xs font-medium ${kind === null ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>All</button>
                {kinds.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)} className={`h-8 rounded-full border px-3 text-xs font-medium ${kind === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>{KIND_LABEL[k] ?? k}</button>)}
              </div>
              {events.length === 0 ? (
                <EmptyNote>Nothing matches.</EmptyNote>
              ) : (
                <ul className="divide-y">
                  {events.map((e, i) => (
                    <li key={i}>
                      <Link href={e.href} className="flex items-start gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40">
                        <span className="w-28 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">{when(e.at)}</span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium break-words">{e.title}</span><span className="block text-xs break-words text-muted-foreground">{[e.detail, e.actor ? `by ${e.actor}${e.role ? ` (${ROLE_LABEL[e.role] ?? e.role})` : ""}` : "by the system"].filter(Boolean).join(" · ")}</span></span>
                        <span className="hidden shrink-0 sm:block"><Pill tone={KIND_TONE[e.kind] ?? "muted"}>{KIND_LABEL[e.kind] ?? e.kind}</Pill></span>
                        {e.amount != null && <span className="shrink-0 text-sm font-semibold tabular-nums">{kes(e.amount)}</span>}
                        <ChevronRight className="mt-1 hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
