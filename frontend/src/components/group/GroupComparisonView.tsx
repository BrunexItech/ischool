"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, Crown, TriangleAlert } from "lucide-react";
import { api, GroupColumn, GroupComparison, GroupModuleInfo } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatValue, GroupSkeleton, useGroupMode, useOpenSchool } from "@/components/group/GroupUi";
import { ErrorBox } from "@/components/oversight";
import { Button } from "@/components/ui/button";

/** One module, every attached school side by side, with the group total. Best and weakest school are marked on every column that has a clear "good" direction. */
export function GroupComparisonView({ moduleKey }: { moduleKey: string }) {
  const { token } = useAuth();
  const { ready } = useGroupMode();
  const openSchool = useOpenSchool();
  const [state, setState] = useState<{ key: string; value: GroupComparison | null } | null>(null);
  const [modules, setModules] = useState<GroupModuleInfo[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token || !ready) return;
    let cancelled = false;
    api.getGroupComparison(token, moduleKey).then((value) => !cancelled && setState({ key: moduleKey, value })).catch(() => !cancelled && setState({ key: moduleKey, value: null }));
    api.listGroupModules(token).then((m) => !cancelled && setModules(m)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, ready, moduleKey, version]);

  const data = state && state.key === moduleKey ? state.value : undefined;
  const rows = useMemo(() => {
    const list = [...(data?.rows ?? [])];
    if (sort) {
      list.sort((a, b) => {
        const x = a.values[sort.key];
        const y = b.values[sort.key];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return sort.dir === "asc" ? x - y : y - x;
      });
    }
    return list;
  }, [data, sort]);

  if (data === undefined) return <GroupSkeleton rows={3} />;
  if (data === null) return <ErrorBox message="We couldn't load this comparison just now." onRetry={() => { setState(null); setVersion((v) => v + 1); }} />;

  const headline = data.columns.slice(0, 4);
  const mark = (col: GroupColumn, schoolId: number) => {
    const m = data.marks[col.key];
    if (!m) return null;
    if (m.best === String(schoolId)) return "best";
    if (m.weakest === String(schoolId)) return "weakest";
    return null;
  };
  const toggleSort = (key: string) => setSort((s) => (s?.key === key ? (s.dir === "desc" ? { key, dir: "asc" } : null) : { key, dir: "desc" }));

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">Compare schools</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{data.title}</h1>
        <p className="text-sm text-muted-foreground">{data.blurb}</p>
      </header>

      <nav aria-label="Other comparisons" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
          {modules.map((m) => (
            <li key={m.key}><Link href={`/dashboard/group/${m.key}`} aria-current={m.key === moduleKey ? "page" : undefined} className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors ${m.key === moduleKey ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{m.title}</Link></li>
          ))}
        </ul>
      </nav>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="All schools together">
        {headline.map((c) => (
          <div key={c.key} className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs">
            <span className="absolute inset-x-0 top-0 h-1 bg-primary/70" aria-hidden />
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="font-heading text-2xl leading-tight font-semibold tabular-nums sm:text-3xl">{formatValue(data.group[c.key], c.kind)}</p>
            <p className="text-xs text-muted-foreground">all schools together</p>
          </div>
        ))}
      </section>

      {/* Wide screens: a table to read across. */}
      <section className="relative hidden overflow-hidden rounded-xl border bg-card md:block" aria-label="School by school">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <th scope="col" className="px-5 py-3">School</th>
                {data.columns.map((c) => {
                  const active = sort?.key === c.key;
                  const Icon = !active ? ArrowUpDown : sort.dir === "desc" ? ArrowDown : ArrowUp;
                  return (
                    <th key={c.key} scope="col" className="px-3 py-3 text-right" aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}>
                      <button type="button" onClick={() => toggleSort(c.key)} title={c.hint ?? undefined} className="ml-auto inline-flex items-center gap-1 text-right uppercase hover:text-foreground focus-visible:underline">{c.label}<Icon className={`size-3 shrink-0 ${active ? "text-primary" : "opacity-50"}`} aria-hidden /></button>
                    </th>
                  );
                })}
                <th scope="col" className="px-5 py-3"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.school_id} className={r.enabled ? "" : "bg-muted/30 text-muted-foreground"}>
                  <th scope="row" className="px-5 py-3.5 text-left font-medium break-words">{r.school_name}{!r.enabled && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">Not in use</span>}</th>
                  {data.columns.map((c) => {
                    const m = r.enabled ? mark(c, r.school_id) : null;
                    return (
                      <td key={c.key} className={`px-3 py-3.5 text-right tabular-nums ${m === "best" ? "font-semibold text-emerald-700 dark:text-emerald-400" : m === "weakest" ? "font-semibold text-red-700 dark:text-red-400" : ""}`}>
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {m === "best" && <Crown className="size-3.5" aria-label="Best" />}
                          {m === "weakest" && <TriangleAlert className="size-3.5" aria-label="Needs the most attention" />}
                          {r.enabled ? formatValue(r.values[c.key], c.kind) : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-5 py-3.5 text-right"><Button variant="ghost" size="sm" className="h-8" onClick={() => openSchool(r.school_id, data.href)}>Open <ArrowUpRight /></Button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <th scope="row" className="px-5 py-3.5 text-left">All schools</th>
                {data.columns.map((c) => <td key={c.key} className="px-3 py-3.5 text-right tabular-nums">{formatValue(data.group[c.key], c.kind)}</td>)}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Phones: one card per school. */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label="School by school">
        {rows.map((r) => (
          <li key={r.school_id} className={`rounded-xl border bg-card p-4 shadow-xs ${r.enabled ? "" : "opacity-70"}`}>
            <div className="mb-3 flex items-start justify-between gap-2"><h2 className="font-heading text-base font-semibold break-words">{r.school_name}</h2>{!r.enabled && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">Not in use</span>}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {data.columns.map((c) => {
                const m = r.enabled ? mark(c, r.school_id) : null;
                return (
                  <div key={c.key}>
                    <dt className="text-xs text-muted-foreground">{c.label}</dt>
                    <dd className={`flex items-center gap-1 text-base font-semibold tabular-nums ${m === "best" ? "text-emerald-700 dark:text-emerald-400" : m === "weakest" ? "text-red-700 dark:text-red-400" : ""}`}>
                      {m === "best" && <Crown className="size-3.5" aria-label="Best" />}
                      {m === "weakest" && <TriangleAlert className="size-3.5" aria-label="Needs the most attention" />}
                      {r.enabled ? formatValue(r.values[c.key], c.kind) : "—"}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <Button variant="outline" className="mt-4 h-10 w-full justify-between" onClick={() => openSchool(r.school_id, data.href)}>Open this school <ArrowUpRight /></Button>
          </li>
        ))}
        <li className="rounded-xl border-2 bg-muted/40 p-4">
          <h2 className="mb-3 font-heading text-base font-semibold">All schools</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{data.columns.map((c) => <div key={c.key}><dt className="text-xs text-muted-foreground">{c.label}</dt><dd className="text-base font-semibold tabular-nums">{formatValue(data.group[c.key], c.kind)}</dd></div>)}</dl>
        </li>
      </ul>

      {Object.keys(data.marks).length > 0 && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Crown className="size-3.5 text-emerald-600" aria-hidden /> best in this column</span><span className="inline-flex items-center gap-1"><TriangleAlert className="size-3.5 text-red-600" aria-hidden /> needs the most attention</span></p>
      )}
    </div>
  );
}
