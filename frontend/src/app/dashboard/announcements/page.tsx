"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Announcement, AnnouncementAudience, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

const AUDIENCE_OPTIONS: AnnouncementAudience[] = ["all", "teachers", "staff", "students", "parents"];

export default function AnnouncementsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canPost = user?.role === "school_admin" || user?.role === "teacher" || user?.role === "super_admin";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listAnnouncements(token, user.school_id).then(setAnnouncements);
  }, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createAnnouncement(token, user.school_id, { title, body, audience });
      setAnnouncements((a) => [created, ...a]);
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to post announcement");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="p-6">
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Announcements</h1>

        {canPost && (
          <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <textarea required placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <div className="flex items-center gap-3">
              <select value={audience} onChange={(e) => setAudience(e.target.value as AnnouncementAudience)} className="rounded-md border border-gray-300 px-3 py-2 text-sm capitalize">
                {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <button disabled={submitting} type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                {submitting ? "Posting..." : "Post announcement"}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}

        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{a.title}</h3>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize text-gray-600">{a.audience}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{a.body}</p>
              <p className="mt-2 text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</p>
            </div>
          ))}
          {announcements.length === 0 && <p className="text-sm text-gray-500">No announcements yet.</p>}
        </div>
      </main>
    </div>
  );
}
