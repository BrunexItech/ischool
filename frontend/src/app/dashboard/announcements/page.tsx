"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Megaphone, Send } from "lucide-react";
import { api, Announcement, AnnouncementAudience, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AUDIENCE_OPTIONS: AnnouncementAudience[] = ["all", "teachers", "staff", "students", "parents"];

export default function AnnouncementsPage() {
  const { user, token } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [submitting, setSubmitting] = useState(false);

  const canPost = user?.role === "school_admin" || user?.role === "teacher" || user?.role === "super_admin";

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listAnnouncements(token, user.school_id).then(setAnnouncements);
  }, [token, user?.school_id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const created = await api.createAnnouncement(token, user.school_id, { title, body, audience });
      setAnnouncements((a) => [created, ...a]);
      setTitle("");
      setBody("");
      toast.success("Announcement posted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to post announcement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Announcements" description="Share updates with your school community." />

      {canPost && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-1.5">
                <Label>Title</Label>
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Message</Label>
                <Textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
              </div>
              <div className="flex items-center gap-3">
                <Select value={audience} onValueChange={(v) => v && setAudience(v as AnnouncementAudience)}>
                  <SelectTrigger className="w-40 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button disabled={submitting} type="submit">
                  <Send /> {submitting ? "Posting..." : "Post announcement"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {announcements.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Megaphone className="size-4" />
                </div>
                <div>
                  <p className="font-medium leading-none">{a.title}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{a.body}</p>
                </div>
              </div>
              <Badge variant="secondary" className="capitalize">{a.audience}</Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
        {announcements.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No announcements yet.</p>
        )}
      </div>
    </div>
  );
}
