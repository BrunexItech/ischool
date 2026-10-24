"use client";

import { Building2, ClipboardList, ShieldCheck, Wallet2 } from "lucide-react";
import { LoginForm, LoginAudienceConfig } from "@/components/LoginForm";
import { UserRole } from "@/lib/api";

const LEADERSHIP_ROLES: UserRole[] = ["group_principal", "head_of_institution"];

const config: LoginAudienceConfig = {
  audience: "admin",
  heroTitle: <>Group and school leadership, in one secure place.</>,
  features: [
    { icon: Building2, label: "Group-wide and per-school oversight" },
    { icon: Wallet2, label: "Finance, staffing and operations" },
    { icon: ShieldCheck, label: "Safeguarding and incident escalation" },
    { icon: ClipboardList, label: "Approvals and consolidated reporting" },
  ],
  pageTitle: "Leadership sign in",
  pageSubtitle: "For the Group Principal and authorized Heads of Institution.",
  allowedRoles: LEADERSHIP_ROLES,
  wrongRoleMessage: "This sign-in is reserved for authorized school leadership.",
};

export default function LeadershipLoginPage() {
  return <LoginForm config={config} />;
}
