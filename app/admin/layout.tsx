"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"] });

interface NavChildItem { href: string; label: string; }
interface NavItem {
  href?: string; icon?: string; label: string;
  badge?: string; children?: NavChildItem[];
}
interface NavGroup { label: string; items: NavItem[]; }

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", icon: "▣", label: "Dashboard" },
      { href: "/admin/analytics", icon: "◈", label: "Analytics" },
    ],
  },
  {
    label: "Management",
    items: [
      {
        label: "Users", icon: "◉", badge: "1.2k",
        children: [
          { href: "/admin/users/signups", label: "Signups" },
          { href: "/admin/users/otp", label: "Send & Verify OTP" },
        ],
      },
      // { href: "/admin/content", icon: "◧", label: "Content / Posts"   },
      // { href: "/admin/orders",  icon: "◫", label: "Orders & Payments", badge: "8" },
    ],
  },
  {
    label: "Auth",
    items: [{ href: "/admin/otp-logs", icon: "⊡", label: "OTP Logs" }],
  },
  {
    label: "Home Data Components",
    items: [
      {
        label: "Teams 360", icon: "◉",
        children: [
          { href: "/admin/team360-management/add-team360", label: "Add Teams 360" },
          { href: "/admin/team360-management/team360-list", label: "Teams 360 List" },
        ],
      },
      {
        label: "Teams 360 Playlist", icon: "◉",
        children: [
          { href: "/admin/team360playlist-management/add-team360playlist", label: "Add Teams 360 Playlist" },
          { href: "/admin/team360playlist-management/team360playlist-list", label: "Teams 360 Playlist List" },
        ],
      },
      {
        label: "Players 360", icon: "◉",
        children: [
          { href: "/admin/player360-management/add-player360", label: "Add Player 360" },
          { href: "/admin/player360-management/player360-list", label: "Player 360 List" },
        ],
      },
      {
        label: "Cricket Articles", icon: "◉",
        children: [
          { href: "/admin/cricketarticles-management/add-cricketarticles", label: "Add Cricket Article" },
          { href: "/admin/cricketarticles-management/cricketarticles-list", label: "Cricket Articles List" },
        ],
      },
      {
        label: "Club Profiles", icon: "◉",
        children: [
          { href: "/admin/clubprofile-management/add-clubprofile", label: "Add Club Profile" },
          { href: "/admin/clubprofile-management/clubprofile-list", label: "Club Profiles List" },
        ],
      },
       {
        label: "Player Profiles", icon: "◉",
        children: [
          { href: "/admin/playerprofile-management/add-playerprofile", label: "Add Player Profile" },
          { href: "/admin/playerprofile-management/playerprofile-list", label: "Player Profiles List" },
        ],
      },
       {
        label: "Player Profiles Playlist", icon: "◉",
        children: [
          { href: "/admin/playerprofileplaylist-management/add-playerprofileplaylist", label: "Add Player Profiles Playlist" },
          { href: "/admin/playerprofileplaylist-management/playerprofileplaylist-list", label: "Player Profiles Palylist" },
        ],
      },
      {
        label: "Watch Along", icon: "◉",
        children: [
          { href: "/admin/watchalong-management/add-watchalong", label: "Add Watch Along" },
          { href: "/admin/watchalong-management/watchalong-list", label: "Watch Along List" },
        ],
      },
        {
        label: "Host Screen", icon: "◉",
        children: [
          { href: "/admin/hostroom-management/add-hostroom", label: "Add Host Room" },
          { href: "/admin/hostroom-management/hostroom-list", label: "Host Room List" },
        ],
      },
      {
        label: "Host Login Screen", icon: "◉",
        children: [
          { href: "/admin/hostloginscreen-management/add-hostroomlogin", label: "Add Host Login Form" },
          { href: "/admin/hostloginscreen-management/hostroomlogin-list", label: "Host Members List" },
        ],
      },
       {
        label: "Audio Messages Screen", icon: "◉",
        children: [
          // { href: "/admin/hostloginscreen-management/add-hostroomlogin", label: "Add Host Login Form" },
          { href: "/admin/audiomessages-management", label: "Audio Messages List" },
        ],
      },
      // { href: "/admin/content", icon: "◧", label: "Content / Posts"   },
      // { href: "/admin/orders",  icon: "◫", label: "Orders & Payments", badge: "8" },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin/settings", icon: "⊙", label: "Settings" }],
  },

];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (label: string) =>
    setOpenMenus(p => ({ ...p, [label]: !p[label] }));

  const pageTitle = (() => {
    if (pathname === "/admin") return "Dashboard";
    const seg = pathname.split("/").pop() ?? "";
    return seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  })();

  const SidebarContent = () => (
  <>
    {/* Logo */}
    <div style={{
      height: 52, display: "flex", alignItems: "center",
      justifyContent: "space-between",
      gap: 10, padding: "0 16px",
      borderBottom: "1px solid #21282f",
      fontSize: 14, fontWeight: 600, flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 5, background: "#1f6feb",
          display: "grid", placeItems: "center",
          fontSize: 11, fontWeight: 700, color: "#fff",
        }}>A</div>
        AdminConsole
      </div>
      {/* Close button — mobile only */}
      <button
        onClick={() => setSidebarOpen(false)}
        style={{
          background: "none", border: "none", color: "#7d8590",
          fontSize: 18, cursor: "pointer", padding: 4,
          display: "block",
        }}
        className="md-hide-close"
      >✕</button>
    </div>

    {/* Nav groups - with hidden scrollbar */}
    <div style={{ 
      overflowY: "auto", 
      flex: 1,
      /* Hide scrollbar for Chrome, Safari and Opera */
      scrollbarWidth: "none", /* Firefox */
      msOverflowStyle: "none", /* IE and Edge */
    }}
    className="hide-scrollbar">
      {NAV.map((group) => (
        <div key={group.label} style={{ padding: "12px 0", borderBottom: "1px solid #21282f" }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: ".08em",
            color: "#7d8590", textTransform: "uppercase", padding: "0 16px 6px",
          }}>{group.label}</div>

          {group.items.map((item) => {
            if (item.children) {
              const isOpen = openMenus[item.label] ?? pathname.startsWith("/admin/users");
              return (
                <div key={item.label}>
                  <div
                    onClick={() => toggleMenu(item.label)}
                    style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "7px 16px", cursor: "pointer",
                      color: "#7d8590", fontSize: 13,
                    }}
                  >
                    <span style={{ width: 15 }}>{item.icon}</span>
                    {item.label}
                    {item.badge && (
                      <span style={{
                        marginLeft: "auto", background: "#1f6feb", color: "#fff",
                        fontSize: 10, fontFamily: plexMono.style.fontFamily,
                        padding: "1px 6px", borderRadius: 10, fontWeight: 600,
                      }}>{item.badge}</span>
                    )}
                    <span style={{ marginLeft: item.badge ? 6 : "auto", fontSize: 10 }}>
                      {isOpen ? "▼" : "▶"}
                    </span>
                  </div>
                  {isOpen && item.children?.map((sub) => {
                    const active = pathname === sub.href;
                    return (
                      <Link key={sub.href} href={sub.href} style={{ textDecoration: "none" }}
                        onClick={() => setSidebarOpen(false)}>
                        <div style={{
                          padding: "6px 16px 6px 36px", fontSize: 12, cursor: "pointer",
                          color: active ? "#e6edf3" : "#7d8590",
                          background: active ? "rgba(31,111,235,.1)" : "transparent",
                          borderLeft: `2px solid ${active ? "#388bfd" : "transparent"}`,
                        }}>• {sub.label}</div>
                      </Link>
                    );
                  })}
                </div>
              );
            }

            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href || "#"} style={{ textDecoration: "none" }}
                onClick={() => setSidebarOpen(false)}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "7px 16px", cursor: "pointer",
                  color: active ? "#e6edf3" : "#7d8590", fontSize: 13,
                  borderLeft: `2px solid ${active ? "#388bfd" : "transparent"}`,
                  background: active ? "rgba(31,111,235,.1)" : "transparent",
                }}>
                  <span style={{ width: 15 }}>{item.icon}</span>
                  {item.label}
                  {item.badge && (
                    <span style={{
                      marginLeft: "auto", background: "#1f6feb", color: "#fff",
                      fontSize: 10, fontFamily: plexMono.style.fontFamily,
                      padding: "1px 6px", borderRadius: 10, fontWeight: 600,
                    }}>{item.badge}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  </>
);

  return (
    <html lang="en">
      <head>
        <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; }

          .admin-shell {
            display: flex;
            height: 100vh;
            overflow: hidden;
            background: #0d1117;
            color: #e6edf3;
            font-family: ${plexSans.style.fontFamily};
          }

          /* Desktop sidebar */
          .sidebar-desktop {
            width: 220px;
            flex-shrink: 0;
            background: #161b22;
            border-right: 1px solid #21282f;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
          }

          /* Mobile overlay sidebar */
          .sidebar-overlay {
            position: fixed;
            inset: 0;
            z-index: 50;
            display: flex;
          }
          .sidebar-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,.6);
          }
          .sidebar-drawer {
            position: relative;
            width: 240px;
            background: #161b22;
            display: flex;
            flex-direction: column;
            height: 100%;
            z-index: 1;
            animation: slideIn .2s ease;
          }
          @keyframes slideIn {
            from { transform: translateX(-100%); }
            to   { transform: translateX(0); }
          }

          /* Hamburger — visible on mobile */
          .hamburger { display: none; }

          /* Hide close btn on desktop */
          .md-hide-close { display: none !important; }

          @media (max-width: 768px) {
            .sidebar-desktop { display: none; }
            .hamburger { display: flex !important; }
            .md-hide-close { display: block !important; }
          }

          /* Responsive content */
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
            margin-bottom: 20px;
          }
          .chart-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 14px;
            margin-bottom: 20px;
          }

          @media (max-width: 1024px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .chart-grid { grid-template-columns: 1fr; }
          }

          @media (max-width: 480px) {
            .stats-grid { grid-template-columns: 1fr 1fr; }
          }

          /* Table scroll on mobile */
          .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }

          /* Content padding */
          .main-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px 24px;
          }
          @media (max-width: 768px) {
            .main-content { padding: 16px; }
          }

          /* Topbar search hide on small */
          .search-bar {
            background: #0d1117;
            border: 1px solid #2d3748;
            border-radius: 6px;
            padding: 5px 10px;
            color: #e6edf3;
            font-size: 12px;
            width: 220px;
            outline: none;
          }
          @media (max-width: 640px) {
            .search-bar { display: none; }
          }
        `}</style>
      </head>
      <body>
        <div className="admin-shell">

          {/* Desktop Sidebar */}
          <nav className="sidebar-desktop">
            <SidebarContent />
          </nav>

          {/* Mobile Sidebar Overlay */}
          {sidebarOpen && (
            <div className="sidebar-overlay">
              <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
              <div className="sidebar-drawer">
                <SidebarContent />
              </div>
            </div>
          )}

          {/* Main */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Topbar */}
            <div style={{
              height: 52, flexShrink: 0,
              background: "#161b22", borderBottom: "1px solid #21282f",
              display: "flex", alignItems: "center", gap: 12, padding: "0 20px",
            }}>
              {/* Hamburger */}
              <button
                className="hamburger"
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: "none", border: "none", color: "#e6edf3",
                  fontSize: 20, cursor: "pointer", padding: 4,
                  alignItems: "center",
                }}
              >☰</button>

              <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{pageTitle}</div>

              <div style={{
                fontFamily: plexMono.style.fontFamily, fontSize: 10,
                background: "rgba(46,160,67,.15)", color: "#2ea043",
                padding: "2px 8px", borderRadius: 12, border: "1px solid #2ea043",
                whiteSpace: "nowrap",
              }}>● LIVE</div>

              <input placeholder="Search…" className="search-bar" />

              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg,#1f6feb,#388bfd)",
                display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700,
              }}>AD</div>
            </div>

            {/* Page content */}
            <div className="main-content">
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}