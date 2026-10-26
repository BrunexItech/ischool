"use client";

import "@livekit/components-styles";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LiveKitRoom, VideoConference, useDataChannel, useLocalParticipant, useParticipants, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Check, Hand, MicOff, Users, UserX, X } from "lucide-react";
import { api, ApiError, JoinToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const MAROON = "#8B1A1D";
const GOLD = "#FFA819";

// LiveKit's own colour variables, set to Milai's palette.
const THEME: React.CSSProperties = {
  ["--lk-bg" as string]: "#17090a",
  ["--lk-bg2" as string]: "#241112",
  ["--lk-bg3" as string]: "#331a1b",
  ["--lk-control-bg" as string]: "#2a1415",
  ["--lk-control-hover-bg" as string]: "#3a1d1e",
  ["--lk-accent-bg" as string]: MAROON,
  ["--lk-accent2-bg" as string]: "#a52226",
  ["--lk-accent3-bg" as string]: "#6e1316",
  ["--lk-accent-fg" as string]: "#ffffff",
  ["--lk-danger" as string]: "#ef4444",
  ["--lk-border-color" as string]: "rgba(255,255,255,0.12)",
};

function Elapsed() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const s = Math.floor((now - start) / 1000);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return <span className="tabular-nums">{s >= 3600 ? `${Math.floor(s / 3600)}:` : ""}{mm}:{ss}</span>;
}

/** Re-renders when anyone's permissions or the hand-raise list change. */
function usePermissionTick() {
  const room = useRoomContext();
  const [n, setN] = useState(0);
  useEffect(() => {
    const bump = () => setN((x) => x + 1);
    room.on(RoomEvent.ParticipantPermissionsChanged, bump);
    return () => {
      room.off(RoomEvent.ParticipantPermissionsChanged, bump);
    };
  }, [room]);
  return n;
}

function useHands() {
  const [hands, setHands] = useState<Record<string, boolean>>({});
  const { send } = useDataChannel("hand", (msg) => {
    try {
      const body = JSON.parse(new TextDecoder().decode(msg.payload)) as { raised: boolean };
      const id = msg.from?.identity;
      if (id) setHands((h) => ({ ...h, [id]: body.raised }));
    } catch {
      /* ignore malformed messages */
    }
  });
  const setMine = useCallback((raised: boolean) => send(new TextEncoder().encode(JSON.stringify({ raised })), { reliable: true }), [send]);
  const clear = (id: string) => setHands((h) => ({ ...h, [id]: false }));
  return { hands, setMine, clear };
}

function HostPanel({ schoolId, liveClassId, onClose }: { schoolId: number; liveClassId: number; onClose: () => void }) {
  const { token } = useAuth();
  const participants = useParticipants();
  usePermissionTick();
  const { hands, clear } = useHands();
  const [tab, setTab] = useState<"people" | "waiting">("people");
  const [waiting, setWaiting] = useState<{ id: number; name: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = () => api.listLiveRequests(token, schoolId, liveClassId).then((r) => !cancelled && setWaiting(r)).catch(() => undefined);
    load();
    const id = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token, schoolId, liveClassId]);

  async function act(key: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(key);
    try {
      await fn();
      if (done) toast.success(done);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const learners = participants.filter((p) => !p.isLocal && !p.identity.startsWith("user-"));
  const raised = learners.filter((p) => hands[p.identity]);

  return (
    <aside className="flex h-full w-full flex-col border-l border-white/10 bg-[#1d0e0f] text-white sm:w-80" aria-label="Class controls">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <p className="font-semibold">Class controls</p>
        <Button variant="ghost" size="icon" className="size-9 text-white hover:bg-white/10 hover:text-white" aria-label="Close controls" onClick={onClose}><X /></Button>
      </div>
      <div role="tablist" className="grid grid-cols-2 gap-1 p-2">
        {([["people", `People (${learners.length})`], ["waiting", `Waiting (${waiting.length})`]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-9 rounded-md text-sm font-medium ${tab === k ? "bg-white/15" : "text-white/70 hover:bg-white/10"}`}>{label}</button>
        ))}
      </div>

      {tab === "people" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <Button
            className="h-10 w-full bg-white/10 text-white hover:bg-white/20"
            disabled={busy === "all" || learners.length === 0}
            onClick={() => token && act("all", () => api.muteAllLiveClass(token, schoolId, liveClassId), "Everyone has been muted")}
          >
            <MicOff /> Mute everyone
          </Button>
          {raised.length > 0 && (
            <p className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium" style={{ background: "rgba(255,168,25,0.15)", color: GOLD }}>
              <Hand className="size-4" /> {raised.length} hand{raised.length === 1 ? "" : "s"} raised
            </p>
          )}
          {learners.length === 0 && <p className="py-6 text-center text-sm text-white/60">No learners have joined yet.</p>}
          <ul className="flex flex-col gap-2">
            {learners.map((p) => {
              const canSpeak = p.permissions?.canPublish ?? false;
              return (
                <li key={p.identity} className="rounded-lg bg-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name || p.identity}</span>
                    {hands[p.identity] && <Hand className="size-4 shrink-0" style={{ color: GOLD }} aria-label="Hand raised" />}
                  </div>
                  <p className="text-xs text-white/60">{canSpeak ? "Can speak" : "Muted"}</p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className={`h-9 flex-1 ${canSpeak ? "bg-white/10 text-white hover:bg-white/20" : "text-white hover:opacity-90"}`}
                      style={canSpeak ? undefined : { background: MAROON }}
                      disabled={busy === p.identity}
                      onClick={() => token && act(p.identity, () => api.setLiveSpeaking(token, schoolId, liveClassId, p.identity, !canSpeak).then(() => clear(p.identity)))}
                    >
                      {canSpeak ? <><MicOff /> Mute</> : <><Check /> Let speak</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 text-red-300 hover:bg-white/10 hover:text-red-200"
                      disabled={busy === `r${p.identity}`}
                      aria-label={`Remove ${p.name || "learner"}`}
                      onClick={() => token && act(`r${p.identity}`, () => api.removeFromLiveClass(token, schoolId, liveClassId, p.identity), "Removed from the class")}
                    >
                      <UserX />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          {waiting.length === 0 && <p className="py-6 text-center text-sm text-white/60">Nobody is waiting.</p>}
          {waiting.map((w) => (
            <div key={w.id} className="rounded-lg bg-white/5 p-3">
              <p className="truncate text-sm font-medium">{w.name}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-9 flex-1 text-white" style={{ background: MAROON }} onClick={() => token && act(`a${w.id}`, () => api.decideLiveRequest(token, schoolId, liveClassId, w.id, "admit").then(() => setWaiting((x) => x.filter((y) => y.id !== w.id))))}>Admit</Button>
                <Button size="sm" variant="ghost" className="h-9 text-white hover:bg-white/10 hover:text-white" onClick={() => token && act(`d${w.id}`, () => api.decideLiveRequest(token, schoolId, liveClassId, w.id, "deny").then(() => setWaiting((x) => x.filter((y) => y.id !== w.id))))}>Deny</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function LearnerBar() {
  const { localParticipant } = useLocalParticipant();
  usePermissionTick();
  const { setMine } = useHands();
  const [raised, setRaised] = useState(false);
  const canSpeak = localParticipant.permissions?.canPublish ?? false;

  // When the teacher lets this learner speak (or mutes them again) the hand resets.
  const [prevCan, setPrevCan] = useState(canSpeak);
  if (prevCan !== canSpeak) {
    setPrevCan(canSpeak);
    setRaised(false);
  }
  useEffect(() => {
    if (canSpeak) setMine(false);
  }, [canSpeak, setMine]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#1d0e0f] px-4 py-2 text-sm text-white">
      <span className="text-white/80">{canSpeak ? "Your teacher has let you speak. Use the microphone button." : "Your microphone is off until your teacher lets you speak."}</span>
      {!canSpeak && (
        <Button
          size="sm"
          className="h-10 text-white sm:h-9"
          style={{ background: raised ? "#3a1d1e" : MAROON }}
          onClick={() => {
            setRaised(!raised);
            setMine(!raised);
          }}
        >
          <Hand /> {raised ? "Lower hand" : "Raise hand"}
        </Button>
      )}
    </div>
  );
}

export function LiveRoom({
  join,
  mode,
  schoolId,
  liveClassId,
  leaveHref,
}: {
  join: JoinToken;
  mode: "host" | "learner";
  schoolId?: number;
  liveClassId?: number;
  leaveHref: string;
}) {
  const [left, setLeft] = useState(false);
  const [panel, setPanel] = useState(true);

  if (left) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#17090a] px-6 text-center text-white">
        <div className="rounded-xl bg-white px-6 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Milai-School-Logo.svg" alt="Milai School" className="h-14 w-auto" />
        </div>
        <h1 className="font-heading text-2xl font-semibold">{mode === "host" ? "Class ended" : "You have left the class"}</h1>
        <p className="max-w-sm text-sm text-white/70">{join.class_title}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button className="h-11 text-white" style={{ background: MAROON }} onClick={() => setLeft(false)}>Rejoin</Button>
          <Button className="h-11 bg-white/10 text-white hover:bg-white/20" nativeButton={false} render={<Link href={leaveHref}>Done</Link>} />
        </div>
        <p className="text-[11px] tracking-[0.25em] uppercase" style={{ color: GOLD }}>Nurture With Excellence</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#17090a]" style={THEME} data-lk-theme="default">
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-2 text-white sm:px-4" style={{ background: "linear-gradient(90deg,#8B1A1D,#5e1114)" }}>
        <span className="shrink-0 rounded-md bg-white px-2 py-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Milai-School-Logo.svg" alt="Milai School" className="h-7 w-auto sm:h-8" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">{join.class_title}</p>
          <p className="text-xs text-white/75">Live class · <Elapsed /></p>
        </div>
        {mode === "host" && (
          <Button size="sm" className="h-9 bg-white/15 text-white hover:bg-white/25" onClick={() => setPanel((p) => !p)} aria-expanded={panel}>
            <Users /> <span className="hidden sm:inline">Controls</span>
          </Button>
        )}
      </header>
      <LiveKitRoom
        token={join.token}
        serverUrl={join.url}
        connect
        video={mode === "host"}
        audio={mode === "host"}
        data-lk-theme="default"
        style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", ...THEME }}
        onDisconnected={() => setLeft(true)}
      >
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <VideoConference />
          </div>
          {mode === "host" && panel && schoolId && liveClassId && (
            <div className="absolute inset-x-0 top-[3.25rem] bottom-0 z-20 sm:static sm:inset-auto sm:z-auto">
              <HostPanel schoolId={schoolId} liveClassId={liveClassId} onClose={() => setPanel(false)} />
            </div>
          )}
        </div>
        {mode === "learner" && <LearnerBar />}
      </LiveKitRoom>
    </div>
  );
}
