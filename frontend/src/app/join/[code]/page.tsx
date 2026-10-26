"use client";

import { use, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError, JoinToken } from "@/lib/api";
import { LiveRoom } from "@/components/LiveRoom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Stage = { kind: "form" } | { kind: "waiting"; requestCode: string } | { kind: "denied" } | { kind: "in"; join: JoinToken };

export default function GuestJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // While waiting, ask every few seconds whether the teacher has let us in.
  const requestCode = stage.kind === "waiting" ? stage.requestCode : null;
  useEffect(() => {
    if (!requestCode) return;
    let cancelled = false;
    const check = async () => {
      try {
        const r = await api.liveClassWaitStatus(code, requestCode);
        if (cancelled) return;
        if (r.status === "admitted" && r.join) setStage({ kind: "in", join: r.join });
        else if (r.status === "denied") setStage({ kind: "denied" });
      } catch {
        /* keep waiting; a brief network drop should not end the wait */
      }
    };
    const id = window.setInterval(check, 3000);
    check();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [code, requestCode]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.askToJoinLiveClass(code, name.trim());
      setStage({ kind: "waiting", requestCode: r.request_code });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not ask to join this class");
    } finally {
      setSubmitting(false);
    }
  }

  if (stage.kind === "in") return <LiveRoom join={stage.join} mode="learner" leaveHref="/" />;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#17090a] px-5 py-10 text-white">
      <div className="rounded-xl bg-white px-6 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Milai-School-Logo.svg" alt="Milai School" className="h-14 w-auto sm:h-16" />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#241112] p-6 text-center">
        {stage.kind === "form" && (
          <>
            <h1 className="font-heading text-xl font-semibold">Join the live class</h1>
            <p className="mt-1 text-sm text-white/70">Enter your name. Your teacher will let you in.</p>
            <form onSubmit={handleAsk} className="mt-5 space-y-3">
              <Input required placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 border-white/20 bg-white/5 text-white placeholder:text-white/40" autoFocus />
              {error && <p className="text-sm text-red-300">{error}</p>}
              <Button disabled={submitting || !name.trim()} type="submit" className="h-11 w-full text-white" style={{ background: "#8B1A1D" }}>
                {submitting ? "Asking..." : "Ask to join"}
              </Button>
            </form>
          </>
        )}
        {stage.kind === "waiting" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="size-6 animate-spin" style={{ color: "#FFA819" }} />
            <h1 className="font-heading text-xl font-semibold">Waiting for your teacher</h1>
            <p className="text-sm text-white/70">You will join automatically as soon as you are let in. Please keep this page open.</p>
          </div>
        )}
        {stage.kind === "denied" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <h1 className="font-heading text-xl font-semibold">Not admitted</h1>
            <p className="text-sm text-white/70">Your teacher did not let you in to this class. Check you used the right link, or ask your teacher.</p>
            <Button className="h-10 bg-white/10 text-white hover:bg-white/20" onClick={() => setStage({ kind: "form" })}>Try again</Button>
          </div>
        )}
      </div>
      <p className="text-[11px] tracking-[0.25em] uppercase" style={{ color: "#FFA819" }}>Nurture With Excellence</p>
    </div>
  );
}
