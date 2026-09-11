"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, User } from "./api";

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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
        setToken(parsed.token);
        setUser(parsed.user);
      }
    } catch {
      // ignore corrupted storage
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const result = await api.login(email, password);
    setToken(result.access_token);
    setUser(result.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: result.access_token, user: result.user }));
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return <AuthContext.Provider value={{ token, user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
