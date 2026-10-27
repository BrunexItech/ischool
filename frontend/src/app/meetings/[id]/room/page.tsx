"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, ApiError, JoinToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LiveRoom } from "@/components/LiveRoom";

/** The room for a staff meeting. Everyone invited joins with camera and microphone on. */
export default function MeetingRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [joinToken, setJoinToken] = useState<JoinToken | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.meetingToken(token, Number(id)).then((t) => !cancelled && setJoinToken(t)).catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "We couldn't open the meeting."));
    return () => {
      cancelled = true;
    };
  }, [token, id]);

  if (loading || !user) return null;
  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#17090a] px-6 text-center text-white">
        <p className="max-w-sm">{error}</p>
        <button type="button" onClick={() => router.push("/dashboard/meetings")} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Back to meetings</button>
      </div>
    );
  }
  if (!joinToken) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#17090a] text-white" role="status">
        <Loader2 className="size-5 animate-spin" style={{ color: "#FFA819" }} />
        <p className="text-sm text-white/70">Connecting to the meeting...</p>
      </div>
    );
  }
  return <LiveRoom join={joinToken} mode="host" kind="meeting" leaveHref="/dashboard/meetings" />;
}
