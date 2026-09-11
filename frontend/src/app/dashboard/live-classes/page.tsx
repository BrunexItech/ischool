"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Video } from "lucide-react";
import { api, ApiError, LiveClass, SchoolClass } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LiveClassesPage() {
  const { user, token } = useAuth();
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [scheduledStart, setScheduledStart] = useState(toLocalInputValue(new Date().toISOString()));
  const [submitting, setSubmitting] = useState(false);

  const canSchedule = user?.role === "school_admin" || user?.role === "teacher" || user?.role === "super_admin";

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listLiveClasses(token, user.school_id).then(setLiveClasses);
    api.listClasses(token, user.school_id).then(setClasses);
  }, [token, user?.school_id]);

  function classNameFor(classId: number | null) {
    if (!classId) return "Whole school";
    return classes.find((c) => c.id === classId)?.name ?? `#${classId}`;
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const created = await api.scheduleLiveClass(token, user.school_id, {
        title,
        scheduled_start: new Date(scheduledStart).toISOString(),
        class_id: classId ? Number(classId) : undefined,
      });
      setLiveClasses((lc) => [created, ...lc]);
      setTitle("");
      toast.success("Live class scheduled");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to schedule live class");
    } finally {
      setSubmitting(false);
    }
  }

  function joinLink(joinCode: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${joinCode}`;
  }

  async function copyLink(lc: LiveClass) {
    try {
      await navigator.clipboard.writeText(joinLink(lc.join_code));
      toast.success("Join link copied");
    } catch {
      toast.error("Couldn't copy — copy the link manually");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Live Classes" description="Schedule and host video lessons for your students." />

      {canSchedule && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSchedule} className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label>Title</Label>
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Maths Live Lesson" className="w-56" />
              </div>
              <div className="grid gap-1.5">
                <Label>Class</Label>
                <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Whole school" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Starts</Label>
                <Input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} className="w-56" />
              </div>
              <Button disabled={submitting} type="submit">
                {submitting ? "Scheduling..." : "Schedule"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {liveClasses.map((lc) => (
          <Card key={lc.id}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Video className="size-4.5" />
                </div>
                <div>
                  <p className="font-medium leading-none">{lc.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="mr-2">{classNameFor(lc.class_id)}</Badge>
                    {new Date(lc.scheduled_start).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => copyLink(lc)}>
                  <Copy /> Student join link
                </Button>
                <Button size="sm" render={<Link href={`/live-classes/${lc.id}/room`}>Join as host</Link>} />
              </div>
            </CardHeader>
          </Card>
        ))}
        {liveClasses.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No live classes scheduled yet.</p>
        )}
      </div>
    </div>
  );
}
