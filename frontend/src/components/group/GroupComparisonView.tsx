"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, Crown, LayoutGrid, Table2, TriangleAlert } from "lucide-react";
import { api, GroupColumn, GroupComparison } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CARDS, fallbackCard, MODULE_ICON, NotInUse, PRIMARY } from "@/components/group/GroupModuleCards";
import { formatValue, GroupLoader, schoolColor, useGroupMode, useOpenSchool } from "@/components/group/GroupUi";
import { ErrorBox } from "@/components/oversight";
import { Button } from "@/components/ui/button";

const MEDAL = ["#D4A017", "#94A3B8", "#B45309"];

/** One area, every attached school side by side. Each area is drawn the way its figures read best (rings, bars, a funnel...), with the exact numbers one tap away in the table view. */
export function GroupComparisonView({ moduleKey }: { moduleKey: string }) {
  const { token } = useAuth();
  const { ready } = useGroupMode();
  const openSchool = useOpenSchool();
  const [state, setState] = useState<{ key: string; value: GroupComparison | null } | null>(null);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token || !ready) return;
    let cancelled = false;
    api.getGroupComparison(token, moduleKey).then((value) => !cancelled && setState({ key: moduleKey, value })).catch(() => !cancelled && setState({ key: moduleKey, value: null }));
    return () => {
      cancelled = true;
    };
  }, [token, ready, moduleKey, version]);

  const data = state && state.key === moduleKey ? state.value : undefined;
  const primary = PRIMARY[moduleKey];

  // Rank the schools on the one figure that fairly ranks them, when this area has one.
  const ranked = useMemo(() => {
    const rows = (data?.rows ?? []).map((r, i) => ({ row: r, index: i }));
    if (!primary) return { list: rows, rank: new Map<number, number>() };
    const have = rows.filter((r) => r.row.enabled && r.row.values[primary.key] != null);
    const sorted = [...have].sort((a, b) => (primary.better === "high" ? 1 : -1) * ((b.row.values[primary.key] as number) - (a.row.values[primary.key] as number)));
    const rank = new Map<number, number>();
    sorted.forEach((r, i) => rank.set(r.row.school_id, i + 1));
    const rest = rows.filter((r) => !rank.has(r.row.school_id));
    return { list: [...sorted, ...rest], rank };
  }, [data, primary]);

  const tableRows = useMemo(() => {
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

  if (data === undefined) return <GroupLoader label="Comparing your schools..." />;
  if (data === null) return <ErrorBox message="We couldn't load this comparison just now." onRetry={() => { setState(null); setVersion((v) => v + 1); }} />;

  const Icon = MODULE_ICON[moduleKey] ?? LayoutGrid;
  const headline = data.columns.slice(0, 4);
  const colorOf = (id: number) => schoolColor(data.rows.findIndex((r) => r.school_id === id));
  const draw = CARDS[moduleKey] ?? fallbackCard;
  const mark = (col: GroupColumn, schoolId: number) => {
    const m = data.marks[col.key];
    return !m ? null : m.best === String(schoolId) ? "best" : m.weakest === String(schoolId) ? "weakest" : null;
  };
  const toggleSort = (key: string) => setSort((s) => (s?.key === key ? (s.dir === "desc" ? { key, dir: "asc" } : null) : { key, dir: "desc" }));

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* The banner: what this area is, and the group's own figures. */}
      <header className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm sm:p-7" style={{ background: "linear-gradient(120deg, #5e1114 0%, #8B1A1D 55%, #b3382b 100%)" }}>
        <Icon className="pointer-events-none absolute -top-4 -right-4 size-36 text-white/10 sm:size-48" aria-hidden />
        <span className="pointer-events-none absolute -bottom-16 left-1/3 size-48 rounded-full bg-white/5" aria-hidden />
        <div className="relative flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">All Schools</p>
            <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{data.title}</h1>
            <p className="mt-1 max-w-xl text-sm text-white/80">{data.blurb}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {headline.map((c) => (
              <div key={c.key} className="min-w-0">
                <dd className="font-heading text-2xl leading-none font-semibold tabular-nums sm:text-3xl">{formatValue(data.group[c.key], c.kind)}</dd>
                <dt className="mt-1 text-xs text-white/75">{c.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{primary && ranked.rank.size > 1 ? <>Ranked by <strong className="font-semibold text-foreground">{primary.label}</strong>.</> : <>{data.rows.length} school{data.rows.length === 1 ? "" : "s"} side by side.</>}</p>
        <div role="group" aria-label="How to show the schools" className="inline-flex rounded-lg border bg-card p-0.5">
          {([["cards", "Cards", LayoutGrid], ["table", "Table", Table2]] as const).map(([k, label, I]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><I className="size-4" aria-hidden />{label}</button>
          ))}
        </div>
      </div>

      {view === "cards" ? (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {ranked.list.map(({ row }) => {
            const rank = ranked.rank.get(row.school_id);
            const color = colorOf(row.school_id);
            return (
              <li key={row.school_id} className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md">
                <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} aria-hidden />
                <div className="flex items-start justify-between gap-3 pl-1.5">
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg leading-tight font-semibold break-words">{row.school_name}</h2>
                    {!row.enabled && <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Not in use</span>}
                  </div>
                  {rank && ranked.rank.size > 1 && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: rank <= 3 ? MEDAL[rank - 1] : "#64748B" }} title={`Number ${rank} of ${ranked.rank.size} on ${primary.label}`}>
                      {rank === 1 && <Crown className="size-3.5" aria-hidden />} #{rank}
                    </span>
                  )}
                </div>
                <div className="pl-1.5">{row.enabled ? draw({ row, color, group: data.group, columns: data.columns }) : NotInUse}</div>
                <Button variant="outline" className="mt-auto ml-1.5 h-10 justify-between" onClick={() => openSchool(row.school_id, data.href)}>Open {row.school_name}<ArrowUpRight /></Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <section className="relative overflow-hidden rounded-xl border bg-card" aria-label="School by school">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-5 py-3">School</th>
                  {data.columns.map((c) => {
                    const active = sort?.key === c.key;
                    const I = !active ? ArrowUpDown : sort.dir === "desc" ? ArrowDown : ArrowUp;
                    return (
                      <th key={c.key} scope="col" className="px-3 py-3 text-right" aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}>
                        <button type="button" onClick={() => toggleSort(c.key)} title={c.hint ?? undefined} className="ml-auto inline-flex items-center gap-1 text-right uppercase hover:text-foreground focus-visible:underline">{c.label}<I className={`size-3 shrink-0 ${active ? "text-primary" : "opacity-50"}`} aria-hidden /></button>
                      </th>
                    );
                  })}
                  <th scope="col" className="px-5 py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tableRows.map((r) => (
                  <tr key={r.school_id} className={r.enabled ? "" : "bg-muted/30 text-muted-foreground"}>
                    <th scope="row" className="px-5 py-3.5 text-left font-medium break-words"><span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: colorOf(r.school_id) }} aria-hidden />{r.school_name}{!r.enabled && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">Not in use</span>}</th>
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
          {Object.keys(data.marks).length > 0 && <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-5 py-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Crown className="size-3.5 text-emerald-600" aria-hidden /> best in this column</span><span className="inline-flex items-center gap-1"><TriangleAlert className="size-3.5 text-red-600" aria-hidden /> needs the most attention</span></p>}
        </section>
      )}
    </div>
  );
}
