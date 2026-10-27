"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, CalendarRange, ChevronRight, Clock3, Megaphone, UserPlus, Users, Users2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { DepartmentPulse } from "@/components/DepartmentPulse";
import { PageHead } from "@/components/oversight";

const TASKS = [
  { href: "/dashboard/academic-terms", label: "Term dates", hint: "Open and close the terms", icon: CalendarRange },
  { href: "/dashboard/calendar", label: "School calendar", hint: "Meetings, events and holidays", icon: CalendarDays },
  { href: "/dashboard/announcements", label: "Announcements", hint: "Write to parents, staff and learners", icon: Megaphone },
  { href: "/dashboard/students", label: "Learners", hint: "Enrol and update records", icon: Users },
  { href: "/dashboard/crm", label: "Admissions", hint: "Enquiries, visits and offers", icon: Users2 },
  { href: "/dashboard/classes", label: "Classes and streams", hint: "Set up classes and class teachers", icon: BookOpen },
  { href: "/dashboard/timetable", label: "Timetable", hint: "Lessons by day and teacher", icon: Clock3 },
  { href: "/dashboard/teacher-assignments", label: "Teaching assignments", hint: "Who teaches what", icon: UserPlus },
];

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** The head's office: the things a secretary does on the head's behalf, with
 *  the few figures that tell them what is waiting. No money and no approvals. */
export function OfficeDesk() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-6">
      <PageHead title={`${greet()}, ${user?.full_name.split(" ")[0] ?? ""}`} subtitle="The head's office: term dates, the calendar, notices, admissions and enrolment." />

      <DepartmentPulse dept="calendar" collapsible={false} />

      <section aria-label="Your tasks">
        <h2 className="mb-3 font-heading text-lg font-semibold">What would you like to do?</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TASKS.map((t) => (
            <Link key={t.href} href={t.href} className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><t.icon className="size-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{t.label}</span>
                <span className="block text-sm text-muted-foreground">{t.hint}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <DepartmentPulse dept="admissions" collapsible={false} />
        <DepartmentPulse dept="students" collapsible={false} />
      </div>
      <DepartmentPulse dept="announcements" collapsible={false} />
    </div>
  );
}
