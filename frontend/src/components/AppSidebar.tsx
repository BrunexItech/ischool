"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  Library,
  LayoutDashboard,
  Users,
  Users2,
  UserSquare2,
  BookOpen,
  NotebookPen,
  ClipboardCheck,
  Award,
  Wallet,
  Megaphone,
  MessageSquare,
  Video,
  HeartHandshake,
  ClipboardList,
  History,
  CalendarRange,
  CalendarDays,
  BedDouble,
  ShieldCheck,
  Map,
  BookOpenCheck,
  Truck,
  Package,
  PiggyBank,
  Boxes,
  Banknote,
  Building2,
  Bus,
  UtensilsCrossed,
  Trophy,
  BarChart3,
  Wallet2,
  UserCheck,
  FileText,
  CreditCard,
  LayoutGrid,
  CalendarClock,
  ChevronsUpDown,
  ChevronRight,
  Check,
  LogOut,
  MessageSquareWarning,
  AlertTriangle,
  Search,
  Landmark,
  Heart,
  FileBarChart,
  MessageSquareText,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["head_of_institution", "teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar", "group_principal", "secretary"] },
      { href: "/dashboard/reports", label: "Weekly Report", icon: FileBarChart, roles: ["head_of_institution", "group_principal"] },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/dashboard/my-classes", label: "My Classes", icon: LayoutGrid, roles: ["teacher"] },
      { href: "/dashboard/competency", label: "Learner Progress", icon: NotebookPen, roles: ["teacher"] },
      { href: "/dashboard/classes", label: "Classes", icon: BookOpen, roles: ["head_of_institution", "staff", "group_principal", "secretary"] },
      { href: "/dashboard/school-grades", label: "School Grades", icon: LayoutGrid, roles: ["group_principal"] },
      { href: "/dashboard/teachers", label: "Teachers", icon: GraduationCap, roles: ["head_of_institution", "group_principal", "secretary"] },
      { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquareText, roles: ["head_of_institution", "group_principal", "teacher", "staff"] },
      { href: "/dashboard/lesson-plans", label: "Lesson Plans", icon: NotebookPen, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/homework", label: "Homework", icon: ClipboardList, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/conduct", label: "Conduct Reports", icon: AlertTriangle, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/students", label: "Students", icon: Users, roles: ["head_of_institution", "teacher", "staff", "group_principal", "secretary"] },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck, roles: ["head_of_institution", "teacher", "staff", "group_principal", "secretary"] },
      { href: "/dashboard/results", label: "Grading", icon: Award, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/exams", label: "Exams", icon: FileText, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, roles: ["head_of_institution", "teacher", "staff", "bursar", "group_principal"] },
      { href: "/dashboard/academic-terms", label: "Academic Terms", icon: CalendarRange, roles: ["head_of_institution", "group_principal", "secretary"] },
      { href: "/dashboard/subjects", label: "Subjects", icon: Library, roles: ["head_of_institution", "group_principal", "secretary"] },
      { href: "/dashboard/teacher-assignments", label: "Teaching Assignments", icon: ClipboardList, roles: ["head_of_institution", "group_principal", "secretary"] },
      { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock, roles: ["head_of_institution", "group_principal", "secretary"] },
    ],
  },
  {
    label: "Recognition",
    items: [
      { href: "/dashboard/awards", label: "Awards", icon: Award, roles: ["head_of_institution", "teacher", "staff", "group_principal", "secretary"] },
      { href: "/dashboard/activities", label: "Activities", icon: Trophy, roles: ["head_of_institution", "teacher", "staff", "group_principal", "secretary"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays, roles: ["head_of_institution", "teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar", "group_principal", "secretary"] },
      { href: "/dashboard/staff-attendance", label: "Staff Attendance", icon: UserCheck, roles: ["head_of_institution", "teacher", "staff", "security", "boarding_staff", "transport_staff", "bursar", "group_principal", "secretary"] },
      { href: "/dashboard/boarding", label: "Boarding", icon: BedDouble, roles: ["head_of_institution", "staff", "boarding_staff", "group_principal"] },
      { href: "/dashboard/security", label: "Security", icon: ShieldCheck, roles: ["head_of_institution", "staff", "security", "group_principal"] },
      { href: "/dashboard/transport", label: "Transport", icon: Bus, roles: ["head_of_institution", "staff", "transport_staff", "group_principal"] },
      { href: "/dashboard/trips", label: "Trips", icon: Map, roles: ["head_of_institution", "teacher", "staff", "transport_staff", "group_principal", "secretary"] },
      { href: "/dashboard/meals", label: "Meals", icon: UtensilsCrossed, roles: ["head_of_institution", "staff", "group_principal", "secretary"] },
      { href: "/dashboard/pickup-dropoff", label: "Pickup / Drop-off", icon: UserCheck, roles: ["head_of_institution", "staff", "security", "group_principal"] },
      { href: "/dashboard/live-classes", label: "Live Classes", icon: Video, roles: ["head_of_institution", "teacher", "staff", "group_principal", "secretary"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/fees", label: "Fees", icon: Wallet, roles: ["head_of_institution", "staff", "bursar", "group_principal"] },
      { href: "/dashboard/finance", label: "Finance", icon: Wallet2, roles: ["head_of_institution", "bursar", "group_principal"] },
      { href: "/dashboard/ledger", label: "Ledger", icon: BookOpenCheck, roles: ["head_of_institution", "bursar", "group_principal"] },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck, roles: ["head_of_institution", "group_principal"] },
      { href: "/dashboard/procurement", label: "Procurement", icon: Package, roles: ["head_of_institution", "staff", "group_principal"] },
      { href: "/dashboard/budgets", label: "Budgets", icon: PiggyBank, roles: ["head_of_institution", "group_principal"] },
      { href: "/dashboard/stores", label: "Stores", icon: Boxes, roles: ["head_of_institution", "staff", "group_principal"] },
      { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, roles: ["head_of_institution", "group_principal"] },
      { href: "/dashboard/assets", label: "Fixed Assets", icon: Building2, roles: ["head_of_institution", "group_principal"] },
      { href: "/dashboard/payment-settings", label: "Payment Settings", icon: CreditCard, roles: ["head_of_institution", "group_principal"] },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ["head_of_institution", "teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar", "group_principal", "secretary"] },
      { href: "/dashboard/complaints", label: "Complaints", icon: MessageSquareWarning, roles: ["head_of_institution", "teacher", "student", "parent", "super_admin", "group_principal"] },
      { href: "/dashboard/communication-settings", label: "Communication Settings", icon: MessageSquare, roles: ["head_of_institution", "group_principal"] },
    ],
  },
  {
    label: "Engagement",
    items: [
      { href: "/dashboard/crm", label: "Admissions CRM", icon: Users2, roles: ["head_of_institution", "group_principal", "secretary"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/staff", label: "Staff", icon: UserSquare2, roles: ["head_of_institution", "group_principal"] },
      { href: "/dashboard/activity-log", label: "Activity Log", icon: History, roles: ["head_of_institution", "group_principal"] },
    ],
  },
  {
    label: "My Family",
    items: [
      { href: "/dashboard/children", label: "My Children", icon: HeartHandshake, roles: ["parent"] },
      { href: "/dashboard/my-records", label: "My Records", icon: Award, roles: ["student"] },
    ],
  },
];

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Academics: GraduationCap,
  Recognition: Trophy,
  Operations: Building2,
  Finance: Wallet2,
  Communication: Megaphone,
  Engagement: Users2,
  Administration: ShieldCheck,
  "My Family": Heart,
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppSidebar() {
  const { user, logout, schoolOptions, viewingSchoolId, switchSchool } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [query, setQuery] = useState("");

  function closeOnMobile() {
    if (isMobile) setOpenMobile(false);
  }

  if (!user) return null;

  const q = query.trim().toLowerCase();
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(user.role) && (!q || item.label.toLowerCase().includes(q))),
  })).filter((section) => section.items.length > 0);

  const currentSchool = schoolOptions.find((o) => o.id === viewingSchoolId) ?? schoolOptions[0];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="relative gap-3 overflow-hidden pt-3 pb-1">
        <div className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-sidebar-primary/20 blur-xl group-data-[collapsible=icon]:hidden" />
        <div className="relative flex items-center gap-3 px-2">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
            {
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/mila-logo.png" alt="Milai School" className="size-full object-contain p-0.5" />
            }
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate font-heading text-lg leading-tight font-semibold tracking-tight">Milai</span>
            <span className="truncate text-xs leading-tight text-sidebar-foreground/70">Group of Schools</span>
          </div>
        </div>
        <p className="relative truncate px-2 text-[0.6rem] font-medium tracking-[0.12em] text-sidebar-primary uppercase group-data-[collapsible=icon]:hidden">
          Nurture with Excellence
        </p>
        <div className="relative px-2 group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute top-1/2 left-4.5 size-3.5 -translate-y-1/2 text-sidebar-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu..."
            className="h-9 w-full rounded-lg border border-white/10 bg-black/15 pr-3 pl-8 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section, i) => {
          const SectionIcon = section.label ? SECTION_ICONS[section.label] : null;
          return (
            <SidebarGroup key={section.label ?? `section-${i}`}>
              {section.label && (
                <SidebarGroupLabel className="gap-1.5 text-sidebar-primary/90">
                  {SectionIcon && <SectionIcon className="size-3.5" />}
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.label}
                          className={
                            active
                              ? "rounded-full bg-sidebar-primary font-semibold text-sidebar-primary-foreground before:hidden hover:bg-sidebar-primary hover:text-sidebar-primary-foreground data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground"
                              : "rounded-full text-sidebar-foreground/85"
                          }
                          render={
                            <Link href={item.href} onClick={closeOnMobile}>
                              <item.icon />
                              <span className="flex-1">{item.label}</span>
                              <ChevronRight className="size-3.5 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
                            </Link>
                          }
                        />
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="relative gap-2 overflow-hidden pb-3">
        <div className="pointer-events-none absolute -bottom-10 -left-10 size-28 rounded-full bg-sidebar-primary/20 blur-xl group-data-[collapsible=icon]:hidden" />
        {schoolOptions.length > 0 && currentSchool && (
          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg bg-black/15 px-2.5 py-2 text-left transition-colors hover:bg-black/25 group-data-[collapsible=icon]:justify-center"
                  >
                    <Landmark className="size-4 shrink-0 text-sidebar-foreground/70" />
                    <div className="grid min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-sm font-medium">{currentSchool.name}</span>
                      <span className="truncate text-[0.68rem] text-sidebar-foreground/50">
                        {currentSchool.isHome ? "Group" : "Campus"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 shrink-0 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden" />
                  </button>
                }
              />
              <DropdownMenuContent side="top" align="start" className="w-64">
                {schoolOptions.map((option) => (
                  <DropdownMenuItem key={option.id} onClick={() => { switchSchool(option.id); router.push("/dashboard"); }}>
                    <Building2 className="text-muted-foreground" />
                    <span className="flex-1 truncate">{option.name}</span>
                    {option.isHome && <span className="text-[0.65rem] text-muted-foreground">Group</span>}
                    {viewingSchoolId === option.id && <Check className="size-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <SidebarMenu className="relative">
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg" className="rounded-lg bg-black/15 data-[state=open]:bg-black/25 hover:bg-black/25">
                    <Avatar className="size-8 rounded-full">
                      <AvatarFallback className="rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                        {initials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.full_name}</span>
                      <span className="truncate text-xs text-sidebar-foreground/60 capitalize">
                        {user.role.replace(/_/g, " ")}
                      </span>
                    </div>
                    <ChevronRight className="ml-auto size-4 opacity-50" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem onClick={() => logout(true)}>
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
