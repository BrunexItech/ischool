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
  students: { icon: Users, from: "#0E7490", to: "#155E75" },
  classes: { icon: School, from: "#1D4ED8", to: "#1E3A8A" },
  teachers: { icon: GraduationCap, from: "#6D28D9", to: "#4C1D95" },
  "teacher-assignments": { icon: GraduationCap, from: "#6D28D9", to: "#4C1D95" },
  "my-classes": { icon: School, from: "#1D4ED8", to: "#1E3A8A" },
  attendance: { icon: UserCheck, from: "#047857", to: "#065F46" },
  "staff-attendance": { icon: UserCheck, from: "#0F766E", to: "#115E59" },
  staff: { icon: Users, from: "#0F766E", to: "#115E59" },
  homework: { icon: NotebookPen, from: "#B45309", to: "#92400E" },
  results: { icon: BarChart3, from: "#BE185D", to: "#9D174D" },
  exams: { icon: ClipboardList, from: "#B91C1C", to: "#991B1B" },
  subjects: { icon: BookOpenCheck, from: "#7C3AED", to: "#5B21B6" },
  "lesson-plans": { icon: BookOpenCheck, from: "#4D7C0F", to: "#3F6212" },
  timetable: { icon: CalendarClock, from: "#0369A1", to: "#075985" },
  competency: { icon: BarChart3, from: "#BE185D", to: "#9D174D" },
  conduct: { icon: ShieldCheck, from: "#9A3412", to: "#7C2D12" },
  awards: { icon: Award, from: "#B45309", to: "#78350F" },
  activities: { icon: Trophy, from: "#C2410C", to: "#9A3412" },
  "academic-terms": { icon: CalendarDays, from: "#4338CA", to: "#3730A3" },
  "school-grades": { icon: GraduationCap, from: "#4338CA", to: "#3730A3" },
  fees: { icon: Wallet, from: "#047857", to: "#064E3B" },
  finance: { icon: Landmark, from: "#0F766E", to: "#134E4A" },
  "finance-activity": { icon: History, from: "#0F766E", to: "#134E4A" },
  ledger: { icon: Receipt, from: "#334155", to: "#1E293B" },
  payroll: { icon: HandCoins, from: "#4D7C0F", to: "#365314" },
  budgets: { icon: Coins, from: "#0E7490", to: "#164E63" },
  procurement: { icon: ShoppingCart, from: "#9333EA", to: "#6B21A8" },
  suppliers: { icon: Package, from: "#9333EA", to: "#6B21A8" },
  assets: { icon: Warehouse, from: "#475569", to: "#334155" },
  stores: { icon: Warehouse, from: "#A16207", to: "#854D0E" },
  "payment-settings": { icon: Wallet, from: "#047857", to: "#064E3B" },
  transport: { icon: Bus, from: "#0369A1", to: "#075985" },
  "pickup-dropoff": { icon: Bus, from: "#0284C7", to: "#0369A1" },
  boarding: { icon: BedDouble, from: "#4338CA", to: "#312E81" },
  security: { icon: ShieldCheck, from: "#B91C1C", to: "#7F1D1D" },
  library: { icon: BookMarked, from: "#0E7490", to: "#155E75" },
  meals: { icon: UtensilsCrossed, from: "#C2410C", to: "#9A3412" },
  trips: { icon: School, from: "#0D9488", to: "#0F766E" },
  calendar: { icon: CalendarDays, from: "#A71C20", to: "#7F1D1D" },
  announcements: { icon: Megaphone, from: "#A71C20", to: "#7F1D1D" },
  "communication-settings": { icon: Megaphone, from: "#A71C20", to: "#7F1D1D" },
  complaints: { icon: MessageSquareWarning, from: "#0E7490", to: "#155E75" },
  feedback: { icon: HeartHandshake, from: "#BE185D", to: "#9D174D" },
  "live-classes": { icon: Video, from: "#6D28D9", to: "#4C1D95" },
  meetings: { icon: Video, from: "#4338CA", to: "#3730A3" },
  crm: { icon: HeartHandshake, from: "#BE185D", to: "#9D174D" },
  reports: { icon: FileBarChart, from: "#A71C20", to: "#7F1D1D" },
  analytics: { icon: BarChart3, from: "#4338CA", to: "#312E81" },
  "activity-log": { icon: History, from: "#475569", to: "#334155" },
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
