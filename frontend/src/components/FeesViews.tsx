"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MessageSquareText, Printer, Receipt, Search } from "lucide-react";
import { AcademicTerm, api, ApiError, FeeBalances, FeeStructure, GradeLevel, SchoolClass } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Pill } from "@/components/oversight";
import { PendingApprovals } from "@/components/PendingApprovals";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const kes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;
const CATEGORIES = [["tuition", "Tuition"], ["boarding", "Boarding"], ["transport", "Transport"], ["meals", "Meals"], ["activities", "Activities"], ["uniform", "Uniform"], ["other", "Other"]] as const;
const DESK = ["head_of_institution", "group_principal", "super_admin", "bursar", "accountant"];
const DEFAULT_MESSAGE = "Dear {guardian}, {student} has a fee balance of KES {owed} at {school}. Please clear it at your earliest convenience. Thank you.";

/* ---------- Fee structure ---------- */

export function StructureView({ schoolId, terms, grades }: { schoolId: number; terms: AcademicTerm[]; grades: GradeLevel[] }) {
  const { token, user } = useAuth();
  const [term, setTerm] = useState(() => (terms.find((t) => t.is_current) ?? terms[0])?.name ?? "");
  const [data, setData] = useState<{ term: string; value: FeeStructure | null } | null>(null);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [loadedFor, setLoadedFor] = useState("");
  const [busy, setBusy] = useState<"save" | "bill" | null>(null);
  const [version, setVersion] = useState(0);
  const [extra, setExtra] = useState<string[]>([]);
  const isDesk = !!user && DESK.includes(user.role);

  useEffect(() => {
    if (!token || !term) return;
    let cancelled = false;
    api
      .getFeeStructure(token, schoolId, term)
      .then((value) => {
        if (cancelled) return;
        setData({ term, value });
        const next: Record<string, string> = {};
        for (const l of value.lines) next[`${l.grade_level_id}:${l.category}`] = String(l.amount);
        setCells(next);
        setLoadedFor(term);
        setExtra(CATEGORIES.map(([k]) => k).filter((k) => value.lines.some((l) => l.category === k)).concat(value.lines.length === 0 ? ["tuition"] : []));
      })
      .catch(() => !cancelled && setData({ term, value: null }));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, term, version]);

  const columns = useMemo(() => Array.from(new Set(extra)), [extra]);
  const relevant = grades.filter((g) => (data?.value?.learners_by_grade[String(g.id)] ?? 0) > 0 || data?.value?.lines.some((l) => l.grade_level_id === g.id));
  const rows = relevant.length > 0 ? relevant : grades;
  const learnersIn = (id: number) => data?.value?.learners_by_grade[String(id)] ?? 0;

  async function save() {
    if (!token) return;
    setBusy("save");
    try {
      const lines = Object.entries(cells)
        .filter(([, v]) => v !== "" && Number(v) > 0)
        .map(([k, v]) => ({ grade_level_id: Number(k.split(":")[0]), category: k.split(":")[1], amount: Number(v) }));
      const res = await api.saveFeeStructure(token, schoolId, term, lines);
      toast.success(res.message);
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save the fees.");
    } finally {
      setBusy(null);
    }
  }

  async function bill() {
    if (!token) return;
    setBusy("bill");
    try {
      const r = await api.generateInvoices(token, schoolId, term);
      toast.success(r.created ? `Billed ${r.created} fee lines, ${kes(r.total_billed)} in all` : "Everyone is already billed for this term");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't bill the learners.");
    } finally {
      setBusy(null);
    }
  }

  if (terms.length === 0) return <p className="rounded-xl border border-dashed bg-card px-4 py-12 text-center text-sm text-muted-foreground">Set up a term under Academic Terms first. Fees are set for each term.</p>;
  const total = Object.entries(cells).reduce((n, [k, v]) => n + (Number(v) || 0) * learnersIn(Number(k.split(":")[0])), 0);

  return (
    <div className="flex flex-col gap-4">
      <PendingApprovals kind="fee_structure" schoolId={schoolId} onDecided={() => setVersion((v) => v + 1)} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Term
          <select value={term} onChange={(e) => setTerm(e.target.value)} className="h-10 min-w-44 rounded-lg border bg-background px-3 text-sm text-foreground">{terms.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fees charged">
          {CATEGORIES.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={columns.includes(k)} onClick={() => setExtra((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))} className={`h-9 rounded-full border px-3 text-sm font-medium ${columns.includes(k) ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
      </div>

      {!data || loadedFor !== term ? (
        <PageLoader />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[34rem] text-sm">
              <thead><tr className="border-b bg-muted/50 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"><th scope="col" className="px-4 py-2.5">Grade</th><th scope="col" className="px-3 py-2.5 text-right">Learners</th>{columns.map((c) => <th key={c} scope="col" className="px-3 py-2.5 text-right capitalize">{c}</th>)}<th scope="col" className="px-4 py-2.5 text-right">Per learner</th></tr></thead>
              <tbody className="divide-y">
                {rows.map((g) => {
                  const sum = columns.reduce((n, c) => n + (Number(cells[`${g.id}:${c}`]) || 0), 0);
                  return (
                    <tr key={g.id}>
                      <th scope="row" className="px-4 py-2 text-left font-medium">{g.display_name}</th>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{learnersIn(g.id)}</td>
                      {columns.map((c) => (
                        <td key={c} className="px-2 py-1.5 text-right"><Input type="number" min={0} inputMode="numeric" value={cells[`${g.id}:${c}`] ?? ""} onChange={(e) => setCells((x) => ({ ...x, [`${g.id}:${c}`]: e.target.value }))} aria-label={`${g.display_name} ${c}`} className="ml-auto h-9 w-28 text-right tabular-nums" placeholder="0" /></td>
                      ))}
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{sum ? kes(sum) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">If every learner paid in full, the school would collect <strong className="text-foreground tabular-nums">{kes(total)}</strong> for {term}.</p>
            <div className="flex flex-wrap gap-2">
              <Button className="h-10" disabled={busy !== null} onClick={save}>{busy === "save" && <Spinner size={16} className="text-current" />} {isDesk ? "Save fees" : "Send to the head for approval"}</Button>
              {isDesk && (data.value?.lines.length ?? 0) > 0 && <Button variant="outline" className="h-10" disabled={busy !== null} onClick={bill}>{busy === "bill" && <Spinner size={16} className="text-current" />} <Receipt /> Bill all learners</Button>}
            </div>
          </div>
          {!isDesk && <p className="text-xs text-muted-foreground">Your changes do not take effect until the head of institution approves them.</p>}
          {isDesk && <p className="text-xs text-muted-foreground">Billing creates each learner&apos;s invoice from their grade&apos;s fees. It is safe to press again: nobody is billed twice.</p>}
        </>
      )}
    </div>
  );
}

/* ---------- Balances ---------- */

function RemindDialog({ ids, term, onClose, schoolId }: { ids: number[]; term: string; onClose: () => void; schoolId: number }) {
  const { token } = useAuth();
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sms, setSms] = useState(true);
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ sms_sent: number; email_sent: number; no_contact: string[]; sms_error: string | null; email_error: string | null } | null>(null);

  async function send() {
    if (!token) return;
    setBusy(true);
    try {
      setResult(await api.remindParents(token, schoolId, { term: term || undefined, student_ids: ids, message, sms, email }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't send the reminders.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Remind {ids.length} parent{ids.length === 1 ? "" : "s"} about fees</DialogTitle></DialogHeader>
        {result ? (
          <div className="flex flex-col gap-3 text-sm">
            <p><strong>{result.sms_sent}</strong> SMS and <strong>{result.email_sent}</strong> email{result.email_sent === 1 ? "" : "s"} sent.</p>
            {result.sms_error && <p className="rounded-lg border border-amber-300/70 bg-amber-50/70 px-3 py-2 dark:border-amber-700/50 dark:bg-amber-950/30">{result.sms_error}</p>}
            {result.email_error && <p className="rounded-lg border border-amber-300/70 bg-amber-50/70 px-3 py-2 dark:border-amber-700/50 dark:bg-amber-950/30">{result.email_error}</p>}
            {result.no_contact.length > 0 && <p className="text-muted-foreground">No way to reach: {result.no_contact.join(", ")}. Add a phone number or email for their guardian.</p>}
            <Button className="h-10 w-fit" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="remind-msg">Message</Label>
              <Textarea id="remind-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} />
              <p className="text-xs text-muted-foreground">Each parent gets their own child&apos;s name and amount. Use {"{guardian}"}, {"{student}"}, {"{owed}"}, {"{balance}"}, {"{arrears}"} and {"{school}"}. {message.length}/300</p>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Send by</legend>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} className="size-4 accent-[var(--primary)]" /> SMS (uses the school&apos;s SMS credits)</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="size-4 accent-[var(--primary)]" /> Email</label>
            </fieldset>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" className="h-11 sm:h-9" onClick={onClose}>Cancel</Button><Button className="h-11 sm:h-9" disabled={busy || (!sms && !email) || !message.trim()} onClick={send}>{busy && <Spinner size={16} className="text-current" />} Send reminders</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BalancesView({ schoolId, terms, classes }: { schoolId: number; terms: AcademicTerm[]; classes: SchoolClass[] }) {
  const { token, user } = useAuth();
  const [term, setTerm] = useState(() => (terms.find((t) => t.is_current) ?? terms[0])?.name ?? "");
  const [classId, setClassId] = useState("");
  const [mode, setMode] = useState<"all" | "above" | "exact" | "arrears">("all");
  const [amount, setAmount] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ key: string; value: FeeBalances | null } | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [reminding, setReminding] = useState(false);
  const canMessage = !!user && DESK.includes(user.role);
  const key = `${term}|${classId}|${mode}|${amount}|${query}`;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const t = setTimeout(() => {
      const n = amount === "" ? undefined : Number(amount);
      api
        .getFeeBalances(token, schoolId, { term: term || undefined, class_id: classId ? Number(classId) : undefined, min_owed: mode === "above" ? n : undefined, exact_owed: mode === "exact" ? n : undefined, arrears_only: mode === "arrears", q: query || undefined })
        .then((value) => !cancelled && setData({ key, value }))
        .catch(() => !cancelled && setData({ key, value: null }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, schoolId, term, classId, mode, amount, query, key]);

  const ready = data && data.key === key ? data.value : undefined;
  const rows = ready?.rows ?? [];
  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.student_id));
  const chosen = rows.filter((r) => picked.has(r.student_id));
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const description = [
    classId ? classes.find((c) => String(c.id) === classId)?.name : "All classes",
    mode === "above" && amount ? `owing at least ${kes(Number(amount))}` : mode === "exact" && amount ? `owing exactly ${kes(Number(amount))}` : mode === "arrears" ? "with arrears from earlier terms" : "owing anything",
    term,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Term
          <select value={term} onChange={(e) => setTerm(e.target.value)} className="h-10 min-w-40 rounded-lg border bg-background px-3 text-sm text-foreground">{terms.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Class
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-10 min-w-40 rounded-lg border bg-background px-3 text-sm text-foreground"><option value="">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <div role="group" aria-label="Who to show" className="inline-flex flex-wrap rounded-lg border p-0.5">
          {([["all", "Owing anything"], ["above", "Owing at least"], ["exact", "Owing exactly"], ["arrears", "With arrears"]] as const).map(([k, label]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`h-9 rounded-md px-3 text-sm font-medium ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
        </div>
        {(mode === "above" || mode === "exact") && <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">Amount (KES)<Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 w-36" placeholder="e.g. 10000" /></label>}
        <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Learner, admission no. or parent" aria-label="Search" className="h-10 pl-8" /></div>
      </div>

      {ready === undefined ? (
        <PageLoader />
      ) : ready === null ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">We couldn&apos;t load the balances.</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden" aria-label="Totals">
            {[["Learners", String(Math.round(ready.totals.learners ?? 0)), "in this list"], ["Billed this term", kes(ready.totals.billed ?? 0), "for these learners"], ["Owed this term", kes(ready.totals.balance ?? 0), "unpaid"], ["Arrears", kes(ready.totals.arrears ?? 0), "from earlier terms"]].map(([l, v, sub]) => (
              <div key={l} className="rounded-xl border bg-card p-3.5"><p className="text-sm text-muted-foreground">{l}</p><p className="font-heading text-xl font-semibold tabular-nums">{v}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
            ))}
          </section>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <p className="text-sm text-muted-foreground">{chosen.length ? `${chosen.length} selected` : `${rows.length} learner${rows.length === 1 ? "" : "s"} shown`}</p>
            <div className="ml-auto flex flex-wrap gap-2">
              {canMessage && <Button className="h-10" disabled={chosen.length === 0} onClick={() => setReminding(true)}><MessageSquareText /> Message parents{chosen.length ? ` (${chosen.length})` : ""}</Button>}
              <Button variant="outline" className="h-10" disabled={rows.length === 0} onClick={() => window.print()}><Printer /> Print {chosen.length ? "selected" : "this list"}</Button>
            </div>
          </div>

          <div className="hidden print:block">
            <h2 className="font-heading text-xl font-semibold">Fee balances</h2>
            <p className="text-sm">{description}</p>
            <p className="text-xs">Printed {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card print:border-0">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="w-10 px-4 py-2.5 print:hidden"><input type="checkbox" aria-label="Select everyone shown" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.student_id)))} className="size-4 accent-[var(--primary)]" /></th>
                  <th scope="col" className="px-3 py-2.5">Learner</th><th scope="col" className="px-3 py-2.5">Class</th><th scope="col" className="px-3 py-2.5">Parent or guardian</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Billed</th><th scope="col" className="px-3 py-2.5 text-right">Paid</th><th scope="col" className="px-3 py-2.5 text-right">Arrears</th><th scope="col" className="px-4 py-2.5 text-right">Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.student_id} className={`${picked.has(r.student_id) ? "bg-primary/5" : ""} ${chosen.length > 0 && !picked.has(r.student_id) ? "print:hidden" : ""}`}>
                    <td className="px-4 py-2.5 print:hidden"><input type="checkbox" aria-label={`Select ${r.name}`} checked={picked.has(r.student_id)} onChange={() => toggle(r.student_id)} className="size-4 accent-[var(--primary)]" /></td>
                    <th scope="row" className="px-3 py-2.5 text-left font-normal"><span className="block font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{r.admission_number}</span></th>
                    <td className="px-3 py-2.5">{r.class_name ?? "—"}</td>
                    <td className="px-3 py-2.5"><span className="block">{r.guardian_name ?? "—"}</span><span className="block text-xs text-muted-foreground">{r.guardian_phone ?? "No phone"}{r.guardian_email ? ` · ${r.guardian_email}` : ""}</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{kes(r.billed)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{kes(r.paid)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.arrears > 0 ? <Pill tone="warn">{kes(r.arrears)}</Pill> : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{kes(r.total_owed)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No learner matches. {mode === "all" ? "Nobody owes anything for this term." : "Try a different amount."}</td></tr>}
              </tbody>
              {rows.length > 0 && <tfoot><tr className="border-t bg-muted/30 font-semibold"><td className="print:hidden" /><td className="px-3 py-2.5" colSpan={3}>Total, {rows.length} learner{rows.length === 1 ? "" : "s"}</td><td className="px-3 py-2.5 text-right tabular-nums">{kes(ready.totals.billed)}</td><td className="px-3 py-2.5 text-right tabular-nums">{kes(ready.totals.paid)}</td><td className="px-3 py-2.5 text-right tabular-nums">{kes(ready.totals.arrears)}</td><td className="px-4 py-2.5 text-right tabular-nums">{kes(ready.totals.total_owed)}</td></tr></tfoot>}
            </table>
          </div>
        </>
      )}
      {reminding && <RemindDialog ids={chosen.map((r) => r.student_id)} term={term} schoolId={schoolId} onClose={() => setReminding(false)} />}
    </div>
  );
}
