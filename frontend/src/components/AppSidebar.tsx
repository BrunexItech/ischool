"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
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
  Check,
  LogOut,
  MessageSquareWarning,
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
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["school_admin", "teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar", "supervisor"] },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/dashboard/my-classes", label: "My Classes", icon: LayoutGrid, roles: ["teacher"] },
      { href: "/dashboard/classes", label: "Classes", icon: BookOpen, roles: ["school_admin", "staff", "supervisor"] },
      { href: "/dashboard/teachers", label: "Teachers", icon: GraduationCap, roles: ["school_admin", "supervisor"] },
      { href: "/dashboard/lesson-plans", label: "Lesson Plans", icon: NotebookPen, roles: ["school_admin", "teacher", "staff", "supervisor"] },
      { href: "/dashboard/homework", label: "Homework", icon: ClipboardList, roles: ["school_admin", "teacher", "staff", "supervisor"] },
      { href: "/dashboard/students", label: "Students", icon: Users, roles: ["school_admin", "teacher", "staff", "supervisor"] },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck, roles: ["school_admin", "teacher", "staff", "supervisor"] },
      { href: "/dashboard/results", label: "Results", icon: Award, roles: ["school_admin", "teacher", "staff", "supervisor"] },
      { href: "/dashboard/exams", label: "Exams", icon: FileText, roles: ["school_admin", "teacher", "staff", "supervisor"] },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, roles: ["school_admin", "teacher", "staff", "bursar", "supervisor"] },
      { href: "/dashboard/academic-terms", label: "Academic Terms", icon: CalendarRange, roles: ["school_admin", "supervisor"] },
      { href: "/dashboard/teacher-assignments", label: "Teaching Assignments", icon: ClipboardList, roles: ["school_admin", "supervisor"] },
      { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock, roles: ["school_admin", "supervisor"] },
    ],
  },
  {
    label: "Recognition",
    items: [
      { href: "/dashboard/awards", label: "Awards", icon: Award, roles: ["school_admin", "teacher", "staff", "supervisor"] },
      { href: "/dashboard/activities", label: "Activities", icon: Trophy, roles: ["school_admin", "teacher", "staff", "supervisor"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays, roles: ["school_admin", "teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar", "supervisor"] },
      { href: "/dashboard/staff-attendance", label: "Staff Attendance", icon: UserCheck, roles: ["school_admin", "teacher", "staff", "security", "boarding_staff", "transport_staff", "bursar", "supervisor"] },
      { href: "/dashboard/boarding", label: "Boarding", icon: BedDouble, roles: ["school_admin", "staff", "boarding_staff", "supervisor"] },
      { href: "/dashboard/security", label: "Security", icon: ShieldCheck, roles: ["school_admin", "staff", "security", "supervisor"] },
      { href: "/dashboard/transport", label: "Transport", icon: Bus, roles: ["school_admin", "staff", "transport_staff", "supervisor"] },
      { href: "/dashboard/trips", label: "Trips", icon: Map, roles: ["school_admin", "teacher", "staff", "transport_staff", "supervisor"] },
      { href: "/dashboard/meals", label: "Meals", icon: UtensilsCrossed, roles: ["school_admin", "staff", "supervisor"] },
      { href: "/dashboard/pickup-dropoff", label: "Pickup / Drop-off", icon: UserCheck, roles: ["school_admin", "teacher", "staff", "security", "supervisor"] },
      { href: "/dashboard/live-classes", label: "Live Classes", icon: Video, roles: ["school_admin", "teacher", "staff", "supervisor"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/fees", label: "Fees", icon: Wallet, roles: ["school_admin", "staff", "bursar", "supervisor"] },
      { href: "/dashboard/finance", label: "Finance", icon: Wallet2, roles: ["school_admin", "bursar", "supervisor"] },
      { href: "/dashboard/ledger", label: "Ledger", icon: BookOpenCheck, roles: ["school_admin", "bursar", "supervisor"] },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck, roles: ["school_admin", "supervisor"] },
      { href: "/dashboard/procurement", label: "Procurement", icon: Package, roles: ["school_admin", "staff", "supervisor"] },
      { href: "/dashboard/budgets", label: "Budgets", icon: PiggyBank, roles: ["school_admin", "supervisor"] },
      { href: "/dashboard/stores", label: "Stores", icon: Boxes, roles: ["school_admin", "staff", "supervisor"] },
      { href: "/dashboard/payroll", label: "Payroll", icon: Banknote, roles: ["school_admin", "supervisor"] },
      { href: "/dashboard/assets", label: "Fixed Assets", icon: Building2, roles: ["school_admin", "supervisor"] },
      { href: "/dashboard/payment-settings", label: "Payment Settings", icon: CreditCard, roles: ["school_admin", "supervisor"] },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ["school_admin", "teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar", "supervisor"] },
      { href: "/dashboard/complaints", label: "Complaints", icon: MessageSquareWarning, roles: ["school_admin", "teacher", "student", "parent", "super_admin", "supervisor"] },
      { href: "/dashboard/communication-settings", label: "Communication Settings", icon: MessageSquare, roles: ["school_admin", "supervisor"] },
    ],
  },
  {
    label: "Engagement",
    items: [
      { href: "/dashboard/crm", label: "Admissions CRM", icon: Users2, roles: ["school_admin", "supervisor"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/staff", label: "Staff", icon: UserSquare2, roles: ["school_admin", "supervisor"] },
      { href: "/dashboard/activity-log", label: "Activity Log", icon: History, roles: ["school_admin", "supervisor"] },
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

  function closeOnMobile() {
    if (isMobile) setOpenMobile(false);
  }

  if (!user) return null;

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(user.role)),
  })).filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {schoolOptions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    {
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/mila-logo.svg" alt="Milai School" className="size-full object-contain p-1" />
                    }
                  </div>
                  <div className="grid flex-1 text-left group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-semibold tracking-tight">Milai School</span>
                    <span className="truncate text-[0.68rem] text-sidebar-foreground/50">
                      {schoolOptions.length} {schoolOptions.length === 1 ? "school" : "schools"} · switch
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              }
            />
            <DropdownMenuContent side="bottom" align="start" className="w-64">
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
        ) : (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              {
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/mila-logo.svg" alt="Milai School" className="size-full object-contain p-1" />
              }
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold tracking-tight">Milai School</span>
              <span className="text-[0.68rem] text-sidebar-foreground/50">School management</span>
            </div>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section, i) => (
          <SidebarGroup key={section.label ?? `section-${i}`}>
            {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        render={
                          <Link href={item.href} onClick={closeOnMobile}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        }
                      />
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                    <Avatar className="size-7 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-sidebar-accent text-xs">
                        {initials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.full_name}</span>
                      <span className="truncate text-xs text-sidebar-foreground/60 capitalize">
                        {user.role.replace("_", " ")}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem onClick={logout}>
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
