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
  AlertTriangle,
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
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["head_of_institution", "teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar", "group_principal"] },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/dashboard/my-classes", label: "My Classes", icon: LayoutGrid, roles: ["teacher"] },
      { href: "/dashboard/competency", label: "Learner Progress", icon: NotebookPen, roles: ["teacher"] },
      { href: "/dashboard/classes", label: "Classes", icon: BookOpen, roles: ["head_of_institution", "staff", "group_principal"] },
      { href: "/dashboard/school-grades", label: "School Grades", icon: LayoutGrid, roles: ["group_principal"] },
      { href: "/dashboard/teachers", label: "Teachers", icon: GraduationCap, roles: ["head_of_institution", "group_principal"] },
      { href: "/dashboard/lesson-plans", label: "Lesson Plans", icon: NotebookPen, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/homework", label: "Homework", icon: ClipboardList, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/conduct", label: "Conduct Reports", icon: AlertTriangle, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/students", label: "Students", icon: Users, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/results", label: "Grading", icon: Award, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/exams", label: "Exams", icon: FileText, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, roles: ["head_of_institution", "teacher", "staff", "bursar", "group_principal"] },
      { href: "/dashboard/academic-terms", label: "Academic Terms", icon: CalendarRange, roles: ["head_of_institution", "group_principal"] },
      { href: "/dashboard/teacher-assignments", label: "Teaching Assignments", icon: ClipboardList, roles: ["head_of_institution", "group_principal"] },
      { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock, roles: ["head_of_institution", "group_principal"] },
    ],
  },
  {
    label: "Recognition",
    items: [
      { href: "/dashboard/awards", label: "Awards", icon: Award, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
      { href: "/dashboard/activities", label: "Activities", icon: Trophy, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays, roles: ["head_of_institution", "teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar", "group_principal"] },
      { href: "/dashboard/staff-attendance", label: "Staff Attendance", icon: UserCheck, roles: ["head_of_institution", "teacher", "staff", "security", "boarding_staff", "transport_staff", "bursar", "group_principal"] },
      { href: "/dashboard/boarding", label: "Boarding", icon: BedDouble, roles: ["head_of_institution", "staff", "boarding_staff", "group_principal"] },
      { href: "/dashboard/security", label: "Security", icon: ShieldCheck, roles: ["head_of_institution", "staff", "security", "group_principal"] },
      { href: "/dashboard/transport", label: "Transport", icon: Bus, roles: ["head_of_institution", "staff", "transport_staff", "group_principal"] },
      { href: "/dashboard/trips", label: "Trips", icon: Map, roles: ["head_of_institution", "teacher", "staff", "transport_staff", "group_principal"] },
      { href: "/dashboard/meals", label: "Meals", icon: UtensilsCrossed, roles: ["head_of_institution", "staff", "group_principal"] },
      { href: "/dashboard/pickup-dropoff", label: "Pickup / Drop-off", icon: UserCheck, roles: ["head_of_institution", "staff", "security", "group_principal"] },
      { href: "/dashboard/live-classes", label: "Live Classes", icon: Video, roles: ["head_of_institution", "teacher", "staff", "group_principal"] },
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
      { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ["head_of_institution", "teacher", "staff", "student", "parent", "security", "boarding_staff", "transport_staff", "bursar", "group_principal"] },
      { href: "/dashboard/complaints", label: "Complaints", icon: MessageSquareWarning, roles: ["head_of_institution", "teacher", "student", "parent", "super_admin", "group_principal"] },
      { href: "/dashboard/communication-settings", label: "Communication Settings", icon: MessageSquare, roles: ["head_of_institution", "group_principal"] },
    ],
  },
  {
    label: "Engagement",
    items: [
      { href: "/dashboard/crm", label: "Admissions CRM", icon: Users2, roles: ["head_of_institution", "group_principal"] },
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
                  <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                    {
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/mila-logo.png" alt="Milai School" className="size-full object-contain p-0.5" />
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
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
              {
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/mila-logo.png" alt="Milai School" className="size-full object-contain p-0.5" />
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
