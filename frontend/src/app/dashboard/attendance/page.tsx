"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, AttendanceStatus, SchoolClass, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "absent", "late", "excused"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
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
  }, [token, user?.school_id]);

  useEffect(() => {
    if (!token || !user?.school_id || classId === null) return;
    api.listStudents(token, user.school_id, classId).then(setStudents);
    api.listAttendance(token, user.school_id, classId, date).then((records) => {
      const map: Record<number, AttendanceStatus> = {};
      for (const r of records) map[r.student_id] = r.status;
      setStatuses(map);
    });
  }, [token, user?.school_id, classId, date]);

  const roster = useMemo(() => students, [students]);

  function setStatus(studentId: number, status: AttendanceStatus) {
    setStatuses((s) => ({ ...s, [studentId]: status }));
  }

  async function handleSave() {
    if (!token || !user?.school_id || classId === null) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.markAttendance(token, user.school_id, {
        class_id: classId,
        date,
        records: roster.map((s) => ({ student_id: s.id, status: statuses[s.id] ?? "present" })),
      });
      setMessage("Attendance saved.");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="p-6">
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Attendance</h1>

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
            <select
              value={classId ?? ""}
              onChange={(e) => setClassId(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || roster.length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save attendance"}
          </button>
          {message && <p className="text-sm text-gray-600">{message}</p>}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Admission #</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{s.admission_number}</td>
                  <td className="px-4 py-2">{s.first_name} {s.last_name}</td>
                  <td className="px-4 py-2">
                    <select
                      value={statuses[s.id] ?? "present"}
                      onChange={(e) => setStatus(s.id, e.target.value as AttendanceStatus)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm capitalize"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {roster.length === 0 && (
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
