"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
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
  /** Pass null to go back to "All Schools" (a group principal only). */
  switchSchool: (schoolId: number | null) => void;
  /** True for a group principal looking at all their schools together, not at one school. */
  isGroupView: boolean;
  /** The name of the school being viewed, for showing who this is. Empty in the group view. */
  schoolName: string | null;
  loading: boolean;
  login: (email: string, password: string, persist?: boolean) => Promise<User>;
  logout: (announce?: boolean) => void;
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
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const storedViewing = sessionStorage.getItem(VIEWING_SCHOOL_KEY);
        const principal = parsed.user?.role === "group_principal";
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing initial auth from storage, unavailable during SSR
        setToken(parsed.token);
        setRealUser(parsed.user);
        // A principal starts on "All Schools" unless they were last looking at one school.
        setViewingSchoolId(principal ? (storedViewing && storedViewing !== "all" ? Number(storedViewing) : null) : storedViewing && storedViewing !== "all" ? Number(storedViewing) : parsed.user?.school_id ?? null);
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
        .getGroupSchools(token)
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

  const nameForId = viewingSchoolId ?? realUser?.school_id ?? null;
  useEffect(() => {
    let live = true;
    if (!token || !nameForId) {
      Promise.resolve().then(() => live && setSchoolName(null));
      return () => { live = false; };
    }
    api.getSchoolBranding(token, nameForId).then((b) => live && setSchoolName(b.name)).catch(() => live && setSchoolName(null));
    return () => { live = false; };
  }, [token, nameForId]);

  function setSession(newToken: string, newUser: User, persist = true) {
    setToken(newToken);
    setRealUser(newUser);
    setViewingSchoolId(newUser.role === "group_principal" ? null : newUser.school_id);
    setSchoolOptions([]);
    sessionStorage.removeItem(VIEWING_SCHOOL_KEY);
    const store = persist ? localStorage : sessionStorage;
    store.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, user: newUser }));
  }

  async function login(email: string, password: string, persist = true) {
    const result = await api.login(email, password);
    setSession(result.access_token, result.user, persist);
    return result.user;
  }

  /** Toasts only when `announce` is true — the deliberate "Log out" click,
   * not the internal cleanup when a login attempt is rejected for being
   * the wrong portal (that path already shows its own error). */
  function logout(announce = false) {
    setToken(null);
    setRealUser(null);
    setViewingSchoolId(null);
    setSchoolOptions([]);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(VIEWING_SCHOOL_KEY);
    if (announce) toast.success("Signed out");
  }

  function switchSchool(schoolId: number | null) {
    setViewingSchoolId(schoolId);
    try {
      sessionStorage.setItem(VIEWING_SCHOOL_KEY, schoolId === null ? "all" : String(schoolId));
    } catch {
      // ignore storage failures (private browsing etc.)
    }
  }

  const isGroupView = realUser?.role === "group_principal" && viewingSchoolId === null;
  // In the group view a principal is not "in" any one school, so school_id is empty there.
  const user: User | null = realUser ? (realUser.role === "group_principal" ? { ...realUser, school_id: viewingSchoolId } : viewingSchoolId !== null ? { ...realUser, school_id: viewingSchoolId } : realUser) : realUser;

  return (
    <AuthContext.Provider
      value={{ token, user, schoolOptions, viewingSchoolId, switchSchool, isGroupView, schoolName, loading, login, logout, setSession }}
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
