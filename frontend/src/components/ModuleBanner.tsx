"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Award, BarChart3, BedDouble, BookMarked, BookOpenCheck, Bus, CalendarClock, CalendarDays, ClipboardList, Coins, FileBarChart, GraduationCap,
  HandCoins, HeartHandshake, History, Landmark, LayoutDashboard, LucideIcon, Megaphone, MessageSquareWarning, NotebookPen, Package, Receipt,
  School, ShieldCheck, ShoppingCart, Trophy, UserCheck, Users, UtensilsCrossed, Video, Wallet, Warehouse,
} from "lucide-react";

type Theme = { icon: LucideIcon; from: string; to: string };

// Each area keeps its own colour, so a page is recognised before its title is read.
const THEMES: Record<string, Theme> = {
  students: { icon: Users, from: "#A71C20", to: "#7F1D1D" },
  classes: { icon: School, from: "#B91C1C", to: "#D9531E" },
  teachers: { icon: GraduationCap, from: "#B7791F", to: "#8A5A12" },
  "teacher-assignments": { icon: GraduationCap, from: "#7F1D1D", to: "#4A0E10" },
  "my-classes": { icon: School, from: "#C2410C", to: "#8F2F0A" },
  attendance: { icon: UserCheck, from: "#9D2B3A", to: "#6E1626" },
  "staff-attendance": { icon: UserCheck, from: "#92400E", to: "#6B2C0C" },
  staff: { icon: Users, from: "#4A2F30", to: "#241617" },
  homework: { icon: NotebookPen, from: "#A71C20", to: "#7F1D1D" },
  results: { icon: BarChart3, from: "#B91C1C", to: "#D9531E" },
  exams: { icon: ClipboardList, from: "#B7791F", to: "#8A5A12" },
  subjects: { icon: BookOpenCheck, from: "#7F1D1D", to: "#4A0E10" },
  "lesson-plans": { icon: BookOpenCheck, from: "#C2410C", to: "#8F2F0A" },
  timetable: { icon: CalendarClock, from: "#9D2B3A", to: "#6E1626" },
  competency: { icon: BarChart3, from: "#92400E", to: "#6B2C0C" },
  conduct: { icon: ShieldCheck, from: "#4A2F30", to: "#241617" },
  awards: { icon: Award, from: "#A71C20", to: "#7F1D1D" },
  activities: { icon: Trophy, from: "#B91C1C", to: "#D9531E" },
  "academic-terms": { icon: CalendarDays, from: "#B7791F", to: "#8A5A12" },
  "school-grades": { icon: GraduationCap, from: "#7F1D1D", to: "#4A0E10" },
  fees: { icon: Wallet, from: "#C2410C", to: "#8F2F0A" },
  finance: { icon: Landmark, from: "#9D2B3A", to: "#6E1626" },
  "finance-activity": { icon: History, from: "#92400E", to: "#6B2C0C" },
  ledger: { icon: Receipt, from: "#4A2F30", to: "#241617" },
  payroll: { icon: HandCoins, from: "#A71C20", to: "#7F1D1D" },
  budgets: { icon: Coins, from: "#B91C1C", to: "#D9531E" },
  procurement: { icon: ShoppingCart, from: "#B7791F", to: "#8A5A12" },
  suppliers: { icon: Package, from: "#7F1D1D", to: "#4A0E10" },
  assets: { icon: Warehouse, from: "#C2410C", to: "#8F2F0A" },
  stores: { icon: Warehouse, from: "#9D2B3A", to: "#6E1626" },
  "payment-settings": { icon: Wallet, from: "#92400E", to: "#6B2C0C" },
  transport: { icon: Bus, from: "#4A2F30", to: "#241617" },
  "pickup-dropoff": { icon: Bus, from: "#A71C20", to: "#7F1D1D" },
  boarding: { icon: BedDouble, from: "#B91C1C", to: "#D9531E" },
  security: { icon: ShieldCheck, from: "#B7791F", to: "#8A5A12" },
  library: { icon: BookMarked, from: "#7F1D1D", to: "#4A0E10" },
  meals: { icon: UtensilsCrossed, from: "#C2410C", to: "#8F2F0A" },
  trips: { icon: School, from: "#9D2B3A", to: "#6E1626" },
  calendar: { icon: CalendarDays, from: "#92400E", to: "#6B2C0C" },
  announcements: { icon: Megaphone, from: "#4A2F30", to: "#241617" },
  "communication-settings": { icon: Megaphone, from: "#A71C20", to: "#7F1D1D" },
  complaints: { icon: MessageSquareWarning, from: "#B91C1C", to: "#D9531E" },
  feedback: { icon: HeartHandshake, from: "#B7791F", to: "#8A5A12" },
  "live-classes": { icon: Video, from: "#7F1D1D", to: "#4A0E10" },
  meetings: { icon: Video, from: "#C2410C", to: "#8F2F0A" },
  crm: { icon: HeartHandshake, from: "#9D2B3A", to: "#6E1626" },
  reports: { icon: FileBarChart, from: "#92400E", to: "#6B2C0C" },
  analytics: { icon: BarChart3, from: "#4A2F30", to: "#241617" },
  "activity-log": { icon: History, from: "#A71C20", to: "#7F1D1D" },
};
const FALLBACK: Theme = { icon: LayoutDashboard, from: "#A71C20", to: "#7F1D1D" };

export function themeFor(pathname: string): Theme {
  const seg = pathname.split("/")[2] ?? "";
  return THEMES[seg] ?? FALLBACK;
}

/** The title block at the top of a page: coloured by area, with the actions on the right. */
export function ModuleBanner({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  const pathname = usePathname();
  const t = themeFor(pathname);
  const Icon = t.icon;
  return (
    <header
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border print:hidden px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5"
      style={{ backgroundImage: `linear-gradient(115deg, color-mix(in srgb, ${t.from} 11%, var(--card)) 0%, var(--card) 70%)` }}
    >
      <span aria-hidden className="pointer-events-none absolute -top-10 -right-8 size-40 rounded-full opacity-[0.07]" style={{ background: t.from }} />
      <Icon aria-hidden className="pointer-events-none absolute right-5 bottom-2 hidden size-16 opacity-[0.06] sm:block" style={{ color: t.from }} />
      <div className="relative flex min-w-0 items-center gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm sm:size-12" style={{ backgroundImage: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>
          <Icon className="size-5 sm:size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-heading text-xl leading-tight font-semibold tracking-tight break-words sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children && <div className="relative flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
