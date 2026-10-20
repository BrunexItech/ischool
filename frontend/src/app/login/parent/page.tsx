"use client";

import { HeartHandshake, Wallet, Bell, CalendarCheck } from "lucide-react";
import { LoginForm, LoginAudienceConfig } from "@/components/LoginForm";

const config: LoginAudienceConfig = {
  heroTitle: <>Stay close to your child&apos;s day, from anywhere.</>,
  features: [
    { icon: CalendarCheck, label: "Attendance, results and report cards" },
    { icon: Wallet, label: "Fee balances and M-Pesa payment" },
    { icon: Bell, label: "School announcements, instantly" },
    { icon: HeartHandshake, label: "Confirm pickup and drop-off in one tap" },
  ],
  pageTitle: "Parent sign in",
  pageSubtitle: "Use the email and password the school gave you.",
  allowedRoles: ["parent"],
  wrongRoleMessage: "That's not a parent account. Use the staff or student sign-in instead.",
};

export default function ParentLoginPage() {
  return <LoginForm config={config} />;
}
