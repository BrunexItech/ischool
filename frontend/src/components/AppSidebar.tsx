"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  UserSquare2,
  BookOpen,
  ClipboardCheck,
  Award,
  Wallet,
  Megaphone,
  Video,
  HeartHandshake,
  ClipboardList,
  History,
  CalendarRange,
  Bus,
  UtensilsCrossed,
  Trophy,
  BarChart3,
  Wallet2,
  UserCheck,
  FileText,
  CreditCard,
  ChevronsUpDown,
  LogOut,
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
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["school_admin", "teacher", "staff", "student", "parent"] },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/dashboard/classes", label: "Classes", icon: BookOpen, roles: ["school_admin", "teacher", "staff"] },
      { href: "/dashboard/students", label: "Students", icon: Users, roles: ["school_admin", "teacher", "staff"] },
      { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck, roles: ["school_admin", "teacher", "staff"] },
      { href: "/dashboard/results", label: "Results", icon: Award, roles: ["school_admin", "teacher", "staff"] },
      { href: "/dashboard/exams", label: "Exams", icon: FileText, roles: ["school_admin", "teacher", "staff"] },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, roles: ["school_admin", "teacher", "staff"] },
      { href: "/dashboard/academic-terms", label: "Academic Terms", icon: CalendarRange, roles: ["school_admin"] },
      { href: "/dashboard/teacher-assignments", label: "Teaching Assignments", icon: ClipboardList, roles: ["school_admin"] },
    ],
  },
  {
    label: "Recognition",
    items: [
      { href: "/dashboard/awards", label: "Awards", icon: Award, roles: ["school_admin", "teacher", "staff"] },
      { href: "/dashboard/activities", label: "Activities", icon: Trophy, roles: ["school_admin", "teacher", "staff"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/transport", label: "Transport", icon: Bus, roles: ["school_admin", "staff"] },
      { href: "/dashboard/meals", label: "Meals", icon: UtensilsCrossed, roles: ["school_admin", "staff"] },
      { href: "/dashboard/pickup-dropoff", label: "Pickup / Drop-off", icon: UserCheck, roles: ["school_admin", "teacher", "staff"] },
      { href: "/dashboard/live-classes", label: "Live Classes", icon: Video, roles: ["school_admin", "teacher", "staff"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/fees", label: "Fees", icon: Wallet, roles: ["school_admin", "staff"] },
      { href: "/dashboard/finance", label: "Finance", icon: Wallet2, roles: ["school_admin"] },
      { href: "/dashboard/payment-settings", label: "Payment Settings", icon: CreditCard, roles: ["school_admin"] },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone, roles: ["school_admin", "teacher", "staff", "student", "parent"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/staff", label: "Staff", icon: UserSquare2, roles: ["school_admin"] },
      { href: "/dashboard/activity-log", label: "Activity Log", icon: History, roles: ["school_admin"] },
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
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(user.role)),
  })).filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <GraduationCap className="size-4.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            iSchool
          </span>
        </div>
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
                          <Link href={item.href}>
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
