"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowLeftRight, BookMarked, BookText, BookOpenCheck, Boxes, Bus, Car, ClipboardCheck, ClipboardList, DoorOpen, FileText, Footprints,
  History, Home, LayoutGrid, Layers, ListChecks, ListTree, MapPin, Receipt, Route, Scale, ShoppingCart, Stethoscope, TrendingUp, Truck, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export type TabDef = [key: string, label: string, icon: LucideIcon];

// The staff whose whole day is spent inside one busy module get its sections in the sidebar, each with its own
// icon. Everyone else (heads, principals, teachers...) keeps the module exactly as it always was: one link and the
// original tabs inside the page.
const IN_SIDEBAR: Record<string, string[]> = {
  security: ["security"],
  boarding_staff: ["boarding"],
  transport_staff: ["transport"],
  librarian: ["library"],
  store_keeper: ["stores"],
  bursar: ["fees", "ledger", "procurement"],
  accountant: ["fees", "ledger", "procurement"],
  procurement_officer: ["procurement", "stores"],
};

export function expandedInSidebar(role: string | undefined, module: string): boolean {
  return !!role && (IN_SIDEBAR[role] ?? []).includes(module) && moduleTabs(module, role).length > 1;
}

/** The sections inside a module, for one role. */
export function moduleTabs(module: string, role: string | undefined): TabDef[] {
  if (!role) return [];
  switch (module) {
    case "security":
      return [["visitors", "Visitors", Users], ["passes", "Gate passes", ClipboardCheck], ["vehicles", "Vehicles", Car], ["incidents", "Incidents", AlertTriangle], ["patrols", "Patrols", Footprints]];
    case "boarding":
      return [["houses", "Houses and beds", Home], ["roll", "Roll call", ClipboardCheck], ["exeats", "Leave-outs", DoorOpen], ["sick", "Sick bay", Stethoscope], ["incidents", "Incidents", AlertTriangle]];
    case "ledger":
      return [["is", "Income statement", TrendingUp], ["bs", "Balance sheet", Scale], ["tb", "Trial balance", ListChecks], ["jr", "Journal", BookText], ["coa", "Chart of accounts", ListTree]];
    case "procurement":
      return [["requisitions", "Requisitions", FileText], ["orders", "Purchase orders", ShoppingCart]];
    case "fees":
      return role === "secretary" ? [] : [["balances", "Balances and arrears", Wallet], ["structure", "Fee structure", Layers], ["invoices", "Invoices and payments", Receipt]];
    case "library":
      if (role === "librarian") return [["desk", "Lend and return", ArrowLeftRight], ["catalogue", "Catalogue", BookMarked], ["loans", "Who has what", BookOpenCheck], ["overview", "Overview", LayoutGrid]];
      return [];
    case "stores": {
      const keeper = ["store_keeper", "staff", "super_admin"].includes(role);
      const stock = ["store_keeper", "staff", "super_admin", "head_of_institution", "group_principal", "procurement_officer", "bursar", "accountant"].includes(role);
      return [
        ...(stock ? ([["stock", "Stock", Boxes]] as TabDef[]) : []),
        ["requests", keeper ? "Requests" : "My requests", ClipboardList],
        ...(keeper ? ([["count", "Stocktake", ClipboardCheck]] as TabDef[]) : []),
        ...(stock ? ([["history", "Movements", History]] as TabDef[]) : []),
      ];
    }
    case "transport":
      return role === "transport_staff" ? [["runs", "Today's runs", Bus], ["fleet", "Fleet", Truck], ["routes", "Routes and learners", Route]] : [];
    default:
      return [];
  }
}

/** The section the address asks for, when this role's sections are in the sidebar; else "" (the page keeps its own tabs). */
export function useModuleTab(module: string): string {
  const { user } = useAuth();
  const params = useSearchParams();
  if (!expandedInSidebar(user?.role, module)) return "";
  const tabs = moduleTabs(module, user?.role);
  const asked = params.get("tab");
  return tabs.find(([k]) => k === asked)?.[0] ?? tabs[0]?.[0] ?? "";
}

export function useGoToTab(): (key: string) => void {
  const router = useRouter();
  const pathname = usePathname();
  return (key) => router.replace(`${pathname}?tab=${key}`, { scroll: false });
}
