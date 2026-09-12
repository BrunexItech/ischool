"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, User } from "./api";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  setSession: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "ischool_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing initial auth from localStorage, unavailable during SSR
        setToken(parsed.token);
        setUser(parsed.user);
      }
    } catch {
      // ignore corrupted storage
    }
    setLoading(false);
  }, []);

  function setSession(newToken: string, newUser: User) {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, user: newUser }));
  }

  async function login(email: string, password: string) {
    const result = await api.login(email, password);
    setSession(result.access_token, result.user);
    return result.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
