"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, SchoolClass, Student, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save } from "lucide-react";

export default function ResultsPage() {
  const { user, token } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [term, setTerm] = useState("Term 1 2026");
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [newSubject, setNewSubject] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listClasses(token, user.school_id).then((cs) => {
      setClasses(cs);
      if (cs.length > 0) setClassId(cs[0].id);
    });
    api.listSubjects(token, user.school_id).then((ss) => {
      setSubjects(ss);
      if (ss.length > 0) setSubjectId(ss[0].id);
    });
  }, [token, user?.school_id]);

  useEffect(() => {
    if (!token || !user?.school_id || classId === null) return;
    api.listStudents(token, user.school_id, classId).then(setStudents);
  }, [token, user?.school_id, classId]);

  useEffect(() => {
    if (!token || !user?.school_id || subjectId === null || !term) return;
    api.listResults(token, user.school_id, { subject_id: subjectId, term }).then((results) => {
      const map: Record<number, string> = {};
      for (const r of results) map[r.student_id] = String(r.score);
      setScores(map);
    });
  }, [token, user?.school_id, subjectId, term]);

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !newSubject.trim()) return;
    const subject = await api.createSubject(token, user.school_id, newSubject.trim());
    setSubjects((s) => [...s, subject]);
    setSubjectId(subject.id);
    setNewSubject("");
    toast.success(`${subject.name} added`);
  }

  async function handleSaveScores() {
    if (!token || !user?.school_id || subjectId === null) return;
    setSaving(true);
    try {
      const entries = Object.entries(scores).filter(([, v]) => v !== "");
      for (const [studentId, score] of entries) {
        await api.upsertResult(token, user.school_id, {
          student_id: Number(studentId),
          subject_id: subjectId,
          term,
          score: Number(score),
        });
      }
      toast.success("Results saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to save results");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Results" description="Record subject scores and track grades by term." />

      <Card>
        <CardContent className="flex items-end gap-3 pt-6">
          <form onSubmit={handleAddSubject} className="flex items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Add subject</Label>
              <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g. English" className="w-48" />
            </div>
            <Button type="submit" variant="secondary"><Plus /> Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="grid gap-1.5">
            <Label>Class</Label>
            <Select value={classId ? String(classId) : ""} onValueChange={(v) => v && setClassId(Number(v))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Subject</Label>
            <Select value={subjectId ? String(subjectId) : ""} onValueChange={(v) => v && setSubjectId(Number(v))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Term</Label>
            <Input value={term} onChange={(e) => setTerm(e.target.value)} className="w-44" />
          </div>
          <Button onClick={handleSaveScores} disabled={saving || students.length === 0 || subjectId === null}>
            <Save /> {saving ? "Saving..." : "Save scores"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-40">Score (out of 100)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.admission_number}</TableCell>
                <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={scores[s.id] ?? ""}
                    onChange={(e) => setScores((sc) => ({ ...sc, [s.id]: e.target.value }))}
                    className="w-24"
                  />
                </TableCell>
              </TableRow>
            ))}
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No students in this class.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
