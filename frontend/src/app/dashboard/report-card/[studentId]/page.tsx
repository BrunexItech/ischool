"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck2, Printer, Save, Trophy } from "lucide-react";
import { api, AcademicTerm, ApiError, ReportCard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const STAFF_ROLES = ["head_of_institution", "teacher", "staff", "super_admin", "group_principal"];

const GRADE_STYLE: Record<string, string> = {
  A: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  B: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  C: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  D: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  E: "bg-red-500/10 text-red-700 border-red-500/30",
};

function GradePill({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-muted-foreground">—</span>;
  const cls = GRADE_STYLE[grade] ?? "bg-muted text-foreground border-border";
  return (
    <span className={`inline-flex size-7 items-center justify-center rounded-full border text-xs font-bold ${cls}`}>
      {grade}
    </span>
  );
}

function RemarkBlock({
  label,
  value,
  editable,
  onSave,
}: {
  label: string;
  value: string | null;
  editable: boolean;
  onSave: (text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        {editable && !editing && (
          <button type="button" onClick={() => { setDraft(value ?? ""); setEditing(true); }} className="text-[0.65rem] font-medium text-primary hover:underline print:hidden">
            {value ? "Edit" : "Add remark"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2 print:hidden">
          <Textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder={`Write the ${label.toLowerCase()}...`} />
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={handleSave}>
              {saving ? <Spinner size={14} className="text-current" /> : <Save className="size-3.5" />} Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="min-h-10 text-sm leading-relaxed text-foreground/90 italic">
          {value || <span className="text-muted-foreground not-italic">No remark recorded.</span>}
        </p>
      )}
      <div className="mt-3 flex items-end justify-between border-t border-dashed border-border pt-2 text-[0.65rem] text-muted-foreground">
        <span>Signature: __________________</span>
        <span>Date: __________</span>
      </div>
    </div>
  );
}

export default function ReportCardPage({ params }: { params: Promise<{ studentId: string }> }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <ReportCardView params={params} />
    </Suspense>
  );
}

function ReportCardView({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const examTypesParam = searchParams.get("exam_types") ?? "";
  const examTypes = useMemo(() => examTypesParam.split(",").map((t) => t.trim()).filter(Boolean), [examTypesParam]);
  const { user, token, loading } = useAuth();
  const isStaff = !!user && STAFF_ROLES.includes(user.role);
  const canEditPrincipalRemark = user?.role === "head_of_institution" || user?.role === "super_admin";
  const canEditClassTeacherRemark = canEditPrincipalRemark || user?.role === "teacher";

  const [terms, setTerms] = useState<string[]>([]);
  const [term, setTerm] = useState("");
  const [card, setCard] = useState<ReportCard | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    if (isStaff && user?.school_id) {
      api
        .listAcademicTerms(token, user.school_id)
        .then((ts: AcademicTerm[]) => {
          setTerms(ts.map((t) => t.name));
          const current = ts.find((t) => t.is_current);
          setTerm(current?.name ?? ts[0]?.name ?? "");
        })
        .finally(() => setDataLoading(false));
    } else if (!isStaff) {
      api
        .getChildResults(token, Number(studentId))
        .then((results) => {
          const uniqueTerms = Array.from(new Set(results.map((r) => r.term)));
          setTerms(uniqueTerms);
          setTerm(uniqueTerms[0] ?? "");
        })
        .finally(() => setDataLoading(false));
    }
  }, [token, isStaff, user?.school_id, studentId]);

  function loadCard() {
    if (!token || !term) return;
    const fetcher = isStaff && user?.school_id
      ? api.getReportCard(token, user.school_id, Number(studentId), term, examTypes)
      : api.getChildReportCard(token, Number(studentId), term);
    fetcher.then(setCard).catch(() => setCard(null));
  }

  useEffect(loadCard, [token, term, isStaff, user?.school_id, studentId, examTypes]);

  async function saveRemark(field: "class_teacher_remark" | "principal_remark", text: string) {
    if (!token || !user?.school_id) return;
    try {
      const updated = await api.updateReportCardRemarks(token, user.school_id, Number(studentId), term, { [field]: text });
      // Keep the compiled marks on screen; only the remark text changes.
      setCard((c) => (c ? { ...c, class_teacher_remark: updated.class_teacher_remark, principal_remark: updated.principal_remark } : updated));
      toast.success("Remark saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save remark");
      throw err;
    }
  }

  if (loading || dataLoading) return <PageLoader />;

  const accent = card?.school_primary_color || "#1D4ED8";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 print:max-w-none">
      <BackButton fallback="/dashboard" label="Back" />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Select value={term} onValueChange={(v) => v && setTerm(v)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Choose a term" /></SelectTrigger>
          <SelectContent>
            {terms.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => window.print()} disabled={!card}><Printer /> Print</Button>
      </div>

      {!card && <p className="text-center text-sm text-muted-foreground">No results recorded for this term yet.</p>}

      {card && (
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm print:rounded-none print:border-none print:shadow-none">
          <div className="h-2" style={{ backgroundColor: accent }} />

          <div className="flex flex-col gap-6 p-8 sm:p-10">
            {/* Letterhead */}
            <div className="flex flex-col items-center gap-3 border-b border-border pb-6 text-center">
              {
                // The school's official logo, shipped with the app.
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/Milai-School-Logo.svg" alt={card.school_name} className="h-20 w-auto" />
              }
              <div>
                <h1 className="font-heading text-xl font-bold tracking-tight">{card.school_name}</h1>
                <p className="mt-1 text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">Official Academic Report</p>
                {examTypes.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Compiled from: {examTypes.join(", ")}</p>}
              </div>
            </div>

            {/* Student info */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-border bg-muted/20 p-5 text-sm sm:grid-cols-3">
              <div><p className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">Student</p><p className="font-semibold">{card.student_name}</p></div>
              <div><p className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">Admission #</p><p className="font-semibold">{card.admission_number}</p></div>
              <div><p className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">Class</p><p className="font-semibold">{card.class_name ?? "—"}</p></div>
              <div><p className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">Term</p><p className="font-semibold">{card.term}</p></div>
              <div><p className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">Class position</p><p className="font-semibold">{card.class_position ?? "—"}</p></div>
              <div><p className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">Attendance</p><p className="font-semibold">{card.attendance_rate != null ? `${card.attendance_rate}%` : "—"}</p></div>
            </div>

            {/* Subjects */}
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead>Teacher&apos;s remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {card.rows.map((r) => (
                    <TableRow key={r.subject_name}>
                      <TableCell className="font-medium">{r.subject_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.score}</TableCell>
                      <TableCell className="text-center"><GradePill grade={r.grade} /></TableCell>
                      <TableCell className="text-muted-foreground">{r.remarks ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {card.competency_assessments.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
                <p className="text-sm font-semibold">Competency assessment</p>
                {card.competency_assessments.map((c) => (
                  <div key={c.id} className="rounded-lg border p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{c.strand}{c.sub_strand ? ` · ${c.sub_strand}` : ""}</p>
                      <span className="text-xs font-medium text-muted-foreground capitalize">{c.performance_level.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.criterion}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Overall */}
            <div className="flex items-center justify-between rounded-lg px-5 py-4 text-white" style={{ backgroundColor: accent }}>
              <div className="flex items-center gap-2">
                <Trophy className="size-5" />
                <span className="text-sm font-medium opacity-90">Overall average</span>
              </div>
              <span className="font-heading text-2xl font-bold tabular-nums">{card.average ?? "—"} {card.overall_grade && `(${card.overall_grade})`}</span>
            </div>

            {/* Remarks */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <RemarkBlock
                label="Class teacher's remark"
                value={card.class_teacher_remark}
                editable={canEditClassTeacherRemark}
                onSave={(text) => saveRemark("class_teacher_remark", text)}
              />
              <RemarkBlock
                label="Head teacher's remark"
                value={card.principal_remark}
                editable={canEditPrincipalRemark}
                onSave={(text) => saveRemark("principal_remark", text)}
              />
            </div>

            <div className="flex items-center gap-1.5 border-t border-border pt-4 text-[0.65rem] text-muted-foreground">
              <CalendarCheck2 className="size-3.5" />
              This is an official academic record issued by {card.school_name} via Milai School.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
