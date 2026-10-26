"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquareWarning, Send } from "lucide-react";
import { api, ApiError, Complaint, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLES_ALLOWED = ["student", "parent", "teacher", "head_of_institution", "super_admin", "group_principal"];

function RespondBox({ complaint, canRespond, onResponded }: { complaint: Complaint; canRespond: boolean; onResponded: (c: Complaint) => void }) {
  const { token, user } = useAuth();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (complaint.status === "resolved") {
    return (
      <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
        <p className="text-xs font-medium text-muted-foreground">Response</p>
        <p>{complaint.response}</p>
      </div>
    );
  }

  if (!canRespond || !user?.school_id) return null;

  async function submit() {
    if (!token || !user?.school_id || !text.trim()) return;
    setSubmitting(true);
    try {
      const updated = await api.respondToComplaint(token, user.school_id, complaint.id, text.trim());
      onResponded(updated);
      toast.success("Response sent");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to respond");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <Textarea rows={2} placeholder="Write a response..." value={text} onChange={(e) => setText(e.target.value)} className="flex-1" />
      <Button size="sm" disabled={submitting || !text.trim()} onClick={submit} className="sm:self-end">
        {submitting ? <Spinner size={14} className="text-current" /> : <Send />} Respond
      </Button>
    </div>
  );
}

export default function ComplaintsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [children, setChildren] = useState<Student[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ audience: "class_teacher" as "class_teacher" | "principal", subject: "", message: "", student_id: "" });

  // A teacher can only write to the principal, so there is nothing to choose
  // and "Class teacher" must never appear (or be the hidden default).
  const audience: "class_teacher" | "principal" = user?.role === "teacher" ? "principal" : form.audience;
  const isRecipient = user?.role === "teacher" || user?.role === "head_of_institution" || user?.role === "super_admin" || user?.role === "group_principal";
  const canRaise = user?.role === "student" || user?.role === "parent" || user?.role === "teacher";

  useEffect(() => {
    if (!loading && user && !ROLES_ALLOWED.includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  function reload() {
    if (!token || !user?.school_id) return;
    api.listComplaints(token, user.school_id).then(setComplaints).finally(() => setDataLoading(false));
  }
  useEffect(reload, [token, user?.school_id]);

  useEffect(() => {
    if (!token || user?.role !== "parent") return;
    api.listMyChildren(token).then(setChildren).catch(() => setChildren([]));
  }, [token, user?.role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.subject.trim() || !form.message.trim()) return;
    if (user.role === "parent" && audience === "class_teacher" && !form.student_id) {
      toast.error("Choose which child this is about");
      return;
    }
    setSubmitting(true);
    try {
      await api.raiseComplaint(token, user.school_id, {
        audience,
        subject: form.subject.trim(),
        message: form.message.trim(),
        student_id: form.student_id ? Number(form.student_id) : undefined,
      });
      setForm({ audience: "class_teacher", subject: "", message: "", student_id: "" });
      toast.success("Sent");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || dataLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Complaints" description={user?.role === "teacher" ? "Raise a concern with the principal, and answer concerns sent to you as a class teacher." : isRecipient ? "Concerns sent to you, and your replies." : "Raise a concern with the class teacher or the principal, and track the response."} />

      {canRaise && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Send to</Label>
                  {user?.role === "teacher" ? (
                    <p className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 text-sm">Principal</p>
                  ) : (
                  <Select value={form.audience} onValueChange={(v) => v && setForm((f) => ({ ...f, audience: v as "class_teacher" | "principal" }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="class_teacher">Class teacher</SelectItem>
                      <SelectItem value="principal">Principal</SelectItem>
                    </SelectContent>
                  </Select>
                  )}
                </div>
                {user?.role === "parent" && audience === "class_teacher" && (
                  <div className="grid gap-1.5">
                    <Label>Child</Label>
                    <Select value={form.student_id} onValueChange={(v) => v && setForm((f) => ({ ...f, student_id: v }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Choose a child" /></SelectTrigger>
                      <SelectContent>
                        {children.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.first_name} {c.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label>Subject</Label>
                <Input required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Message</Label>
                <Textarea required rows={3} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
              </div>
              <Button type="submit" disabled={submitting} className="w-fit">
                {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Sending..." : "Send"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {complaints.map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquareWarning className="size-4 text-muted-foreground" />
                  <p className="font-medium">{c.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{c.audience.replace("_", " ")}</Badge>
                  <Badge variant={c.status === "resolved" ? "secondary" : "outline"} className="capitalize">{c.status}</Badge>
                </div>
              </div>
              {isRecipient && <p className="mt-1 text-xs text-muted-foreground">{c.raised_by === user?.id ? "Raised by you" : `From ${c.raised_by_name} (${c.raised_by_role})`} · {new Date(c.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
              <p className="mt-2 text-sm">{c.message}</p>
              <RespondBox complaint={c} canRespond={isRecipient && c.raised_by !== user?.id} onResponded={(u) => setComplaints((all) => all.map((x) => (x.id === u.id ? u : x)))} />
            </CardContent>
          </Card>
        ))}
        {complaints.length === 0 && <p className="text-sm text-muted-foreground">No complaints yet.</p>}
      </div>
    </div>
  );
}
