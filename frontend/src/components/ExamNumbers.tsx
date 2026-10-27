"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { api, ApiError, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  ["upi_number", "UPI (NEMIS)", "e.g. the learner's unique personal identifier"],
  ["assessment_number", "Assessment number", "KNEC, for Grade 6 and Grade 9"],
  ["index_number", "Index number", "KNEC, for the end-of-secondary exam"],
  ["birth_certificate_number", "Birth certificate number", ""],
  ["nationality", "Nationality", "e.g. Kenyan"],
] as const;

type Key = (typeof FIELDS)[number][0];

/** The numbers a learner needs to sit national exams. All optional, and they can be filled in or corrected at any time. */
export function ExamNumbers({ student, canEdit, onUpdated }: { student: Student; canEdit: boolean; onUpdated: (s: Student) => void }) {
  const { token, user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<Key, string>>(() => Object.fromEntries(FIELDS.map(([k]) => [k, (student[k] as string | null | undefined) ?? ""])) as Record<Key, string>);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setBusy(true);
    try {
      const body = Object.fromEntries(FIELDS.map(([k]) => [k, form[k].trim() || null]));
      onUpdated(await api.updateStudent(token, user.school_id, student.id, body as Partial<Student>));
      toast.success("Exam details saved");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "We couldn't save those details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">National exam details</p>
        {canEdit && !editing && <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(true)}><Pencil /> {FIELDS.some(([k]) => student[k]) ? "Edit" : "Add"}</Button>}
      </div>
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-3">
          {FIELDS.map(([k, label, hint]) => (
            <div key={k} className="flex flex-col gap-1">
              <Label htmlFor={`exam-${k}`}>{label}</Label>
              <Input id={`exam-${k}`} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="h-10" />
              {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">All of these are optional. Add them when you have them.</p>
          <div className="flex gap-2"><Button type="submit" className="h-10" disabled={busy}>{busy && <Spinner size={16} className="text-current" />} Save</Button><Button type="button" variant="outline" className="h-10" onClick={() => setEditing(false)}>Cancel</Button></div>
        </form>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {FIELDS.map(([k, label]) => (
            <div key={k} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className={`font-medium break-words ${student[k] ? "" : "text-muted-foreground/70"}`}>{(student[k] as string | null | undefined) || "Not added yet"}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}
