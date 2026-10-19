"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, ExternalLink, FileUp } from "lucide-react";
import { api, ApiError, HomeworkDetail, HomeworkSubmissionRow } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const STATUS_STYLE: Record<string, { variant: "default" | "secondary" | "outline"; label: string; icon: typeof CheckCircle2 }> = {
  not_submitted: { variant: "outline", label: "Not submitted", icon: Circle },
  submitted: { variant: "secondary", label: "Submitted", icon: Clock },
  reviewed: { variant: "default", label: "Reviewed", icon: CheckCircle2 },
};

function ReviewDialog({
  schoolId,
  homeworkId,
  row,
  onReviewed,
}: {
  schoolId: number;
  homeworkId: number;
  row: HomeworkSubmissionRow;
  onReviewed: (row: HomeworkSubmissionRow) => void;
}) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(row.score !== null ? String(row.score) : "");
  const [comment, setComment] = useState(row.teacher_comment ?? "");
  const [saving, setSaving] = useState(false);

  async function markStatus(status: "submitted" | "reviewed" | "not_submitted") {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await api.reviewHomeworkSubmission(token, schoolId, homeworkId, row.student_id, {
        status,
        score: score ? Number(score) : undefined,
        teacher_comment: comment || undefined,
      });
      onReviewed(updated);
      toast.success(`${row.student_name} marked ${status.replace("_", " ")}`);
      if (status === "reviewed") setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Review</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>{row.student_name}</DialogTitle></DialogHeader>
        {row.file_url && (
          <a href={row.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ExternalLink className="size-3.5" /> View submitted photo
          </a>
        )}
        <div className="grid gap-1.5">
          <Label>Score (optional)</Label>
          <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Comment (optional)</Label>
          <Input value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {!row.file_url && (
            <Button type="button" variant="outline" disabled={saving} onClick={() => markStatus("submitted")}>
              Mark submitted (checked book)
            </Button>
          )}
          <Button type="button" disabled={saving} onClick={() => markStatus("reviewed")}>
            {saving ? "Saving..." : "Mark reviewed"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentCard({ hw, onAttached }: { hw: HomeworkDetail; onAttached: (url: string) => void }) {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!token || !file) return;
    setUploading(true);
    try {
      const updated = await api.uploadHomeworkAttachment(token, hw.school_id, hw.id, file);
      if (updated.attachment_url) onAttached(updated.attachment_url);
      setFile(null);
      toast.success("Worksheet attached");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to attach worksheet");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="flex items-center gap-2 text-sm">
          <FileUp className="size-4 text-muted-foreground" />
          {hw.attachment_url ? (
            <a href={hw.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
              Worksheet attached <ExternalLink className="size-3.5" />
            </a>
          ) : (
            <span className="text-muted-foreground">No worksheet attached yet</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-9 w-56 text-xs" />
          <Button size="sm" variant="outline" disabled={uploading || !file} onClick={handleUpload}>
            {uploading ? <Spinner size={14} className="text-current" /> : <FileUp />} {hw.attachment_url ? "Replace" : "Attach PDF"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HomeworkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [hw, setHw] = useState<HomeworkDetail | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && user && !["school_admin", "teacher", "staff", "super_admin", "supervisor"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.getHomework(token, user.school_id, Number(id)).then(setHw).finally(() => setDataLoading(false));
  }, [token, user?.school_id, id]);

  function handleReviewed(updated: HomeworkSubmissionRow) {
    setHw((h) => {
      if (!h) return h;
      const submissions = h.submissions.map((s) => (s.student_id === updated.student_id ? updated : s));
      return {
        ...h,
        submissions,
        submitted_count: submissions.filter((s) => s.status === "submitted" || s.status === "reviewed").length,
        reviewed_count: submissions.filter((s) => s.status === "reviewed").length,
      };
    });
  }

  if (loading || dataLoading) return <PageLoader />;
  if (!hw) return <p className="text-sm text-muted-foreground">Homework not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={hw.title}
        description={`Due ${new Date(hw.due_date + "T12:00:00").toLocaleDateString()} · ${hw.submitted_count} of ${hw.total_students} submitted, ${hw.reviewed_count} reviewed`}
      />
      {hw.instructions && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">{hw.instructions}</CardContent></Card>
      )}

      <AttachmentCard hw={hw} onAttached={(url) => setHw((h) => (h ? { ...h, attachment_url: url } : h))} />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hw.submissions.map((row) => {
              const style = STATUS_STYLE[row.status];
              const Icon = style.icon;
              return (
                <TableRow key={row.student_id}>
                  <TableCell className="font-medium">{row.student_name}</TableCell>
                  <TableCell>
                    <Badge variant={style.variant} className="gap-1"><Icon className="size-3" /> {style.label}</Badge>
                  </TableCell>
                  <TableCell>{row.score ?? "—"}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{row.teacher_comment ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <ReviewDialog schoolId={hw.school_id} homeworkId={hw.id} row={row} onReviewed={handleReviewed} />
                  </TableCell>
                </TableRow>
              );
            })}
            {hw.submissions.length === 0 && (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No students in this class yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
