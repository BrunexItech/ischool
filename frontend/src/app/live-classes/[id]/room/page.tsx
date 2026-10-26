"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api, ApiError, JoinToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LiveRoom } from "@/components/LiveRoom";

export default function HostRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [joinToken, setJoinToken] = useState<JoinToken | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    let cancelled = false;
    const request =
      user.role === "student"
        ? api.getMyStudentRecord(token).then((student) => api.getChildLiveClassJoinToken(token, student.id, Number(id)))
        : api.getHostToken(token, user.school_id, Number(id));
    request.then((t) => !cancelled && setJoinToken(t)).catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Failed to join class"));
    return () => {
      cancelled = true;
    };
  }, [token, user?.school_id, user?.role, id]);

  if (loading || !user) return null;

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#17090a] px-6 text-center text-white">
        <p>{error}</p>
      </div>
    );
  }

  if (!joinToken) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#17090a] text-white">
        <Loader2 className="size-5 animate-spin" style={{ color: "#FFA819" }} />
        <p className="text-sm text-white/70">Connecting to the class...</p>
      </div>
    );
  }

  const isLearner = user.role === "student";
  return (
    <LiveRoom
      join={joinToken}
      mode={isLearner ? "learner" : "host"}
      schoolId={user.school_id ?? undefined}
      liveClassId={Number(id)}
      leaveHref={isLearner ? "/dashboard" : "/dashboard/live-classes"}
    />
  );
}
