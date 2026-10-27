"use client";

import { EmptyNote } from "@/components/EmptyNote";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ClipboardList, Plus, Scale, X } from "lucide-react";
import { api, ApiError, StockItem, StockMovement, StoreRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Pill } from "@/components/oversight";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const TONE = { requested: "warn", issued: "good", declined: "bad" } as const;
const LABEL = { requested: "Waiting", issued: "Issued", declined: "Declined" } as const;

function NewRequest({ items, schoolId, onClose, onCreated }: { items: StockItem[]; schoolId: number; onClose: () => void; onCreated: (r: StoreRequest) => void }) {
  const { token } = useAuth();
  const [department, setDepartment] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<{ item_id: string; quantity: string }[]>([{ item_id: "", quantity: "1" }]);
  const [busy, setBusy] = useState(false);
  const ready = department.trim().length >= 2 && lines.every((l) => l.item_id && Number(l.quantity) > 0);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      const r = await api.createStoreRequest(token, schoolId, { department: department.trim(), note: note || undefined, lines: lines.map((l) => ({ item_id: Number(l.item_id), quantity: Number(l.quantity) })) });
      toast.success(`${r.reference} sent to the store`);
      onCreated(r);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't send the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Ask the store for items</DialogTitle></DialogHeader>
        <form onSubmit={send} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5"><Label>For which class or department?</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Grade 4, Science lab, Kitchen" className="h-10" autoFocus /></div>
          <div className="flex flex-col gap-2">
            <Label>Items</Label>
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <select value={l.item_id} onChange={(e) => setLines((all) => all.map((x, n) => (n === i ? { ...x, item_id: e.target.value } : x)))} aria-label="Item" className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm"><option value="">Choose an item</option>{items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.quantity} {it.unit} in store)</option>)}</select>
                <Input type="number" min={1} value={l.quantity} onChange={(e) => setLines((all) => all.map((x, n) => (n === i ? { ...x, quantity: e.target.value } : x)))} aria-label="Quantity" className="h-10 w-20" />
                {lines.length > 1 && <Button type="button" variant="ghost" size="icon" className="size-10" aria-label="Remove item" onClick={() => setLines((all) => all.filter((_, n) => n !== i))}><X /></Button>}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-9 w-fit" onClick={() => setLines((all) => [...all, { item_id: "", quantity: "1" }])}><Plus /> Another item</Button>
          </div>
          <div className="flex flex-col gap-1.5"><Label>What is it for? (optional)</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>Cancel</Button><Button type="submit" className="h-11 sm:h-9" disabled={!ready || busy}>{busy && <Spinner size={16} className="text-current" />} Send request</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RequestsPanel({ schoolId, items, isKeeper, canAsk, onStockChanged }: { schoolId: number; items: StockItem[]; isKeeper: boolean; canAsk: boolean; onStockChanged: () => void }) {
  const { token } = useAuth();
  const [rows, setRows] = useState<StoreRequest[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [declining, setDeclining] = useState<{ id: number; note: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.listStoreRequests(token, schoolId).then((r) => !cancelled && setRows(r)).catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, version]);

  async function issue(r: StoreRequest) {
    if (!token) return;
    setBusy(r.id);
    try {
      await api.issueStoreRequest(token, schoolId, r.id);
      toast.success(`${r.reference} issued`);
      setVersion((v) => v + 1);
      onStockChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't issue that.");
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    if (!token || !declining) return;
    setBusy(declining.id);
    try {
      await api.declineStoreRequest(token, schoolId, declining.id, declining.note);
      toast.success("Request declined");
      setDeclining(null);
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't decline that.");
    } finally {
      setBusy(null);
    }
  }

  if (!rows) return <PageLoader />;
  return (
    <div className="flex flex-col gap-4">
      {canAsk && <div><Button className="h-10 sm:h-9" onClick={() => setAdding(true)}><ClipboardList /> Ask the store for items</Button></div>}
      {rows.length === 0 ? (
        <EmptyNote>{isKeeper ? "No one has asked the store for anything yet." : "You have not asked the store for anything."}</EmptyNote>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-medium">{r.reference} · {r.department}</p><p className="text-xs text-muted-foreground">{r.requested_by_name ?? "Unknown"} · {when(r.requested_at)}</p></div><Pill tone={TONE[r.status]}>{LABEL[r.status]}</Pill></div>
              <ul className="divide-y rounded-lg border text-sm">
                {r.lines.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="break-words">{l.item_name}</span><span className="shrink-0 tabular-nums">{r.status === "issued" ? `${l.quantity_issued} of ${l.quantity_requested}` : l.quantity_requested} {l.unit}{r.status === "requested" && isKeeper && l.in_stock < l.quantity_requested ? <span className="ml-2 text-xs font-medium text-red-700 dark:text-red-400">only {l.in_stock} in store</span> : null}</span></li>
                ))}
              </ul>
              {r.note && <p className="text-sm text-muted-foreground">&ldquo;{r.note}&rdquo;</p>}
              {r.status !== "requested" && <p className="text-xs text-muted-foreground">{LABEL[r.status]} by {r.decided_by_name ?? "the store"}{r.decided_at ? `, ${when(r.decided_at)}` : ""}{r.decision_note ? `: ${r.decision_note}` : ""}</p>}
              {isKeeper && r.status === "requested" && (
                declining?.id === r.id ? (
                  <div className="flex flex-col gap-2"><Textarea rows={2} autoFocus value={declining.note} onChange={(e) => setDeclining({ id: r.id, note: e.target.value })} placeholder="Why can the store not give this?" aria-label="Reason" /><div className="flex gap-2"><Button size="sm" className="h-9" disabled={declining.note.trim().length < 3 || busy === r.id} onClick={decline}>Decline request</Button><Button size="sm" variant="outline" className="h-9" onClick={() => setDeclining(null)}>Back</Button></div></div>
                ) : (
                  <div className="flex gap-2"><Button className="h-10" disabled={busy === r.id} onClick={() => issue(r)}>{busy === r.id ? <Spinner size={16} className="text-current" /> : <Check />} Issue all</Button><Button variant="outline" className="h-10" onClick={() => setDeclining({ id: r.id, note: "" })}><X /> Decline</Button></div>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && <NewRequest items={items} schoolId={schoolId} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); setVersion((v) => v + 1); }} />}
    </div>
  );
}

export function CountPanel({ schoolId, items, onCounted }: { schoolId: number; items: StockItem[]; onCounted: () => void }) {
  const { token } = useAuth();
  const [itemId, setItemId] = useState("");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const item = items.find((i) => String(i.id) === itemId);
  const diff = item && counted !== "" ? Number(counted) - item.quantity : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !item) return;
    setBusy(true);
    try {
      await api.recordStockCount(token, schoolId, { item_id: item.id, counted_quantity: Number(counted), reason: reason.trim() });
      toast.success(`${item.name} corrected to ${counted}`);
      setItemId("");
      setCounted("");
      setReason("");
      onCounted();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't record the count.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex max-w-xl flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Scale className="size-4.5 text-primary" aria-hidden /> Stocktake</h2>
      <p className="text-sm text-muted-foreground">Count what is on the shelf and enter it. If it differs from the book figure, the stock and the ledger are corrected and your reason is kept on record.</p>
      <select value={itemId} onChange={(e) => setItemId(e.target.value)} aria-label="Item" className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="">Choose an item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
      {item && (
        <>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted/50 px-3 py-2"><p className="text-xs text-muted-foreground">Book figure</p><p className="font-heading text-xl font-semibold tabular-nums">{item.quantity} {item.unit}</p></div><label className="flex flex-col gap-1 text-xs text-muted-foreground">Counted<Input type="number" min={0} required value={counted} onChange={(e) => setCounted(e.target.value)} className="h-12 text-lg" /></label></div>
          {diff !== null && diff !== 0 && <p className={`text-sm font-medium ${diff < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>{diff < 0 ? `${-diff} short` : `${diff} over`}, worth KES {Math.abs(diff * item.unit_cost).toLocaleString()}</p>}
          <Textarea rows={2} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is it different? e.g. damp damage, miscount at receipt" aria-label="Reason" />
          <Button type="submit" className="h-11 w-fit" disabled={busy || counted === "" || diff === 0 || reason.trim().length < 5}>{busy && <Spinner size={16} className="text-current" />} Record count</Button>
        </>
      )}
    </form>
  );
}

export function MovementsPanel({ schoolId, items }: { schoolId: number; items: StockItem[] }) {
  const { token } = useAuth();
  const [rows, setRows] = useState<StockMovement[] | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.listStockMovements(token, schoolId).then((r) => !cancelled && setRows(r)).catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId]);
  if (!rows) return <PageLoader />;
  if (rows.length === 0) return <EmptyNote>No stock has moved yet.</EmptyNote>;
  const name = (id: number) => items.find((i) => i.id === id);
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[40rem] text-sm">
        <thead><tr className="border-b bg-muted/50 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"><th scope="col" className="px-4 py-2.5">When</th><th scope="col" className="px-3 py-2.5">Item</th><th scope="col" className="px-3 py-2.5">Movement</th><th scope="col" className="px-3 py-2.5 text-right">Qty</th><th scope="col" className="px-4 py-2.5">To / why</th></tr></thead>
        <tbody className="divide-y">
          {rows.map((m) => (
            <tr key={m.id}><td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{when(m.created_at)}</td><td className="px-3 py-2.5">{name(m.item_id)?.name ?? `#${m.item_id}`}</td><td className="px-3 py-2.5"><Pill tone={m.type === "receipt" ? "good" : m.type === "issue" ? "info" : "warn"}>{m.type === "receipt" ? "Received" : m.type === "issue" ? "Issued" : "Stocktake"}</Pill></td><td className="px-3 py-2.5 text-right tabular-nums">{m.quantity}</td><td className="px-4 py-2.5 break-words text-muted-foreground">{m.department ?? m.note ?? "—"}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
