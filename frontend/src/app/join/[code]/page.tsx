"use client";

import "@livekit/components-styles";
import { use, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { api, ApiError, JoinToken } from "@/lib/api";

export default function GuestJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [name, setName] = useState("");
  const [joinToken, setJoinToken] = useState<JoinToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const token = await api.joinLiveClassByCode(code, name);
      setJoinToken(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join this class");
    } finally {
      setSubmitting(false);
    }
  }

  if (joinToken) {
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
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Join the class</h1>
        <p className="mb-6 text-sm text-gray-500">Enter your name to join the live lesson.</p>
        <form onSubmit={handleJoin} className="space-y-4">
          <input
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={submitting}
            type="submit"
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Joining..." : "Join class"}
          </button>
        </form>
      </div>
    </div>
  );
}
