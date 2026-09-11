"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, Staff } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function StaffPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "teacher" as "teacher" | "staff",
    staff_number: "",
    department: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || (user.role !== "school_admin" && user.role !== "super_admin"))) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listStaff(token, user.school_id).then(setStaff).catch(() => setStaff([]));
  }, [token, user?.school_id]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createStaff(token, user.school_id, {
        email: form.email,
        full_name: form.full_name,
        password: form.password,
        role: form.role,
        staff_number: form.staff_number,
        department: form.department || undefined,
        phone: form.phone || undefined,
      });
      setStaff((s) => [...s, created]);
      setForm({ email: "", full_name: "", password: "", role: "teacher", staff_number: "", department: "", phone: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add staff member");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="p-6">
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Staff</h1>

        <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-3">
          <h3 className="col-span-2 text-sm font-medium text-gray-900 sm:col-span-3">Add a teacher or staff member</h3>
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input required placeholder="Full name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input required type="password" placeholder="Temporary password" value={form.password} onChange={(e) => set("password", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => set("role", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="teacher">Teacher</option>
            <option value="staff">Staff</option>
          </select>
          <input required placeholder="Staff number" value={form.staff_number} onChange={(e) => set("staff_number", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input placeholder="Department" value={form.department} onChange={(e) => set("department", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />

          {error && <p className="col-span-2 text-sm text-red-600 sm:col-span-3">{error}</p>}

          <button disabled={submitting} type="submit" className="col-span-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:col-span-3">
            {submitting ? "Adding..." : "Add staff member"}
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Staff #</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{s.staff_number}</td>
                  <td className="px-4 py-2">{s.full_name}</td>
                  <td className="px-4 py-2 capitalize text-gray-500">{s.role}</td>
                  <td className="px-4 py-2 text-gray-500">{s.department ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{s.email}</td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    No staff added yet.
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
