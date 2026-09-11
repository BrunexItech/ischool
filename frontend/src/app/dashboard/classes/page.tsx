"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, SchoolClass } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function ClassesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role === "school_admin" || user?.role === "super_admin";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listClasses(token, user.school_id).then(setClasses).catch(() => setClasses([]));
  }, [token, user?.school_id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createClass(token, user.school_id, {
        name,
        grade_level: gradeLevel || undefined,
      });
      setClasses((c) => [...c, created]);
      setName("");
      setGradeLevel("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create class");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="p-6">
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Classes</h1>

        {canManage && (
          <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Class name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Form 1A" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Grade level</label>
              <input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="Form 1" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <button disabled={submitting} type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {submitting ? "Adding..." : "Add class"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Grade level</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500">{c.grade_level ?? "—"}</td>
                </tr>
              ))}
              {classes.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                    No classes yet.
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
