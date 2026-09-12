"use client";

import "@livekit/components-styles";
import { use, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { GraduationCap } from "lucide-react";
import { api, ApiError, JoinToken } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <CardTitle>Join the class</CardTitle>
          <CardDescription>Enter your name to join the live lesson.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            <Input required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button disabled={submitting} type="submit" className="w-full">
              {submitting ? "Joining..." : "Join class"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
