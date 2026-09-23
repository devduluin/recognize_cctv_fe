"use client";
import { useRef, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { dashboardProfileRequest, defaultDashboardProfile, type DashboardProfile } from "./dashboard-profile";
import { usePathname, useRouter } from "next/navigation";
import {
  Cctv,
  Calendar,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Settings2,
  LogOut,
} from "lucide-react";
const navigation = [
  {
    group: "Overview",
    links: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    group: "Manajemen Event",
    links: [{ href: "/events", label: "Event", icon: Calendar }],
  },
  {
    group: "Sistem",
    links: [
      { href: "/master-cctv", label: "Kamera", icon: Cctv },
      { href: "/settings", label: "Pengaturan", icon: Settings2 },
    ],
  },
];
const publicRoutes = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];
export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [name, setName] = useState("Administrator");
  const [brand, setBrand] = useState(defaultDashboardProfile);
  useEffect(() => {
    if (!publicRoutes.includes(pathname)) document.title = brand.name;
  }, [brand.name, pathname]);
  useEffect(() => {
    const controller = new AbortController();
    if (localStorage.getItem("auth_token") && !publicRoutes.includes(pathname)) {
      dashboardProfileRequest(undefined, controller.signal).then(setBrand).catch(() => {});
    }
    function changed(event: Event) {
      controller.abort();
      setBrand((event as CustomEvent<DashboardProfile>).detail);
    }
    window.addEventListener("dashboard-profile-changed", changed);
    return () => {
      controller.abort();
      window.removeEventListener("dashboard-profile-changed", changed);
    };
  }, [pathname]);
  useEffect(() => {
    function syncProfile() {
      try {
        const user = JSON.parse(localStorage.getItem("user_info") || "null");
        setName(user?.full_name || "Administrator");
        if (
          !publicRoutes.includes(pathname) &&
          !localStorage.getItem("auth_token")
        ) {
          router.replace("/login");
          return;
        }
        setAuthenticated(true);
        if (
          user &&
          !user.account_type &&
          pathname !== "/onboarding" &&
          !publicRoutes.includes(pathname)
        )
          router.replace("/onboarding");
      } catch {
        router.replace("/login");
      }
    }
    syncProfile();
    window.addEventListener("profile-changed", syncProfile);
    return () => window.removeEventListener("profile-changed", syncProfile);
  }, [pathname, router]);
  function logout() {
    setBrand(defaultDashboardProfile);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    setAuthenticated(false);
    router.push("/login");
  }
  if (publicRoutes.includes(pathname) || pathname === "/onboarding")
    return <>{children}</>;
  if (!authenticated)
    return (
      <div role="status" className="grid min-h-screen place-items-center">
        Memuat…
      </div>
    );
  const eventDetail = pathname.startsWith("/events/");
  const title = eventDetail
    ? "Detail Event"
    : pathname === "/events"
      ? "Daftar Event"
      : navigation
          .flatMap((group) => group.links)
          .find((link) => link.href === pathname)?.label || "Monitoring";
  const renderNavigation = () =>
    navigation.map((group) => (
      <div className="nav-group" key={group.group}>
        <p>{group.group}</p>
        {group.links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={
              pathname === href || (href === "/events" && eventDetail)
                ? "page"
                : undefined
            }
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    ));
  return (
    <div className="admin-app">
      <a href="#page-content" className="skip-link">
        Lewati ke konten
      </a>
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">
          {brand.logo ? (
            <Image unoptimized src={brand.logo} alt="" width={32} height={40} />
          ) : (
            <span className="dashboard-initial sidebar-initial" aria-hidden="true">
              {brand.name.trim().charAt(0).toUpperCase() || "D"}
            </span>
          )}
          <span>
            <strong>{brand.name}</strong>
            <small>Dashboard Monitoring</small>
          </span>
        </Link>
        <nav aria-label="Navigasi utama">{renderNavigation()}</nav>
        <div className="sidebar-user">
          <Link
            href="/settings?tab=profile"
            className="user-initial"
            aria-label="Profil pengguna"
          >
            {name.charAt(0).toUpperCase()}
          </Link>
          <Link href="/settings?tab=profile" className="user-name">
            <strong>{name}</strong>
            <small>Administrator</small>
          </Link>
          <button
            onClick={logout}
            className="logout-button"
            aria-label="Keluar"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <header className="admin-header">
        <details
          ref={menu}
          className="mobile-menu"
          onKeyDown={(e) => {
            if (e.key === "Escape" && menu.current) {
              menu.current.open = false;
              menu.current.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            <Menu size={20} /> Menu
          </summary>
          <nav aria-label="Navigasi mobile">
            {renderNavigation()}
            <Link href="/settings?tab=profile">Profil pengguna</Link>
            <button onClick={logout}>Keluar</button>
          </nav>
        </details>
        <nav aria-label="Breadcrumb" className="breadcrumbs">
          <Link href="/">Workspace</Link>
          <ChevronRight size={16} />
          {eventDetail && (
            <>
              <Link href="/events">Daftar Event</Link>
              <ChevronRight size={16} />
            </>
          )}
          <span aria-current="page">{title}</span>
        </nav>
      </header>
      <div id="page-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
