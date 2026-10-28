"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Clock, GraduationCap, MessageSquareWarning, School, Send, ShieldCheck } from "lucide-react";
import { api, ApiError, Complaint, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DepartmentPulse } from "@/components/DepartmentPulse";

const ROLES_ALLOWED = ["student", "parent", "teacher", "head_of_institution", "group_principal"];

function RespondBox({ complaint, canRespond, onResponded }: { complaint: Complaint; canRespond: boolean; onResponded: (c: Complaint) => void }) {
  const { token, user } = useAuth();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (complaint.status === "resolved") {
    return (
      <div className="mt-3 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-emerald-600" />
        <div className="min-w-0"><p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Answered{complaint.responded_at ? ` · ${new Date(complaint.responded_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}</p><p className="break-words">{complaint.response}</p></div>
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
    if (!token) return;
    if (!user?.school_id) {
      Promise.resolve().then(() => setDataLoading(false));   // no school to read from: show the empty page, never spin forever
      return;
    }
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

  const open = complaints.filter((c) => c.status !== "resolved").length;
  const choices = [
    { id: "class_teacher" as const, title: "Class teacher", note: "For day-to-day matters in the classroom", icon: GraduationCap },
    { id: "principal" as const, title: "Principal", note: "For serious or school-wide concerns", icon: School },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4A0E10] via-[#7F1D1D] to-[#B91C1C] p-5 text-white shadow-md sm:p-7">
        <div className="pointer-events-none absolute -top-14 -right-10 size-52 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Complaints and concerns</h1>
            <p className="mt-1 max-w-xl text-sm text-white/85">{user?.role === "teacher" ? "Raise a concern with the principal, and answer concerns sent to you as a class teacher." : isRecipient ? "Concerns sent to you, and your answers to them." : "Tell the school what worries you. Every message is read, and you will see the answer here."}</p>
          </div>
          <div className="flex gap-2.5">
            <div className="rounded-2xl bg-white/15 px-4 py-2.5 text-center backdrop-blur-sm"><p className="font-heading text-xl font-semibold tabular-nums">{open}</p><p className="text-[11px] tracking-wide text-white/75 uppercase">Waiting</p></div>
            <div className="rounded-2xl bg-white/15 px-4 py-2.5 text-center backdrop-blur-sm"><p className="font-heading text-xl font-semibold tabular-nums">{complaints.length - open}</p><p className="text-[11px] tracking-wide text-white/75 uppercase">Answered</p></div>
          </div>
        </div>
      </div>

      <DepartmentPulse dept="complaints" />

      <div className={`grid min-w-0 gap-6 ${canRaise ? "lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]" : ""}`}>
        {canRaise && (
          <form onSubmit={handleSubmit} className="flex h-fit min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5 lg:sticky lg:top-4">
            <div><h2 className="font-heading text-lg font-semibold">Raise a concern</h2><p className="text-sm text-muted-foreground">Be clear and kind. Include dates and names where you can.</p></div>
            {user?.role === "teacher" ? (
              <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm"><School className="size-4 text-muted-foreground" /> This goes to the principal.</p>
            ) : (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Who should read it?</legend>
                {choices.map((c) => {
                  const on = audience === c.id;
                  return (
                    <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${on ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-accent/50"}`}>
                      <input type="radio" name="audience" className="sr-only" checked={on} onChange={() => setForm((f) => ({ ...f, audience: c.id }))} />
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><c.icon className="size-5" /></span>
                      <span className="min-w-0"><span className="block font-medium">{c.title}</span><span className="block text-xs text-muted-foreground">{c.note}</span></span>
                    </label>
                  );
                })}
              </fieldset>
            )}
            {user?.role === "parent" && audience === "class_teacher" && (
              <div className="grid gap-1.5">
                <Label>Which child is this about?</Label>
                <Select value={form.student_id} onValueChange={(v) => v && setForm((f) => ({ ...f, student_id: v }))}>
                  <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choose a child" /></SelectTrigger>
                  <SelectContent>{children.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5"><Label>Subject</Label><Input required className="h-11" placeholder="In a few words" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></div>
            <div className="grid gap-1.5"><Label>Message</Label><Textarea required rows={4} placeholder="Tell us what happened and what you would like us to do" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} /></div>
            <Button type="submit" disabled={submitting} className="h-11 w-full gap-2">
              {submitting ? <Spinner size={16} className="text-current" /> : <Send />} {submitting ? "Sending..." : "Send to the school"}
            </Button>
            <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> Only the person you choose and school leadership can read this.</p>
          </form>
        )}

        <section className="flex min-w-0 flex-col gap-3" aria-label="Concerns">
          <h2 className="font-heading text-lg font-semibold">{isRecipient ? "Concerns" : "Your concerns"}</h2>
          {complaints.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><MessageSquareWarning className="size-5" /></span>
              <p className="font-medium">Nothing here yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">{canRaise ? "When you raise a concern it appears here, with the school's answer once it comes." : "Concerns sent to you will appear here."}</p>
            </div>
          ) : complaints.map((c) => {
            const done = c.status === "resolved";
            return (
              <article key={c.id} className={`min-w-0 rounded-2xl border bg-card p-4 shadow-xs sm:p-5 ${done ? "" : "border-l-4 border-l-amber-400"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="min-w-0 flex-1 font-heading text-base font-semibold break-words">{c.subject}</h3>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${done ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"}`}>{done ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />} {done ? "Answered" : "Waiting for an answer"}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  To {c.audience === "principal" ? "the principal" : "the class teacher"}{isRecipient ? ` · ${c.raised_by === user?.id ? "Raised by you" : `From ${c.raised_by_name} (${c.raised_by_role})`}` : ""} · {new Date(c.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <p className="mt-3 text-sm break-words whitespace-pre-line">{c.message}</p>
                <RespondBox complaint={c} canRespond={isRecipient && c.raised_by !== user?.id} onResponded={(u) => setComplaints((all) => all.map((x) => (x.id === u.id ? u : x)))} />
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
