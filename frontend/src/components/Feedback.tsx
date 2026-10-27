"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api, LeadershipFeedback } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Pill } from "@/components/oversight";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const canGiveFeedback = (role?: string) => role === "head_of_institution" || role === "group_principal" || role === "super_admin";

export function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** A note from school leadership to a teacher about their work. The teacher
 *  is notified and can acknowledge or reply, so the head can see it was read. */
export function FeedbackDialog({
  teacherId,
  teacherName,
  topic: initialTopic = "",
  link,
  onClose,
  onSent,
}: {
  teacherId: number;
  teacherName: string;
  topic?: string;
  link?: string;
  onClose: () => void;
  onSent?: (f: LeadershipFeedback) => void;
}) {
  const { user, token } = useAuth();
  const [topic, setTopic] = useState(initialTopic);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSaving(true);
    try {
      const f = await api.sendFeedback(token, user.school_id, { recipient_user_id: teacherId, topic: topic.trim() || "Your work", link, message: message.trim() });
      toast.success(`Feedback sent to ${teacherName}`);
      onSent?.(f);
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't send the feedback.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Feedback for {teacherName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={send} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fb-topic">About</Label>
            <Input id="fb-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Lesson plan, Mathematics Grade 6" maxLength={100} className="h-11" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fb-message">Your feedback</Label>
            <Textarea id="fb-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Say what is working and what you would like to see." />
          </div>
          <p className="text-xs text-muted-foreground">{teacherName} will be notified and can reply. You will see when it has been read.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-11 sm:h-9" disabled={saving || !message.trim()}>{saving && <Spinner size={16} className="text-current" />} Send feedback</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FeedbackItem({ f, viewer }: { f: LeadershipFeedback; viewer: "leader" | "teacher" }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-medium break-words">{f.topic}</p>
        {f.status === "acknowledged" ? <Pill tone="good"><CheckCircle2 className="mr-1 size-3" aria-hidden /> Read</Pill> : <Pill tone="warn"><Clock className="mr-1 size-3" aria-hidden /> Not read yet</Pill>}
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{f.message}</p>
      <p className="text-xs text-muted-foreground">
        {viewer === "teacher" ? `From ${f.author_name ?? "leadership"}` : `To ${f.recipient_name}`} · {when(f.created_at)}
      </p>
      {f.reply && (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm break-words">
          <span className="block text-xs font-medium text-muted-foreground">{viewer === "teacher" ? "Your reply" : `${f.recipient_name} replied`}</span>
          {f.reply}
        </p>
      )}
      {f.link && viewer === "teacher" && (
        <Link href={f.link} className="text-xs font-medium text-primary hover:underline">Go to it</Link>
      )}
    </article>
  );
}

/** What was said to one teacher so far, plus the button to say something new. */
export function TeacherFeedback({ teacherId, teacherName }: { teacherId: number; teacherName: string }) {
  const { user, token } = useAuth();
  const [items, setItems] = useState<LeadershipFeedback[] | null>(null);
  const [writing, setWriting] = useState(false);
  const schoolId = user?.school_id;

  useEffect(() => {
    if (!token || !schoolId) return;
    let live = true;
    api
      .listFeedback(token, schoolId, teacherId)
      .then((rows) => {
        if (live) setItems(rows);
      })
      .catch(() => {
        if (live) setItems([]);
      });
    return () => {
      live = false;
    };
  }, [token, schoolId, teacherId]);

  return (
    <section className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Feedback</p>
        <Button size="sm" variant="outline" className="h-9" onClick={() => setWriting(true)}><MessageSquarePlus /> Give feedback</Button>
      </div>
      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing sent to {teacherName} yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.slice(0, 3).map((f) => <FeedbackItem key={f.id} f={f} viewer="leader" />)}
          {items.length > 3 && <Link href="/dashboard/feedback" className="text-xs font-medium text-primary hover:underline">See all {items.length}</Link>}
        </div>
      )}
      {writing && <FeedbackDialog teacherId={teacherId} teacherName={teacherName} onClose={() => setWriting(false)} onSent={(f) => setItems((cur) => [f, ...(cur ?? [])])} />}
    </section>
  );
}
