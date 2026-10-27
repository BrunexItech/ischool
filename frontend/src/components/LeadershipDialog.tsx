"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Power, Repeat, UserCog } from "lucide-react";
import { api, ApiError, LeadershipAccount, School } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ROLE = (r: string) => r.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** For the platform administrator only: switch a staff login off, or hand the school to a new head without touching any records. */
export function LeadershipDialog({ school }: { school: School }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<LeadershipAccount[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [outgoing, setOutgoing] = useState("");
  const [existing, setExisting] = useState("");
  const [nh, setNh] = useState({ full_name: "", email: "", password: "" });
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    api.listSchoolAccounts(token, school.id).then((a) => !cancelled && setAccounts(a)).catch(() => !cancelled && setAccounts([]));
    return () => {
      cancelled = true;
    };
  }, [open, token, school.id, done]);

  const heads = (accounts ?? []).filter((a) => a.role === "head_of_institution" && a.is_active);
  const staff = (accounts ?? []).filter((a) => a.is_active && a.role !== "head_of_institution" && a.role !== "group_principal");
  const outId = outgoing || (heads.length === 1 ? String(heads[0].user_id) : "");
  const valid = !!outId && reason.trim().length >= 5 && (mode === "existing" ? !!existing : nh.full_name.trim().length >= 2 && nh.email.includes("@") && nh.password.length >= 8);

  async function toggle(a: LeadershipAccount) {
    if (!token) return;
    setBusy(`t${a.user_id}`);
    try {
      await api.switchAccount(token, school.id, a.user_id, !a.is_active);
      toast.success(a.is_active ? `${a.full_name}'s login is switched off` : `${a.full_name}'s login is back on`);
      setDone((d) => String(Number(d ?? 0) + 1));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't change that account.");
    } finally {
      setBusy(null);
    }
  }

  async function handOver() {
    if (!token) return;
    setBusy("hand");
    try {
      const r = await api.handOverSchool(token, school.id, { outgoing_user_id: Number(outId), existing_user_id: mode === "existing" ? Number(existing) : undefined, new_head: mode === "new" ? nh : undefined, reason: reason.trim() });
      toast.success(r.message);
      setConfirming(false);
      setReason("");
      setNh({ full_name: "", email: "", password: "" });
      setExisting("");
      setOutgoing("");
      setDone((d) => String(Number(d ?? 0) + 1));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't complete the handover.");
      setConfirming(false);
    } finally {
      setBusy(null);
    }
  }

  const outName = accounts?.find((a) => String(a.user_id) === outId)?.full_name ?? "the current head";

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirming(false); }}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Leadership and accounts for ${school.name}`} title="Leadership and accounts"><UserCog /></Button>} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Leadership of {school.name}</DialogTitle></DialogHeader>
        {!accounts ? <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p> : (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3 rounded-xl border p-4">
              <h3 className="flex items-center gap-2 font-heading text-base font-semibold"><Repeat className="size-4" aria-hidden /> Hand over to a new head</h3>
              <p className="text-sm text-muted-foreground">The current head&apos;s login is switched off and the new head takes charge. Nothing the school has recorded is changed or lost.</p>
              {heads.length === 0 ? <p className="text-sm text-amber-700 dark:text-amber-400">There is no active head at this school.</p> : (
                <div className="flex flex-col gap-4">
                  {heads.length > 1 && <label className="flex flex-col gap-1 text-sm font-medium">Head who is leaving<select value={outId} onChange={(e) => setOutgoing(e.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal"><option value="">Choose</option>{heads.map((h) => <option key={h.user_id} value={h.user_id}>{h.full_name}</option>)}</select></label>}
                  {heads.length === 1 && <p className="text-sm">Head who is leaving: <strong>{heads[0].full_name}</strong> <span className="text-muted-foreground">({heads[0].email})</span></p>}
                  <div role="group" aria-label="New head" className="inline-flex w-fit rounded-lg border p-0.5">
                    {([["new", "A new person"], ["existing", "Someone already on the staff"]] as const).map(([k, label]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`h-9 rounded-md px-3 text-sm font-medium ${mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}</button>)}
                  </div>
                  {mode === "new" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5"><Label>Full name</Label><Input value={nh.full_name} onChange={(e) => setNh((x) => ({ ...x, full_name: e.target.value }))} className="h-10" /></div>
                      <div className="flex flex-col gap-1.5"><Label>Email</Label><Input type="email" value={nh.email} onChange={(e) => setNh((x) => ({ ...x, email: e.target.value }))} className="h-10" /></div>
                      <div className="flex flex-col gap-1.5 sm:col-span-2"><Label>Temporary password</Label><Input type="password" autoComplete="new-password" value={nh.password} onChange={(e) => setNh((x) => ({ ...x, password: e.target.value }))} className="h-10" /><p className="text-xs text-muted-foreground">They will be asked to choose their own password the first time they sign in.</p></div>
                    </div>
                  ) : (
                    <label className="flex flex-col gap-1 text-sm font-medium">Staff member<select value={existing} onChange={(e) => setExisting(e.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm font-normal"><option value="">Choose</option>{staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name} · {ROLE(s.role)}</option>)}</select></label>
                  )}
                  <div className="flex flex-col gap-1.5"><Label>Reason, kept in the activity log</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Head has retired and Mrs Njeri takes over from 1 January" /></div>
                  {confirming ? (
                    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-300/70 bg-amber-50/70 px-4 py-3 text-sm dark:border-amber-700/50 dark:bg-amber-950/30">
                      <p>{outName} will be signed out immediately and will not be able to sign in again. {mode === "new" ? nh.full_name : staff.find((s) => String(s.user_id) === existing)?.full_name} becomes head of {school.name}.</p>
                      <div className="flex gap-2"><Button className="h-10" disabled={busy === "hand"} onClick={handOver}>{busy === "hand" && <Spinner size={16} className="text-current" />} Yes, hand over</Button><Button variant="outline" className="h-10" onClick={() => setConfirming(false)}>Go back</Button></div>
                    </div>
                  ) : <Button className="h-10 w-fit" disabled={!valid} onClick={() => setConfirming(true)}>Review handover</Button>}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 font-heading text-base font-semibold"><Power className="size-4" aria-hidden /> Staff logins</h3>
              <ul className="divide-y rounded-xl border">
                {accounts.map((a) => (
                  <li key={a.user_id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0"><span className={`block font-medium break-words ${a.is_active ? "" : "text-muted-foreground line-through"}`}>{a.full_name}</span><span className="block text-xs break-all text-muted-foreground">{ROLE(a.role)} · {a.email}</span></span>
                    <Button size="sm" variant={a.is_active ? "outline" : "default"} className="h-9 shrink-0" disabled={busy === `t${a.user_id}`} onClick={() => toggle(a)}>{a.is_active ? "Switch off" : "Switch on"}</Button>
                  </li>
                ))}
                {accounts.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No staff logins yet.</li>}
              </ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
