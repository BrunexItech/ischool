"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
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

// One shared copy of the family's data. The menu, the home page and the child pages all read it, and it is fetched once.
type Store = { key: string | null; kids: Student[] | undefined; rich: FamilyChildCard[] | undefined; failed: boolean };
let store: Store = { key: null, kids: undefined, rich: undefined, failed: false };
const storeListeners = new Set<() => void>();
const emit = (next: Partial<Store>) => { store = { ...store, ...next }; storeListeners.forEach((l) => l()); };
const subscribeStore = (cb: () => void) => { storeListeners.add(cb); return () => { storeListeners.delete(cb); }; };
const getStore = () => store;
const serverStore: Store = { key: null, kids: undefined, rich: undefined, failed: false };
const LIST_KEY = "milai.family.kids";

const plain = (kids: Student[]): FamilyChildCard[] =>
  kids.map((student) => ({ student, today: new Date().toLocaleDateString("en-CA"), attendance: null, fees: null, homework: null, lessons: null, latest_award: null }));

function load(token: string, role: string, userId: number) {
  const key = `${role}:${userId}`;
  if (store.key === key) return;
  let remembered: Student[] | undefined;
  try {
    const raw = window.localStorage.getItem(`${LIST_KEY}.${key}`);
    remembered = raw ? (JSON.parse(raw) as Student[]) : undefined;
  } catch {
    remembered = undefined;
  }
  // The menu only needs the names, so it can appear at once from the last visit while fresh data arrives.
  emit({ key, kids: remembered, rich: undefined, failed: false });
  const kidsCall = role === "student" ? api.getMyStudentRecord(token).then((k) => [k]) : api.listMyChildren(token);
  kidsCall
    .then((kids) => {
      if (store.key !== key) return;
      emit({ kids });
      try { window.localStorage.setItem(`${LIST_KEY}.${key}`, JSON.stringify(kids)); } catch { /* remembering is optional */ }
    })
    .catch(() => { if (store.key === key && !store.kids) emit({ failed: true }); });
  api.getFamilyOverview(token)
    .then((r) => { if (store.key === key) emit({ rich: r.children }); })
    .catch(() => { /* the summary is a bonus: pages fall back to the plain list */ });
}

/** The learners this account looks after (a parent's children, or the student themself). */
export function useFamily() {
  const { token, user } = useAuth();
  const stored = useSyncExternalStore(subscribe, read, () => null);
  const snap = useSyncExternalStore(subscribeStore, getStore, () => serverStore);

  useEffect(() => {
    if (!token || !user || (user.role !== "parent" && user.role !== "student")) return;
    load(token, user.role, user.id);
  }, [token, user]);

  const cards: FamilyChildCard[] | null | undefined = snap.rich ?? (snap.kids ? plain(snap.kids) : snap.failed ? null : undefined);
  const list = cards ?? [];
  const active = list.find((c) => c.student.id === stored) ?? list[0] ?? null;
  const reload = useCallback(() => {
    const t = token;
    if (!t) return;
    emit({ rich: undefined });
    api.getFamilyOverview(t).then((r) => emit({ rich: r.children })).catch(() => undefined);
  }, [token]);
  return { cards, list, active, detailed: snap.rich !== undefined, setActive: setActiveChildId, reload, isParent: user?.role === "parent" };
}

/** Where a section of a learner's record lives for this account. */
export function recordPath(role: string | undefined, studentId: number | undefined, tab?: string) {
  const base = role === "student" ? "/dashboard/my-records" : studentId ? `/dashboard/children/${studentId}` : "/dashboard/children";
  return tab && !(tab === "overview" && role !== "student") ? `${base}?tab=${tab}` : base;
}
