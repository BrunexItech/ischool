"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Megaphone } from "lucide-react";
import { Announcement, api, CalendarEvent } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Empty, Panel, Section, shortDay } from "@/components/family/FamilyUi";

/** What the school is saying and what is coming up. Shared by every home page. */
export function SchoolFeed({ schoolId, today }: { schoolId: number | null; today: string }) {
  const { token } = useAuth();
  const [notices, setNotices] = useState<Announcement[] | null | undefined>(undefined);
  const [events, setEvents] = useState<CalendarEvent[] | null | undefined>(undefined);

  useEffect(() => {
    if (!token || !schoolId) return;
    api.listAnnouncements(token, schoolId).then((r) => setNotices(r.slice(0, 4))).catch(() => setNotices(null));
  }, [token, schoolId]);

  useEffect(() => {
    if (!token || !schoolId) return;
    const end = new Date(today + "T12:00:00");
    end.setDate(end.getDate() + 30);
    api.listCalendarEvents(token, schoolId, today, end.toISOString().slice(0, 10)).then((r) => setEvents(r.slice(0, 5))).catch(() => setEvents(null));
  }, [token, schoolId, today]);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Section title="Coming up" action={<Button variant="ghost" size="sm" className="h-9" render={<Link href="/dashboard/calendar">Calendar</Link>} nativeButton={false} />}>
            <Panel>
              {events === undefined ? <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p> : !events || events.length === 0 ? (
                <Empty icon={<CalendarDays />} title="Nothing scheduled">No events in the next 30 days.</Empty>
              ) : (
                <ul className="flex flex-col divide-y">
                  {events.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-primary/10 py-1 text-primary">
                        <span className="text-[10px] font-semibold uppercase">{new Date(e.start_date + "T12:00:00").toLocaleDateString(undefined, { month: "short" })}</span>
                        <span className="font-heading text-base leading-none font-semibold">{new Date(e.start_date + "T12:00:00").getDate()}</span>
                      </span>
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{e.title}</p><p className="text-xs text-muted-foreground capitalize">{e.event_type.replace(/_/g, " ")}</p></div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </Section>

          <Section title="From the school" action={<Button variant="ghost" size="sm" className="h-9" render={<Link href="/dashboard/announcements">All notices</Link>} nativeButton={false} />}>
            <Panel>
              {notices === undefined ? <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p> : !notices || notices.length === 0 ? (
                <Empty icon={<Megaphone />} title="No notices">New announcements from the school appear here.</Empty>
              ) : (
                <ul className="flex flex-col divide-y">
                  {notices.map((n) => (
                    <li key={n.id} className="py-2.5 first:pt-0 last:pb-0">
                      <Link href="/dashboard/announcements" className="block rounded-md hover:text-primary">
                        <p className="line-clamp-1 text-sm font-medium">{n.title}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{shortDay(n.created_at.slice(0, 10))}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </Section>
    </div>
  );
}
