"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api, FamilyChildCard, Student } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Which child a parent is looking at. Remembered between visits and shared by the menu and the pages. */
const KEY = "milai.activeChild";
const listeners = new Set<() => void>();
let current: number | null = null;
let loaded = false;

function read(): number | null {
  if (!loaded) {
    loaded = true;
    try {
      const raw = window.localStorage.getItem(KEY);
      current = raw ? Number(raw) || null : null;
    } catch {
      current = null;
    }
  }
  return current;
}

export function setActiveChildId(id: number) {
  current = id;
  loaded = true;
  try {
    window.localStorage.setItem(KEY, String(id));
  } catch {
    /* storage can be unavailable; the choice then lasts for this visit only */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

let cache: { token: string; cards: FamilyChildCard[] } | null = null;

/** The learners this account looks after (a parent's children, or the student themself). */
export function useFamily() {
  const { token, user } = useAuth();
  const stored = useSyncExternalStore(subscribe, read, () => null);
  const [cards, setCards] = useState<FamilyChildCard[] | null | undefined>(cache && cache.token === token ? cache.cards : undefined);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token || !user || (user.role !== "parent" && user.role !== "student")) return;
    let live = true;
    const plain = (kids: Student[]): FamilyChildCard[] => kids.map((student) => ({ student, today: new Date().toLocaleDateString("en-CA"), attendance: null, fees: null, homework: null, lessons: null, latest_award: null }));
    api.getFamilyOverview(token)
      .catch(async () => {
        // The summary is a bonus. If it is unavailable, the learners and every section must still show.
        const kids = user.role === "student" ? [await api.getMyStudentRecord(token)] : await api.listMyChildren(token);
        return { children: plain(kids) };
      })
      .then((r) => { cache = { token, cards: r.children }; if (live) setCards(r.children); })
      .catch(() => { if (live) setCards((prev) => prev ?? null); });
    return () => { live = false; };
  }, [token, user, version]);

  const list = cards ?? [];
  const active = list.find((c) => c.student.id === stored) ?? list[0] ?? null;
  const reload = useCallback(() => { setCards(undefined); setVersion((v) => v + 1); }, []);
  return { cards, list, active, setActive: setActiveChildId, reload, isParent: user?.role === "parent" };
}

/** Where a section of a learner's record lives for this account. */
export function recordPath(role: string | undefined, studentId: number | undefined, tab?: string) {
  const base = role === "student" ? "/dashboard/my-records" : studentId ? `/dashboard/children/${studentId}` : "/dashboard/children";
  return tab && !(tab === "overview" && role !== "student") ? `${base}?tab=${tab}` : base;
}
