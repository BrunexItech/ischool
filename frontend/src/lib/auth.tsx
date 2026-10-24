"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, School, User } from "./api";

export interface SchoolOption {
  id: number;
  name: string;
  isHome: boolean;
}

interface AuthState {
  token: string | null;
  /** The signed-in person's identity, with `school_id` pointing at whichever
   * school they're currently viewing — their own by default, or a branch
   * they've switched into if they own a group of schools. */
  user: User | null;
  /** Schools this person can switch between: their own school plus any
   * branches under it for a group-owning school_admin, or the explicit set
   * a super-admin linked them to for a supervisor. Empty otherwise. */
  schoolOptions: SchoolOption[];
  viewingSchoolId: number | null;
  switchSchool: (schoolId: number) => void;
  /** A supervisor's pages are read-only until they deliberately turn this
   * on for the school they're currently viewing. Meaningless for anyone
   * else. */
  editingEnabled: boolean;
  toggleEditing: () => void;
  loading: boolean;
  login: (email: string, password: string, persist?: boolean) => Promise<User>;
  logout: () => void;
  setSession: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "ischool_auth";
const VIEWING_SCHOOL_KEY = "ischool_viewing_school";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [realUser, setRealUser] = useState<User | null>(null);
  const [viewingSchoolId, setViewingSchoolId] = useState<number | null>(null);
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const storedViewing = sessionStorage.getItem(VIEWING_SCHOOL_KEY);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing initial auth from storage, unavailable during SSR
        setToken(parsed.token);
        setRealUser(parsed.user);
        setViewingSchoolId(storedViewing ? Number(storedViewing) : parsed.user?.school_id ?? null);
      }
    } catch {
      // ignore corrupted storage
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token || !realUser) return;

    if (realUser.role === "head_of_institution" && realUser.school_id) {
      let cancelled = false;
      Promise.all([api.getSchool(token, realUser.school_id), api.listBranches(token, realUser.school_id)])
        .then(([home, branches]: [School, School[]]) => {
          if (cancelled || branches.length === 0) return;
          setSchoolOptions([
            { id: home.id, name: home.name, isHome: true },
            ...branches.map((b) => ({ id: b.id, name: b.name, isHome: false })),
          ]);
        })
        .catch(() => setSchoolOptions([]));
      return () => {
        cancelled = true;
      };
    }

    if (realUser.role === "group_principal") {
      let cancelled = false;
      api
        .listMyLinkedSchools(token)
        .then((schools) => {
          if (cancelled) return;
          setSchoolOptions(schools.map((s) => ({ id: s.id, name: s.name, isHome: false })));
        })
        .catch(() => setSchoolOptions([]));
      return () => {
        cancelled = true;
      };
    }
  }, [token, realUser]);

  function setSession(newToken: string, newUser: User, persist = true) {
    setToken(newToken);
    setRealUser(newUser);
    setViewingSchoolId(newUser.school_id);
    setSchoolOptions([]);
    setEditingEnabled(false);
    sessionStorage.removeItem(VIEWING_SCHOOL_KEY);
    const store = persist ? localStorage : sessionStorage;
    store.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, user: newUser }));
  }

  async function login(email: string, password: string, persist = true) {
    const result = await api.login(email, password);
    setSession(result.access_token, result.user, persist);
    return result.user;
  }

  function logout() {
    setToken(null);
    setRealUser(null);
    setViewingSchoolId(null);
    setSchoolOptions([]);
    setEditingEnabled(false);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(VIEWING_SCHOOL_KEY);
  }

  function switchSchool(schoolId: number) {
    setViewingSchoolId(schoolId);
    setEditingEnabled(false); // always land read-only on a newly viewed school — a deliberate click turns editing on
    try {
      sessionStorage.setItem(VIEWING_SCHOOL_KEY, String(schoolId));
    } catch {
      // ignore storage failures (private browsing etc.)
    }
  }

  function toggleEditing() {
    setEditingEnabled((v) => !v);
  }

  const user: User | null = realUser && viewingSchoolId !== null ? { ...realUser, school_id: viewingSchoolId } : realUser;

  return (
    <AuthContext.Provider
      value={{ token, user, schoolOptions, viewingSchoolId, switchSchool, editingEnabled, toggleEditing, loading, login, logout, setSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
