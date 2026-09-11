"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, SchoolClass, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function StudentsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [form, setForm] = useState({
    admission_number: "",
    first_name: "",
    last_name: "",
    class_id: "",
    guardian_name: "",
    guardian_phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canEnroll = user?.role === "school_admin" || user?.role === "staff" || user?.role === "super_admin";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listStudents(token, user.school_id).then(setStudents).catch(() => setStudents([]));
    api.listClasses(token, user.school_id).then(setClasses).catch(() => setClasses([]));
  }, [token, user?.school_id]);

  function classNameFor(classId: number | null) {
    if (!classId) return "—";
    return classes.find((c) => c.id === classId)?.name ?? `#${classId}`;
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createStudent(token, user.school_id, {
        admission_number: form.admission_number,
        first_name: form.first_name,
        last_name: form.last_name,
        class_id: form.class_id ? Number(form.class_id) : undefined,
        guardian_name: form.guardian_name || undefined,
        guardian_phone: form.guardian_phone || undefined,
      });
      setStudents((s) => [...s, created]);
      setForm({ admission_number: "", first_name: "", last_name: "", class_id: "", guardian_name: "", guardian_phone: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to enroll student");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="p-6">
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Students</h1>

        {canEnroll && (
          <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-3">
            <h3 className="col-span-2 text-sm font-medium text-gray-900 sm:col-span-3">Enroll a student</h3>
            <input required placeholder="Admission number" value={form.admission_number} onChange={(e) => set("admission_number", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input required placeholder="First name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input required placeholder="Last name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <select value={form.class_id} onChange={(e) => set("class_id", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">No class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input placeholder="Guardian name" value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Guardian phone" value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />

            {error && <p className="col-span-2 text-sm text-red-600 sm:col-span-3">{error}</p>}

            <button disabled={submitting} type="submit" className="col-span-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:col-span-3">
              {submitting ? "Enrolling..." : "Enroll student"}
            </button>
          </form>
        )}

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Admission #</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Class</th>
                <th className="px-4 py-2 font-medium">Guardian</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{s.admission_number}</td>
                  <td className="px-4 py-2">{s.first_name} {s.last_name}</td>
                  <td className="px-4 py-2 text-gray-500">{classNameFor(s.class_id)}</td>
                  <td className="px-4 py-2 text-gray-500">{s.guardian_name ?? "—"}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No students enrolled yet.
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
