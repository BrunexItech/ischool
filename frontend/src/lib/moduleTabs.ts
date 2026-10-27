"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";

export type TabDef = [key: string, label: string];

const HEADS = ["head_of_institution", "group_principal", "super_admin"];
const STORE_VIEWERS = ["store_keeper", "staff", "super_admin", "head_of_institution", "group_principal", "procurement_officer", "bursar", "accountant"];

/** The sections inside a module, for one role. The sidebar lists them and the page shows the chosen one,
 *  so nothing important hides behind a tab bar. Returns [] when a module has no sections for that role. */
export function moduleTabs(module: string, role: string | undefined): TabDef[] {
  if (!role) return [];
  switch (module) {
    case "security":
      return [["visitors", "Visitors"], ["passes", "Gate passes and pick-ups"], ["vehicles", "Vehicles"], ["incidents", "Incidents"], ["patrols", "Patrols"]];
    case "boarding":
      return [["houses", "Houses and beds"], ["roll", "Roll call"], ["exeats", "Leave-outs"], ["sick", "Sick bay"], ["incidents", "Incidents"]];
    case "ledger":
      return [["is", "Income statement"], ["bs", "Balance sheet"], ["tb", "Trial balance"], ["jr", "Journal"], ["coa", "Chart of accounts"]];
    case "payroll":
      return [["runs", "Pay runs"], ["profiles", "Staff and salaries"]];
    case "procurement":
      return [["requisitions", "Requisitions"], ["orders", "Purchase orders"]];
    case "fees":
      return role === "secretary" ? [] : [["balances", "Balances and arrears"], ["structure", "Fee structure"], ["invoices", "Invoices and payments"]];
    case "classes":
      return ["head_of_institution", "super_admin", "group_principal", "secretary"].includes(role) ? [["classes", "Classes"], ["setup", "Grades and streams"]] : [];
    case "results":
      return HEADS.includes(role) ? [["performance", "Class performance"], ["gradebook", "Marks by subject"]] : [];
    case "lesson-plans":
      return HEADS.includes(role) ? [["coverage", "By teacher"], ["plans", "All plans"]] : [];
    case "homework":
      return HEADS.includes(role) ? [["week", "This week"], ["list", "All homework"]] : [];
    case "timetable":
      return [["week", "Weekly timetable"], ["day", "School day"]];
    case "library":
      if (role === "librarian") return [["desk", "Lend and return"], ["catalogue", "Catalogue"], ["loans", "Who has what"], ["overview", "Overview"]];
      if (HEADS.includes(role)) return [["overview", "Overview"], ["loans", "Who has what"], ["catalogue", "Catalogue"]];
      if (role === "teacher") return [["shelf", "My class books"], ["catalogue", "Catalogue"]];
      if (role === "student" || role === "parent") return [["mine", role === "parent" ? "My child's books" : "My books"], ["catalogue", "Catalogue"]];
      return [["catalogue", "Catalogue"]];
    case "stores": {
      const keeper = ["store_keeper", "staff", "super_admin"].includes(role);
      const head = ["head_of_institution", "group_principal"].includes(role);
      const stock = STORE_VIEWERS.includes(role);
      return [
        ...(stock ? ([["stock", "Stock"]] as TabDef[]) : []),
        ["requests", keeper || head ? "Requests" : "My requests"],
        ...(keeper ? ([["count", "Stocktake"]] as TabDef[]) : []),
        ...(stock ? ([["history", "Movements"]] as TabDef[]) : []),
      ];
    }
    case "transport": {
      if (role === "transport_attendant") return [];
      const overseer = ["head_of_institution", "group_principal", "super_admin"].includes(role);
      return [...(overseer ? ([["movement", "Arrivals and departures"]] as TabDef[]) : []), ["runs", "Today's runs"], ["fleet", "Fleet"], ["routes", "Routes and learners"]];
    }
    case "staff-attendance":
      return HEADS.includes(role)
        ? [["day", "Day"], ["summary", "Summary"], ["leave", "Leave"], ["duties", "Duties"], ["settings", "Settings"]]
        : [["today", "Today"], ["summary", "My attendance"], ["leave", "My leave"]];
    default:
      return [];
  }
}

/** The section the page should show: the one in the address, else the first the role has. */
export function useModuleTab(module: string): string {
  const { user } = useAuth();
  const params = useSearchParams();
  const tabs = moduleTabs(module, user?.role);
  const asked = params.get("tab");
  return tabs.find(([k]) => k === asked)?.[0] ?? tabs[0]?.[0] ?? "";
}

/** Opens another section of the current page (used by "go and set this up" buttons inside a page). */
export function useGoToTab(): (key: string) => void {
  const router = useRouter();
  const pathname = usePathname();
  return (key) => router.replace(`${pathname}?tab=${key}`, { scroll: false });
}
