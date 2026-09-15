"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, MapPin, Megaphone, MessageSquare, Send } from "lucide-react";
import { api, Announcement, AnnouncementAudience, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/Spinner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AUDIENCE_OPTIONS: AnnouncementAudience[] = ["all", "teachers", "staff", "students", "parents"];

export default function AnnouncementsPage() {
  const { user, token } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [isEvent, setIsEvent] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [sendSms, setSendSms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const canPost = user?.role === "school_admin" || user?.role === "teacher" || user?.role === "super_admin";

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api.listAnnouncements(token, user.school_id).then(setAnnouncements).finally(() => setLoading(false));
  }, [token, user?.school_id]);

  const smsEligible = audience === "all" || audience === "parents";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      const result = await api.createAnnouncement(token, user.school_id, {
        title,
        body,
        audience,
        event_date: isEvent && eventDate ? eventDate : undefined,
        event_end_date: isEvent && eventEndDate ? eventEndDate : undefined,
        location: isEvent && location ? location : undefined,
        send_sms: smsEligible && sendSms,
      });
      setAnnouncements((a) => [result.announcement, ...a]);
      setTitle("");
      setBody("");
      setIsEvent(false);
      setEventDate("");
      setEventEndDate("");
      setLocation("");
      setSendSms(false);
      toast.success(isEvent ? "Event posted" : "Announcement posted");
      if (smsEligible && sendSms) {
        if (result.sms_error) toast.warning(result.sms_error);
        else if (result.sms_sent > 0) toast.success(`SMS sent to ${result.sms_sent} guardian${result.sms_sent > 1 ? "s" : ""}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to post announcement");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Announcements" description="Share updates with your school community." />
        <PageLoader />
      </div>
    );
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
              <div className="flex items-center gap-2">
                <Switch checked={isEvent} onCheckedChange={setIsEvent} />
                <Label className="font-normal">This is also a school event (has a date)</Label>
              </div>
              {isEvent && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label>Date</Label>
                    <Input required type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>End date (optional)</Label>
                    <Input type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Location (optional)</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Select value={audience} onValueChange={(v) => v && setAudience(v as AnnouncementAudience)}>
                  <SelectTrigger className="w-40 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button disabled={submitting} type="submit">
                  <Send /> {submitting ? "Posting..." : isEvent ? "Post event" : "Post announcement"}
                </Button>
              </div>
              {smsEligible && (
                <div className="flex items-center gap-2">
                  <Switch checked={sendSms} onCheckedChange={setSendSms} />
                  <Label className="flex items-center gap-1.5 font-normal">
                    <MessageSquare className="size-3.5" /> Also send via SMS to guardians on file
                  </Label>
                </div>
              )}
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
                  {a.event_date ? <CalendarDays className="size-4" /> : <Megaphone className="size-4" />}
                </div>
                <div>
                  <p className="font-medium leading-none">{a.title}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{a.body}</p>
                  {a.event_date && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {new Date(a.event_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        {a.event_end_date && ` – ${new Date(a.event_end_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                      </span>
                      {a.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {a.location}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {a.event_date && <Badge className="gap-1"><CalendarDays className="size-3" /> Event</Badge>}
                <Badge variant="secondary" className="capitalize">{a.audience}</Badge>
              </div>
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
