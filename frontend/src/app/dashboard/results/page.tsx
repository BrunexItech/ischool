"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, Result, SchoolClass, Student, Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function ResultsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [term, setTerm] = useState("Term 1 2026");
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [newSubject, setNewSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

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
  }

  async function handleSaveScores() {
    if (!token || !user?.school_id || subjectId === null) return;
    setSaving(true);
    setMessage(null);
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
      setMessage("Results saved.");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Failed to save results");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="p-6">
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Results</h1>

        <form onSubmit={handleAddSubject} className="mb-4 flex items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Add subject</label>
            <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g. English" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900">
            Add
          </button>
        </form>

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
            <select value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
            <select value={subjectId ?? ""} onChange={(e) => setSubjectId(Number(e.target.value))} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Term</label>
            <input value={term} onChange={(e) => setTerm(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button
            onClick={handleSaveScores}
            disabled={saving || students.length === 0 || subjectId === null}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save scores"}
          </button>
          {message && <p className="text-sm text-gray-600">{message}</p>}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Admission #</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Score (out of 100)</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{s.admission_number}</td>
                  <td className="px-4 py-2">{s.first_name} {s.last_name}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scores[s.id] ?? ""}
                      onChange={(e) => setScores((sc) => ({ ...sc, [s.id]: e.target.value }))}
                      className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    No students in this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
