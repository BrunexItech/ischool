"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  school_admin: "School Admin",
  teacher: "Teacher",
  staff: "Staff",
  student: "Student",
  parent: "Parent",
};

const NAV_LINKS: { href: string; label: string; roles: string[] }[] = [
  { href: "/dashboard", label: "Home", roles: ["school_admin", "teacher", "staff", "student", "parent"] },
  { href: "/dashboard/classes", label: "Classes", roles: ["school_admin", "teacher", "staff"] },
  { href: "/dashboard/students", label: "Students", roles: ["school_admin", "teacher", "staff"] },
  { href: "/dashboard/staff", label: "Staff", roles: ["school_admin"] },
  { href: "/dashboard/attendance", label: "Attendance", roles: ["school_admin", "teacher", "staff"] },
  { href: "/dashboard/results", label: "Results", roles: ["school_admin", "teacher", "staff"] },
  { href: "/dashboard/fees", label: "Fees", roles: ["school_admin", "staff"] },
  {
    href: "/dashboard/announcements",
    label: "Announcements",
    roles: ["school_admin", "teacher", "staff", "student", "parent"],
  },
];

export function DashboardHeader() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const links = NAV_LINKS.filter((link) => link.roles.includes(user.role));

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-gray-900">iSchool</h1>
          <nav className="flex items-center gap-4 text-sm text-gray-600">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-gray-900">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            {user.full_name} · {ROLE_LABELS[user.role] ?? user.role}
          </span>
          <button onClick={logout} className="text-blue-600 hover:underline">
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
