"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthSession, persistDesktopSession, type AuthUser } from "./auth-api";
import { visitorFetch } from "./visitor-fetch";

const publicRoutes = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);
type Access = {
  user: AuthUser | null; loading: boolean; error: string;
  can: (permission: string) => boolean; refresh: () => Promise<void>;
};
const Context = createContext<Access>({ user: null, loading: true, error: "", can: () => false, refresh: async () => {} });

export function AccessProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sequence = useRef(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const requestId = ++sequence.current;
    const token = localStorage.getItem("auth_token");
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const response = await visitorFetch(`${process.env.NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV || ""}/api/v1/auth/me`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (requestId !== sequence.current || localStorage.getItem("auth_token") !== token) return;
      if (!response.ok) {
        if (response.status === 401) {
          setUser(null);
          clearAuthSession();
          router.replace("/login");
        }
        throw new Error(typeof payload?.detail === "string" ? payload.detail : "Hak akses belum dapat dimuat.");
      }
      if (!payload?.result?.user) throw new Error("Respons hak akses tidak lengkap.");
      persistDesktopSession({ token, user: payload.result.user });
      setUser(payload.result.user);
      localStorage.setItem("user_info", JSON.stringify(payload.result.user));
      setError("");
    } catch (cause) {
      if (requestId !== sequence.current) return;
      setError(cause instanceof Error ? cause.message : "Hak akses belum dapat dimuat.");
    } finally { if (requestId === sequence.current) setLoading(false); }
  }, [router]);
  useEffect(() => {
    if (publicRoutes.has(pathname)) return;
    const initial = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 60000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    window.addEventListener("profile-changed", focus);
    return () => { clearTimeout(initial); clearInterval(interval); window.removeEventListener("focus", focus); window.removeEventListener("profile-changed", focus); };
  }, [pathname, refresh]);
  return <Context.Provider value={{ user, loading, error, refresh, can: permission => !!user?.permissions?.includes(permission) }}>{children}</Context.Provider>;
}
export const useAccess = () => useContext(Context);
