"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Pencil, Plus, Sparkles, Trash2, UtensilsCrossed } from "lucide-react";
import { api, ApiError, MenuSlot } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHead, Pill } from "@/components/oversight";
import { PendingApprovals } from "@/components/PendingApprovals";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hhmm = (t: string) => t.slice(0, 5);
const SETTERS = ["head_of_institution", "group_principal", "super_admin", "staff", "secretary"];
const todayIndex = () => (new Date().getDay() + 6) % 7;

function normalise(slots: MenuSlot[]): MenuSlot[] {
  return slots.map((s) => ({ ...s, start_time: hhmm(s.start_time), end_time: hhmm(s.end_time), items: { ...s.items } }));
}

function Today({ slots }: { slots: MenuSlot[] }) {
  const d = todayIndex();
  const served = slots.filter((s) => s.items[String(d)]);
  return (
    <section className="rounded-xl border bg-card" aria-label="Today's meals">
      <h2 className="flex items-center gap-2 border-b px-4 py-3 font-heading text-lg font-semibold"><UtensilsCrossed className="size-4.5 text-primary" aria-hidden /> Today, {DAYS[d]}</h2>
      {served.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No meals are listed for today.</p>
      ) : (
        <ul className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {served.map((s) => (
            <li key={s.id ?? s.name} className="flex flex-col gap-1 px-4 py-3 sm:border-r sm:last:border-r-0">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><Clock className="size-3" aria-hidden />{hhmm(s.start_time)}–{hhmm(s.end_time)}{s.audience === "boarders" && " · boarders"}</span>
              <span className="text-sm font-medium">{s.name}</span>
              <span className="text-sm break-words">{s.items[String(d)]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Grid({ slots, days }: { slots: MenuSlot[]; days: number[] }) {
  const today = todayIndex();
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <th scope="col" className="w-40 px-4 py-2.5">Meal</th>
            {days.map((d) => <th key={d} scope="col" className={`px-3 py-2.5 ${d === today ? "text-primary" : ""}`}>{SHORT[d]}{d === today && " · today"}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {slots.map((s) => (
            <tr key={s.id ?? s.name} className="align-top">
              <th scope="row" className="px-4 py-3 text-left font-normal"><span className="block font-medium">{s.name}</span><span className="block text-xs text-muted-foreground tabular-nums">{hhmm(s.start_time)}–{hhmm(s.end_time)}</span>{s.audience === "boarders" && <Pill tone="info">Boarders</Pill>}</th>
              {days.map((d) => <td key={d} className={`px-3 py-3 break-words ${d === today ? "bg-primary/5" : ""}`}>{s.items[String(d)] || <span className="text-muted-foreground/60">—</span>}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Editor({ initial, schoolId, canApply, onDone, onCancel }: { initial: MenuSlot[]; schoolId: number; canApply: boolean; onDone: () => void; onCancel: () => void }) {
  const { token } = useAuth();
  const [slots, setSlots] = useState<MenuSlot[]>(() => normalise(initial));
  const [weekend, setWeekend] = useState(() => initial.some((s) => s.items["5"] || s.items["6"]));
  const [busy, setBusy] = useState(false);
  const days = weekend ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];

  const edit = (i: number, patch: Partial<MenuSlot>) => setSlots((all) => all.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const setItem = (i: number, d: number, text: string) => setSlots((all) => all.map((s, n) => (n === i ? { ...s, items: { ...s.items, [String(d)]: text } } : s)));

  async function template() {
    if (!token) return;
    try {
      setSlots(normalise(await api.getMenuTemplate(token, schoolId)));
    } catch {
      toast.error("We couldn't load the suggested meal times.");
    }
  }

  async function save() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await api.saveWeeklyMenu(token, schoolId, slots);
      toast.success(res.message);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save the menu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="h-10" onClick={template}><Sparkles /> Suggest meal times</Button>
        <Button variant="outline" className="h-10" onClick={() => setSlots((s) => [...s, { name: "", start_time: "12:00", end_time: "12:30", audience: "all", items: {} }])}><Plus /> Add a meal</Button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={weekend} onChange={(e) => setWeekend(e.target.checked)} className="size-4 accent-[var(--primary)]" /> Include weekends</label>
      </div>
      {slots.length === 0 && <p className="rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">Start from suggested meal times, or add your first meal.</p>}
      {slots.map((s, i) => (
        <section key={i} className="overflow-hidden rounded-xl border bg-card">
          <header className="grid gap-2 border-b bg-muted/30 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_7rem_7rem_9rem_2.25rem] md:items-center">
            <Input value={s.name} onChange={(e) => edit(i, { name: e.target.value })} placeholder="Meal, e.g. Lunch" aria-label="Meal name" className="h-10" />
            <Input type="time" value={s.start_time} onChange={(e) => edit(i, { start_time: e.target.value })} aria-label="Starts" className="h-10" />
            <Input type="time" value={s.end_time} onChange={(e) => edit(i, { end_time: e.target.value })} aria-label="Ends" className="h-10" />
            <select value={s.audience} onChange={(e) => edit(i, { audience: e.target.value as MenuSlot["audience"] })} aria-label="Who is served" className="h-10 rounded-lg border bg-background px-2 text-sm"><option value="all">Everyone</option><option value="boarders">Boarders only</option></select>
            <Button variant="ghost" size="icon" className="size-9" aria-label={`Remove ${s.name || "meal"}`} onClick={() => setSlots((all) => all.filter((_, n) => n !== i))}><Trash2 /></Button>
          </header>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
            {days.map((d) => (
              <label key={d} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{DAYS[d]}<Textarea rows={2} value={s.items[String(d)] ?? ""} onChange={(e) => setItem(i, d, e.target.value)} placeholder="What is served" className="text-sm text-foreground" /></label>
            ))}
          </div>
        </section>
      ))}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {!canApply && <span className="text-xs text-muted-foreground sm:mr-auto">This goes to the head of institution for approval before it changes anything.</span>}
        <Button variant="outline" className="h-11 sm:h-10" onClick={onCancel}>Cancel</Button>
        <Button className="h-11 sm:h-10" disabled={busy || slots.some((s) => !s.name.trim())} onClick={save}>{busy && <Spinner size={16} className="text-current" />} {canApply ? "Save menu" : "Send for approval"}</Button>
      </div>
    </div>
  );
}

export default function MealsPage() {
  const { user, token } = useAuth();
  const schoolId = user?.school_id ?? null;
  const [slots, setSlots] = useState<MenuSlot[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(0);
  const canSet = !!user && SETTERS.includes(user.role);
  const canApply = !!user && ["head_of_institution", "group_principal", "super_admin"].includes(user.role);

  useEffect(() => {
    if (!token || !schoolId) return;
    let cancelled = false;
    api.getWeeklyMenu(token, schoolId).then((m) => !cancelled && setSlots(m.slots)).catch(() => !cancelled && setSlots([]));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, version]);

  const days = useMemo(() => ((slots ?? []).some((s) => s.items["5"] || s.items["6"]) ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4]), [slots]);
  if (!user || !schoolId || !slots) return <PageLoader />;

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHead title="Meals" subtitle="The weekly menu and meal times. The same week repeats until it is changed.">
        {canSet && !editing && <Button className="h-10 sm:h-9" onClick={() => setEditing(true)}><Pencil /> {slots.length ? "Edit menu" : "Set up the menu"}</Button>}
      </PageHead>
      {canSet && <PendingApprovals kind="meal_menu" schoolId={schoolId} onDecided={() => setVersion((v) => v + 1)} />}
      {editing ? (
        <Editor initial={slots} schoolId={schoolId} canApply={canApply} onCancel={() => setEditing(false)} onDone={() => { setEditing(false); setVersion((v) => v + 1); }} />
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-14 text-center"><UtensilsCrossed className="size-6 text-muted-foreground" aria-hidden /><p className="text-sm text-muted-foreground">{canSet ? "No menu yet. Set the meal times and what is served each day." : "The school has not published a menu yet."}</p></div>
      ) : (
        <>
          <Today slots={slots} />
          <Grid slots={slots} days={days} />
        </>
      )}
    </div>
  );
}
