"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { ApiError, api, LeadershipFeedback } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FeedbackItem } from "@/components/Feedback";
import { ErrorBox, PageHead } from "@/components/oversight";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function Reply({ f, onDone }: { f: LeadershipFeedback; onDone: (u: LeadershipFeedback) => void }) {
  const { user, token } = useAuth();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!token || !user?.school_id) return;
    setSaving(true);
    try {
      onDone(await api.acknowledgeFeedback(token, user.school_id, f.id, text.trim() || undefined));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Reply (optional)" aria-label="Your reply" />
      <Button className="h-10 self-start sm:h-9" onClick={submit} disabled={saving}>{saving ? <Spinner size={16} className="text-current" /> : <CheckCheck />} Mark as read{text.trim() ? " and reply" : ""}</Button>
    </div>
  );
}

export default function FeedbackPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [items, setItems] = useState<LeadershipFeedback[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const leader = user?.role === "head_of_institution" || user?.role === "group_principal" || user?.role === "super_admin";
  const teacher = user?.role === "teacher" || user?.role === "staff";
  const schoolId = user?.school_id;

  useEffect(() => {
    if (!loading && user && !leader && !teacher) router.replace("/dashboard");
  }, [loading, user, leader, teacher, router]);

  useEffect(() => {
    if (!token || !schoolId || (!leader && !teacher)) return;
    let live = true;
    api
      .listFeedback(token, schoolId)
      .then((rows) => {
        if (live) {
          setItems(rows);
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [token, schoolId, leader, teacher, reloadKey]);

  if (loading || !user) return <PageLoader />;
  if (failed) return <ErrorBox message="We couldn't load the feedback." onRetry={() => { setFailed(false); setItems(null); setReloadKey((k) => k + 1); }} />;
  if (!items) return <PageLoader />;

  const unread = items.filter((f) => f.status === "sent").length;
  const shown = onlyUnread ? items.filter((f) => f.status === "sent") : items;
  const viewer = leader ? "leader" : "teacher";

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        title="Feedback"
        subtitle={leader ? "What you have said to teachers about their work, and whether they have read it." : "Notes from school leadership about your work."}
      >
        {items.length > 0 && (
          <Button variant={onlyUnread ? "default" : "outline"} aria-pressed={onlyUnread} className="h-10 sm:h-9" onClick={() => setOnlyUnread((v) => !v)}>
            {leader ? "Not read yet" : "Needs reading"} ({unread})
          </Button>
        )}
      </PageHead>

      {shown.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-14 text-center">
          <p className="font-medium">{items.length === 0 ? (leader ? "You have not sent any feedback yet." : "No feedback yet.") : "Everything has been read."}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {leader ? "Open a teacher in the Teachers page to leave feedback on their work." : "When school leadership leaves you a note, it will appear here and in your notifications."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((f) => (
            <div key={f.id} className="flex flex-col gap-2">
              <FeedbackItem f={f} viewer={viewer} />
              {teacher && f.status === "sent" && <Reply f={f} onDone={(u) => setItems((cur) => (cur ? cur.map((x) => (x.id === u.id ? u : x)) : cur))} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
