"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Printer, Save } from "lucide-react";
import { api, AcademicTerm, ApiError, GradingBand, ReportCard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STAFF_ROLES = ["head_of_institution", "teacher", "staff", "super_admin", "group_principal"];
const HEAD_ROLES = ["head_of_institution", "super_admin", "group_principal"];

// Milai's own colours: maroon and gold. Performance levels use warm, non-blue tones.
const MAROON = "#8B1A1D";
const GOLD = "#FFA819";
const LEVEL_TONES = [
  { bg: "#DCFCE7", fg: "#166534", bd: "#86EFAC" },
  { bg: "#FEF3C7", fg: "#92400E", bd: "#FCD34D" },
  { bg: "#FFEDD5", fg: "#9A3412", bd: "#FDBA74" },
  { bg: "#FFE4E6", fg: "#9F1239", bd: "#FDA4AF" },
];
const DEFAULT_ORDER = ["EE", "ME", "AE", "BE"];

function levelTone(code: string | null, bands: GradingBand[]) {
  if (!code) return null;
  const i = bands.length ? bands.findIndex((b) => b.level_code === code) : DEFAULT_ORDER.indexOf(code);
  return i < 0 ? { bg: "#F3F4F6", fg: "#374151", bd: "#D1D5DB" } : LEVEL_TONES[i % LEVEL_TONES.length];
}

function LevelPill({ code, bands }: { code: string | null; bands: GradingBand[] }) {
  const tone = levelTone(code, bands);
  if (!code || !tone) return <span className="text-neutral-400">—</span>;
  return (
    <span className="inline-flex min-w-9 items-center justify-center rounded-md border px-2 py-0.5 text-xs font-bold" style={{ background: tone.bg, color: tone.fg, borderColor: tone.bd }}>
      {code}
    </span>
  );
}

function RemarkBlock({
  label,
  role,
  value,
  editable,
  onSave,
}: {
  label: string;
  role: string;
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
    } catch {
      /* the error is shown by the caller; stay in edit mode */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-md border border-neutral-300 p-4 print:break-inside-avoid">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.7rem] font-bold tracking-wider uppercase" style={{ color: MAROON }}>{label}</p>
        {editable && !editing && (
          <Button type="button" variant="outline" size="sm" className="h-8 print:hidden" onClick={() => { setDraft(value ?? ""); setEditing(true); }}>
            <Pencil /> {value ? "Edit" : "Write remark"}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2 print:hidden">
          <Textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={1000} placeholder={`Write the ${label.toLowerCase()}...`} />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={saving} onClick={handleSave}>
                {saving ? <Spinner size={14} className="text-current" /> : <Save />} Save remark
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            </div>
            <span className="text-xs text-neutral-500 tabular-nums">{draft.length}/1000</span>
          </div>
        </div>
      ) : (
        <p className="min-h-16 text-sm leading-relaxed break-words text-neutral-800 italic">
          {value || <span className="text-neutral-400 not-italic">{editable ? "No remark written yet." : "No remark recorded."}</span>}
        </p>
      )}
      <div className="mt-2 flex items-end justify-between gap-4 border-t border-dashed border-neutral-400 pt-2 text-[0.7rem] text-neutral-600">
        <span>{role}: ______________________</span>
        <span>Date: ____________</span>
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
  const isHead = !!user && HEAD_ROLES.includes(user.role);

  const [terms, setTerms] = useState<string[]>([]);
  const [term, setTerm] = useState("");
  const [card, setCard] = useState<ReportCard | null>(null);
  const [bands, setBands] = useState<GradingBand[]>([]);
  const [homeroomClasses, setHomeroomClasses] = useState<string[]>([]);
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
      api.listGradingBands(token, user.school_id).then(setBands).catch(() => undefined);
      if (user.role === "teacher") {
        api
          .listMyClasses(token, user.school_id)
          .then((mine) => setHomeroomClasses(mine.filter((c) => c.is_homeroom_teacher).map((c) => c.class_name)))
          .catch(() => undefined);
      }
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
  }, [token, isStaff, user?.school_id, user?.role, studentId]);

  function loadCard() {
    if (!token || !term) return;
    const fetcher =
      isStaff && user?.school_id
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

  // The head, principal and super admin can write both remarks; a teacher only
  // the class teacher's remark, and only for the class they are class teacher of.
  const canEditHead = isHead;
  const canEditClassTeacher = isHead || (user?.role === "teacher" && !!card?.class_name && homeroomClasses.includes(card.class_name));
  const issued = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const th = "border border-neutral-300 px-3 py-2 text-left text-[0.7rem] font-bold tracking-wider text-white uppercase";
  const td = "border border-neutral-300 px-3 py-2 align-top";

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-5 print:max-w-none">
      <style>{`@media print { @page { size: A4 portrait; margin: 9mm; } .report-card, .report-card * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <BackButton fallback="/dashboard" label="Back" />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Select value={term} onValueChange={(v) => v && setTerm(v)}>
          <SelectTrigger className="h-10 w-56"><SelectValue placeholder="Choose a term" /></SelectTrigger>
          <SelectContent>
            {terms.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button className="h-10 sm:h-9" onClick={() => window.print()} disabled={!card}><Printer /> Print report card</Button>
      </div>

      {!card && <p className="text-center text-sm text-muted-foreground">No results recorded for this term yet.</p>}

      {card && (
        <article className="report-card overflow-hidden border border-neutral-300 bg-white text-neutral-900 shadow-sm print:border-0 print:shadow-none">
          <div className="h-2" style={{ background: MAROON }} />
          <div className="h-0.5" style={{ background: GOLD }} />

          <div className="flex flex-col gap-6 p-5 sm:p-9 print:p-3">
            {/* Letterhead */}
            <header className="flex flex-col items-center gap-4 border-b-2 pb-5 text-center sm:flex-row sm:justify-between sm:text-left" style={{ borderColor: MAROON }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/Milai-School-Logo.svg" alt={card.school_name} className="h-20 w-auto sm:h-24" />
              <div className="sm:text-right">
                <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl" style={{ color: MAROON }}>{card.school_name}</h1>
                <p className="mt-1 text-xs font-bold tracking-[0.22em] uppercase">Learner Progress Report</p>
                <p className="mt-0.5 text-sm text-neutral-600">{card.term}</p>
                {examTypes.length > 0 && <p className="text-xs text-neutral-500">Compiled from {examTypes.join(", ")}</p>}
              </div>
            </header>

            {/* Learner details */}
            <section className="grid grid-cols-2 gap-x-6 gap-y-3 border border-neutral-300 p-4 text-sm sm:grid-cols-3" aria-label="Learner details">
              {[
                ["Learner", card.student_name],
                ["Admission no.", card.admission_number],
                ["Class", card.class_name ?? "—"],
                ["Term", card.term],
                ["Class position", card.class_position ?? "—"],
                ["Attendance", card.attendance_rate != null ? `${card.attendance_rate}%` : "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[0.65rem] font-semibold tracking-wider text-neutral-500 uppercase">{k}</p>
                  <p className="font-semibold break-words">{v}</p>
                </div>
              ))}
            </section>

            {/* Subjects */}
            <section aria-label="Subject results">
              <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[30rem] border-collapse text-sm print:min-w-0">
                <thead>
                  <tr style={{ background: MAROON }}>
                    <th className={`${th} w-10`}>No.</th>
                    <th className={th}>Subject</th>
                    <th className={`${th} w-20 text-right`}>Score</th>
                    <th className={`${th} w-20 text-center`}>Level</th>
                    <th className={th}>Teacher&apos;s remark</th>
                  </tr>
                </thead>
                <tbody>
                  {card.rows.map((r, i) => (
                    <tr key={r.subject_name} className={i % 2 ? "bg-neutral-50" : ""}>
                      <td className={`${td} text-neutral-500 tabular-nums`}>{i + 1}</td>
                      <td className={`${td} font-medium`}>{r.subject_name}</td>
                      <td className={`${td} text-right font-semibold tabular-nums`}>{r.score}</td>
                      <td className={`${td} text-center`}><LevelPill code={r.grade} bands={bands} /></td>
                      <td className={`${td} break-words text-neutral-600`}>{r.remarks ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {bands.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-neutral-600">
                  <strong>Key:</strong>
                  {bands.map((b) => (
                    <span key={b.id}>
                      <strong>{b.level_code}</strong> {b.label} ({Number(b.min_score)}–{Number(b.max_score)})
                    </span>
                  ))}
                </p>
              )}
            </section>

            {card.competency_assessments.length > 0 && (
              <section className="border border-neutral-300 p-4 print:break-inside-avoid" aria-label="Competency assessment">
                <p className="mb-2 text-[0.7rem] font-bold tracking-wider uppercase" style={{ color: MAROON }}>Competency assessment</p>
                <ul className="flex flex-col gap-2">
                  {card.competency_assessments.map((c) => (
                    <li key={c.id} className="border-b border-neutral-200 pb-2 text-sm last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{c.strand}{c.sub_strand ? ` · ${c.sub_strand}` : ""}</p>
                        <span className="text-xs font-semibold text-neutral-600 capitalize">{c.performance_level.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-xs text-neutral-500">{c.criterion}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Overall */}
            <section className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-white print:break-inside-avoid" style={{ background: MAROON }}>
              <span className="text-xs font-bold tracking-[0.2em] uppercase">Overall performance</span>
              <span className="flex items-baseline gap-3">
                <span className="font-heading text-3xl font-bold tabular-nums" style={{ color: GOLD }}>{card.average ?? "—"}</span>
                {card.overall_grade && <span className="rounded-md border border-white/40 px-2.5 py-0.5 text-sm font-bold">{card.overall_grade}</span>}
              </span>
            </section>

            {/* Remarks */}
            <section className="flex flex-col gap-4 sm:flex-row" aria-label="Remarks">
              <RemarkBlock
                key={`ct-${card.term}-${card.class_teacher_remark ?? ""}`}
                label="Class teacher's remarks"
                role="Class teacher"
                value={card.class_teacher_remark}
                editable={canEditClassTeacher}
                onSave={(text) => saveRemark("class_teacher_remark", text)}
              />
              <RemarkBlock
                key={`hd-${card.term}-${card.principal_remark ?? ""}`}
                label="Head of institution's remarks"
                role="Head of institution"
                value={card.principal_remark}
                editable={canEditHead}
                onSave={(text) => saveRemark("principal_remark", text)}
              />
            </section>
            {user?.role === "teacher" && !canEditClassTeacher && (
              <p className="text-xs text-muted-foreground print:hidden">Only this class&apos;s class teacher can write the class teacher&apos;s remarks.</p>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t-2 pt-3 text-[0.7rem] text-neutral-600" style={{ borderColor: GOLD }}>
              <span className="font-semibold tracking-[0.18em] uppercase" style={{ color: MAROON }}>Nurture With Excellence</span>
              <span>Official record of {card.school_name} · Issued {issued}</span>
            </footer>
          </div>
        </article>
      )}
    </div>
  );
}
