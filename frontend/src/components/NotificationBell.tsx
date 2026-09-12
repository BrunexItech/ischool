"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api, Notification } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    function refreshCount() {
      if (!token) return;
      api.getUnreadNotificationCount(token).then((r) => setUnreadCount(r.count)).catch(() => {});
    }
    refreshCount();
    const interval = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && token) {
      const list = await api.listNotifications(token);
      setNotifications(list);
    }
  }

  async function handleItemClick(n: Notification) {
    if (!token || n.is_read) return;
    const updated = await api.markNotificationRead(token, n.id);
    setNotifications((all) => all.map((x) => (x.id === n.id ? updated : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function handleMarkAllRead() {
    if (!token) return;
    await api.markAllNotificationsRead(token);
    setNotifications((all) => all.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell />
            {unreadCount > 0 && (
              <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`flex flex-col items-start gap-0.5 whitespace-normal ${n.is_read ? "opacity-60" : ""}`}
            >
              <span className="text-sm font-medium">{n.title}</span>
              <span className="text-xs text-muted-foreground">{n.body}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
            </DropdownMenuItem>
          ))}
          {notifications.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
