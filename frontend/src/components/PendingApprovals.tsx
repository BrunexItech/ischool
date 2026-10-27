"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Hourglass, X } from "lucide-react";
import { api, ApiError, ChangeRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const DECIDERS = ["head_of_institution", "group_principal", "super_admin"];

/** Changes the secretary prepared. The head approves or declines them here;
 * the secretary sees that they are still waiting, or why they were declined. */
export function PendingApprovals({ kind, schoolId, onDecided }: { kind: string; schoolId: number; onDecided?: () => void }) {
  const { token, user } = useAuth();
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const canDecide = !!user && DECIDERS.includes(user.role);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .listApprovals(token, schoolId, kind)
      .then((rows) => !cancelled && setItems(rows))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [token, schoolId, kind, version]);

  async function decide(id: number, approve: boolean) {
    if (!token) return;
    setBusy(id);
    try {
      await api.decideApproval(token, schoolId, id, approve);
      toast.success(approve ? "Approved. The change is now in effect." : "Declined. The secretary has been told.");
      setVersion((v) => v + 1);
      onDecided?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't record that decision.");
    } finally {
      setBusy(null);
    }
  }

  const pending = items.filter((i) => i.status === "pending");
  const declined = !canDecide ? items.filter((i) => i.status === "rejected").slice(0, 1) : [];
  if (pending.length === 0 && declined.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" aria-label="Changes awaiting approval">
      {pending.map((r) => (
        <div key={r.id} className="flex flex-col gap-3 rounded-xl border border-amber-300/70 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700/50 dark:bg-amber-950/30">
          <div className="flex min-w-0 items-start gap-3">
            <Hourglass className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-medium break-words">{canDecide ? "Waiting for your approval: " : "Waiting for the head's approval: "}{r.title}</p>
              <p className="text-xs break-words text-muted-foreground">{r.summary}{r.requested_by_name ? ` · prepared by ${r.requested_by_name}` : ""}</p>
            </div>
          </div>
          {canDecide && (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" className="h-9" disabled={busy === r.id} onClick={() => decide(r.id, false)}><X /> Decline</Button>
              <Button size="sm" className="h-9" disabled={busy === r.id} onClick={() => decide(r.id, true)}><Check /> Approve</Button>
            </div>
          )}
        </div>
      ))}
      {declined.map((r) => (
        <p key={r.id} className="rounded-xl border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          The head declined &ldquo;{r.title}&rdquo;{r.decision_note ? `: ${r.decision_note}` : "."}
        </p>
      ))}
    </div>
  );
}
