"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, ModuleToggle, School } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const MODULE_LABELS: Record<string, string> = {
  students_staff: "Students & Staff",
  attendance: "Attendance",
  results: "Results",
  fees: "Fees",
  live_classes: "Live Classes",
  communication: "Communication",
};

function OnboardForm({ onCreated }: { onCreated: (school: School) => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    country: "Kenya",
    currency: "KES",
    timezone: "Africa/Nairobi",
    admin_email: "",
    admin_full_name: "",
    admin_password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const school = await api.onboardSchool(token, form);
      onCreated(school);
      setForm({ ...form, name: "", slug: "", admin_email: "", admin_full_name: "", admin_password: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to onboard school");
    } finally {
      setSubmitting(false);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="col-span-2 text-base font-medium text-gray-900">Onboard a new school</h3>

      <input required placeholder="School name" value={form.name} onChange={(e) => set("name", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
      <input required placeholder="Slug (subdomain)" value={form.slug} onChange={(e) => set("slug", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
      <input required placeholder="Admin full name" value={form.admin_full_name} onChange={(e) => set("admin_full_name", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
      <input required type="email" placeholder="Admin email" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
      <input required type="password" placeholder="Admin password" value={form.admin_password} onChange={(e) => set("admin_password", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
      <input placeholder="Currency" value={form.currency} onChange={(e) => set("currency", e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />

      {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}

      <button disabled={submitting} type="submit" className="col-span-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
        {submitting ? "Creating..." : "Create school"}
      </button>
    </form>
  );
}

function ModulesPanel({ school }: { school: School }) {
  const { token } = useAuth();
  const [modules, setModules] = useState<ModuleToggle[]>([]);

  useEffect(() => {
    if (!token) return;
    api.listModules(token, school.id).then(setModules).catch(() => setModules([]));
  }, [token, school.id]);

  async function toggle(moduleKey: string, enabled: boolean) {
    if (!token) return;
    const updated = await api.toggleModule(token, school.id, moduleKey, enabled);
    setModules((mods) => mods.map((m) => (m.module_key === moduleKey ? updated : m)));
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {modules.map((m) => (
        <label key={m.module_key} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
          <input type="checkbox" checked={m.enabled} onChange={(e) => toggle(m.module_key, e.target.checked)} />
          {MODULE_LABELS[m.module_key] ?? m.module_key}
        </label>
      ))}
    </div>
  );
}

export default function AdminSchoolsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "super_admin")) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token) return;
    api.listSchools(token).then(setSchools).catch(() => setSchools([]));
  }, [token]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Schools</h1>

      <div className="mb-6">
        <OnboardForm onCreated={(school) => setSchools((s) => [...s, school])} />
      </div>

      <div className="space-y-3">
        {schools.map((school) => (
          <div key={school.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <button
              onClick={() => setExpanded(expanded === school.id ? null : school.id)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <p className="font-medium text-gray-900">{school.name}</p>
                <p className="text-sm text-gray-500">{school.slug} · {school.country} · {school.currency}</p>
              </div>
              <span className="text-sm text-gray-400">{expanded === school.id ? "Hide modules" : "Manage modules"}</span>
            </button>
            {expanded === school.id && <ModulesPanel school={school} />}
          </div>
        ))}
        {schools.length === 0 && <p className="text-sm text-gray-500">No schools onboarded yet.</p>}
      </div>
    </div>
  );
}
