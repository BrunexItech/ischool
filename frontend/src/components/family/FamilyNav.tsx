"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Award, BarChart3, Bus, CalendarClock, Check, ChevronsUpDown, ClipboardList, LayoutGrid, LogOut, MapPin, NotebookPen, ShieldCheck, Trophy, Users, UserCheck, Video, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { recordPath, useFamily } from "@/lib/family";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChildAvatar } from "@/components/family/FamilyUi";
import { setActiveChildId } from "@/lib/family";

const ITEMS = [
  { tab: "overview", label: "Summary", icon: LayoutGrid },
  { tab: "timetable", label: "Timetable", icon: CalendarClock },
  { tab: "homework", label: "Homework", icon: NotebookPen },
  { tab: "exams", label: "Exams", icon: ClipboardList },
  { tab: "results", label: "Results", icon: BarChart3 },
  { tab: "live-classes", label: "Live classes", icon: Video },
  { tab: "attendance", label: "Attendance", icon: UserCheck },
  { tab: "transport", label: "Transport", icon: Bus },
  { tab: "pickup", label: "Pickup and drop-off", icon: LogOut },
  { tab: "activities", label: "Activities", icon: Trophy },
  { tab: "trips", label: "Trips", icon: MapPin },
  { tab: "fees", label: "Fees", icon: Wallet },
  { tab: "awards", label: "Awards", icon: Award },
  { tab: "conduct", label: "Conduct", icon: ShieldCheck },
];

function Items({ query, onNavigate }: { query: string; onNavigate: () => void }) {
  const { user } = useAuth();
  const { list, active } = useFamily();
  const pathname = usePathname();
  const search = useSearchParams();
  if (!user) return null;
  const isParent = user.role === "parent";
  const tab = search.get("tab") ?? (isParent ? "overview" : "timetable");
  const items = ITEMS.filter((i) => (isParent || (i.tab !== "pickup" && i.tab !== "overview")) && (!query || i.label.toLowerCase().includes(query)));
  if (items.length === 0) return null;
  const idx = active ? list.findIndex((c) => c.student.id === active.student.id) : 0;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="gap-1.5 text-sidebar-primary/90">{isParent ? "My Child" : "My School Life"}</SidebarGroupLabel>
      <SidebarGroupContent>
        {isParent && active && list.length > 1 && (
          <div className="mb-2 px-1 group-data-[collapsible=icon]:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button type="button" className="flex h-11 w-full items-center gap-2.5 rounded-xl bg-black/15 px-2 text-left transition-colors hover:bg-black/25">
                    <ChildAvatar first={active.student.first_name} last={active.student.last_name} index={idx} size={30} />
                    <span className="grid min-w-0 flex-1"><span className="truncate text-sm font-medium">{active.student.first_name} {active.student.last_name}</span><span className="truncate text-[11px] text-sidebar-foreground/60">{active.student.class_name ?? "Switch child"}</span></span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
                  </button>
                }
              />
              <DropdownMenuContent align="start" className="w-60">
                {list.map((c, i) => (
                  <DropdownMenuItem key={c.student.id} onClick={() => setActiveChildId(c.student.id)}>
                    <ChildAvatar first={c.student.first_name} last={c.student.last_name} index={i} size={26} />
                    <span className="flex-1 truncate">{c.student.first_name} {c.student.last_name}</span>
                    {c.student.id === active?.student.id && <Check className="size-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <SidebarMenu>
          {items.map((item) => {
            const href = recordPath(user.role, active?.student.id, item.tab);
            const onRecord = pathname === href.split("?")[0];
            const on = onRecord && tab === item.tab;
            return (
              <SidebarMenuItem key={item.tab}>
                <SidebarMenuButton
                  isActive={on}
                  tooltip={item.label}
                  className={on ? "rounded-full bg-sidebar-primary font-semibold text-sidebar-primary-foreground before:hidden hover:bg-sidebar-primary hover:text-sidebar-primary-foreground data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground" : "rounded-full text-sidebar-foreground/85"}
                  render={<Link href={href} onClick={onNavigate}><item.icon /><span className="flex-1">{item.label}</span></Link>}
                />
              </SidebarMenuItem>
            );
          })}
          {isParent && (!query || "my children".includes(query)) && (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/dashboard/children"}
                tooltip="My children"
                className={pathname === "/dashboard/children" ? "rounded-full bg-sidebar-primary font-semibold text-sidebar-primary-foreground before:hidden hover:bg-sidebar-primary hover:text-sidebar-primary-foreground data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground" : "rounded-full text-sidebar-foreground/85"}
                render={<Link href="/dashboard/children" onClick={onNavigate}><Users /><span className="flex-1">All my children</span></Link>}
              />
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function FamilyNav({ query, onNavigate }: { query: string; onNavigate: () => void }) {
  return (
    <Suspense fallback={null}>
      <Items query={query} onNavigate={onNavigate} />
    </Suspense>
  );
}
