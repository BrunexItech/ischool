"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, LiveClass, SchoolClass } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LiveClassesPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [scheduledStart, setScheduledStart] = useState(toLocalInputValue(new Date().toISOString()));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const canSchedule = user?.role === "school_admin" || user?.role === "teacher" || user?.role === "super_admin";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listLiveClasses(token, user.school_id).then(setLiveClasses);
    api.listClasses(token, user.school_id).then(setClasses);
  }, [token, user?.school_id]);

  function classNameFor(classId: number | null) {
    if (!classId) return "Whole school";
    return classes.find((c) => c.id === classId)?.name ?? `#${classId}`;
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.scheduleLiveClass(token, user.school_id, {
        title,
        scheduled_start: new Date(scheduledStart).toISOString(),
        class_id: classId ? Number(classId) : undefined,
      });
      setLiveClasses((lc) => [created, ...lc]);
      setTitle("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule live class");
    } finally {
      setSubmitting(false);
    }
  }

  function joinLink(joinCode: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${joinCode}`;
  }

  async function copyLink(lc: LiveClass) {
    try {
      await navigator.clipboard.writeText(joinLink(lc.join_code));
      setCopiedId(lc.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard API unavailable — the link is still visible on screen to copy manually
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="p-6">
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Live Classes</h1>

        {canSchedule && (
          <form onSubmit={handleSchedule} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Title</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Maths Live Lesson" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Whole school</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Starts</label>
              <input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <button disabled={submitting} type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {submitting ? "Scheduling..." : "Schedule"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}

        <div className="space-y-3">
          {liveClasses.map((lc) => (
            <div key={lc.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{lc.title}</p>
                  <p className="text-sm text-gray-500">
                    {classNameFor(lc.class_id)} · {new Date(lc.scheduled_start).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyLink(lc)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {copiedId === lc.id ? "Link copied!" : "Copy student join link"}
                  </button>
                  <a
                    href={`/dashboard/live-classes/${lc.id}/room`}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Join as host
                  </a>
                </div>
              </div>
            </div>
          ))}
          {liveClasses.length === 0 && <p className="text-sm text-gray-500">No live classes scheduled yet.</p>}
        </div>
      </main>
    </div>
  );
}
