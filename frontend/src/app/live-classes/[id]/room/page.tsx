"use client";

import "@livekit/components-styles";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { api, ApiError, JoinToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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
    api
      .getHostToken(token, user.school_id, Number(id))
      .then(setJoinToken)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to join class"));
  }, [token, user?.school_id, id]);

  if (loading || !user) return null;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <p>{error}</p>
      </div>
    );
  }

  if (!joinToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <p>Connecting to the class...</p>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh" }}>
      <LiveKitRoom
        token={joinToken.token}
        serverUrl={joinToken.url}
        connect
        video
        audio
        data-lk-theme="default"
        style={{ height: "100%" }}
        onDisconnected={() => router.push("/dashboard/live-classes")}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
