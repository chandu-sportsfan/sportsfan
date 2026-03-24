// "use client";

// import { usePathname } from "next/navigation";
// import Link from "next/link";
// import { useState } from "react";
// import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300","400","500","600"] });
// const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400","500"] });

// const NAV = [
//   {
//     label: "Overview",
//     items: [
//       { href: "/admin", icon: "▣", label: "Dashboard" },
//       { href: "/admin/analytics", icon: "◈", label: "Analytics" },
//     ],
//   },
//   {
//     label: "Management",
//     items: [
//       {
//         label: "Users",
//         icon: "◉",
//         badge: "1.2k",
//         children: [
//           { href: "/admin/users/signups", label: "Signups" },
//           { href: "/admin/users/otp", label: "Send & Verify OTP" },
//         ],
//       },
//       { href: "/admin/content", icon: "◧", label: "Content / Posts" },
//       { href: "/admin/orders", icon: "◫", label: "Orders & Payments", badge: "8" },
//     ],
//   },
//   {
//     label: "Auth",
//     items: [
//       { href: "/admin/otp-logs", icon: "⊡", label: "OTP Logs" },
//     ],
//   },
//   {
//     label: "System",
//     items: [
//       { href: "/admin/settings", icon: "⊙", label: "Settings" },
//     ],
//   },
// ];

// export default function AdminLayout({ children }: { children: React.ReactNode }) {
//   const pathname = usePathname();

//   const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({});

//   const toggleMenu = (label: string) => {
//     setOpenMenus((prev) => ({
//       ...prev,
//       [label]: !prev[label],
//     }));
//   };

//   const pageTitle = (() => {
//     if (pathname === "/admin") return "Dashboard";
//     const seg = pathname.split("/").pop() ?? "";
//     return seg.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase());
//   })();

//   return (
//     <html lang="en">
//       <body
//         style={{
//           margin: 0,
//           background: "#0d1117",
//           color: "#e6edf3",
//           height: "100vh",
//           display: "flex",
//           overflow: "hidden",
//           fontFamily: plexSans.style.fontFamily,
//         }}
//       >
//         {/* Sidebar */}
//         <nav
//           style={{
//             width: 220,
//             background: "#161b22",
//             borderRight: "1px solid #21282f",
//             display: "flex",
//             flexDirection: "column",
//             overflowY: "auto",
//           }}
//         >
//           {/* Logo */}
//           <div
//             style={{
//               height: 52,
//               display: "flex",
//               alignItems: "center",
//               gap: 10,
//               padding: "0 16px",
//               borderBottom: "1px solid #21282f",
//               fontSize: 14,
//               fontWeight: 600,
//             }}
//           >
//             <div
//               style={{
//                 width: 26,
//                 height: 26,
//                 borderRadius: 5,
//                 background: "#1f6feb",
//                 display: "grid",
//                 placeItems: "center",
//                 fontSize: 11,
//                 fontWeight: 700,
//                 color: "#fff",
//               }}
//             >
//               A
//             </div>
//             AdminConsole
//           </div>

//           {/* Nav */}
//           {NAV.map((group) => (
//             <div key={group.label} style={{ padding: "12px 0", borderBottom: "1px solid #21282f" }}>
              
//               {/* Group Label */}
//               <div
//                 style={{
//                   fontSize: 10,
//                   fontWeight: 600,
//                   letterSpacing: ".08em",
//                   color: "#7d8590",
//                   textTransform: "uppercase",
//                   padding: "0 16px 6px",
//                 }}
//               >
//                 {group.label}
//               </div>

//               {/* Items */}
//               {group.items.map((item: any) => {
//                 const isParent = item.children;

//                 // =======================
//                 // 🔥 PARENT (Users)
//                 // =======================
//                 if (isParent) {
//                   const isOpen =
//                     openMenus[item.label] ||
//                     pathname.startsWith("/admin/users");

//                   return (
//                     <div key={item.label}>
//                       {/* Parent */}
//                       <div
//                         onClick={() => toggleMenu(item.label)}
//                         style={{
//                           display: "flex",
//                           alignItems: "center",
//                           gap: 9,
//                           padding: "7px 16px",
//                           cursor: "pointer",
//                           color: "#7d8590",
//                           fontSize: 13,
//                         }}
//                       >
//                         <span style={{ width: 15 }}>{item.icon}</span>
//                         {item.label}

//                         {item.badge && (
//                           <span
//                             style={{
//                               marginLeft: "auto",
//                               background: "#1f6feb",
//                               color: "#fff",
//                               fontSize: 10,
//                               fontFamily: plexMono.style.fontFamily,
//                               padding: "1px 6px",
//                               borderRadius: 10,
//                               fontWeight: 600,
//                             }}
//                           >
//                             {item.badge}
//                           </span>
//                         )}

//                         {/* Arrow */}
//                         <span style={{ marginLeft: 6 }}>
//                           {isOpen ? "▼" : "▶"}
//                         </span>
//                       </div>

//                       {/* Children */}
//                       {isOpen &&
//                         item.children.map((sub: any) => {
//                           const active = pathname === sub.href;

//                           return (
//                             <Link key={sub.href} href={sub.href} style={{ textDecoration: "none" }}>
//                               <div
//                                 style={{
//                                   padding: "6px 16px 6px 36px",
//                                   fontSize: 12,
//                                   cursor: "pointer",
//                                   color: active ? "#e6edf3" : "#7d8590",
//                                   background: active
//                                     ? "rgba(31,111,235,.1)"
//                                     : "transparent",
//                                 }}
//                               >
//                                 • {sub.label}
//                               </div>
//                             </Link>
//                           );
//                         })}
//                     </div>
//                   );
//                 }

//                 // =======================
//                 // 🔹 NORMAL ITEM
//                 // =======================
//                 const active = pathname === item.href;

//                 return (
//                   <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
//                     <div
//                       style={{
//                         display: "flex",
//                         alignItems: "center",
//                         gap: 9,
//                         padding: "7px 16px",
//                         cursor: "pointer",
//                         color: active ? "#e6edf3" : "#7d8590",
//                         fontSize: 13,
//                         borderLeft: `2px solid ${
//                           active ? "#388bfd" : "transparent"
//                         }`,
//                         background: active
//                           ? "rgba(31,111,235,.1)"
//                           : "transparent",
//                       }}
//                     >
//                       <span style={{ width: 15 }}>{item.icon}</span>
//                       {item.label}

//                       {item.badge && (
//                         <span
//                           style={{
//                             marginLeft: "auto",
//                             background: "#1f6feb",
//                             color: "#fff",
//                             fontSize: 10,
//                             fontFamily: plexMono.style.fontFamily,
//                             padding: "1px 6px",
//                             borderRadius: 10,
//                             fontWeight: 600,
//                           }}
//                         >
//                           {item.badge}
//                         </span>
//                       )}
//                     </div>
//                   </Link>
//                 );
//               })}
//             </div>
//           ))}
//         </nav>

//         {/* Main */}
//         <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          
//           {/* Topbar */}
//           <div
//             style={{
//               height: 52,
//               background: "#161b22",
//               borderBottom: "1px solid #21282f",
//               display: "flex",
//               alignItems: "center",
//               gap: 12,
//               padding: "0 20px",
//             }}
//           >
//             <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
//               {pageTitle}
//             </div>

//             <div
//               style={{
//                 fontFamily: plexMono.style.fontFamily,
//                 fontSize: 10,
//                 background: "rgba(46,160,67,.15)",
//                 color: "#2ea043",
//                 padding: "2px 8px",
//                 borderRadius: 12,
//                 border: "1px solid #2ea043",
//               }}
//             >
//               ● LIVE
//             </div>

//             <input
//               placeholder="Search..."
//               style={{
//                 background: "#0d1117",
//                 border: "1px solid #2d3748",
//                 borderRadius: 6,
//                 padding: "5px 10px",
//                 color: "#e6edf3",
//                 fontSize: 12,
//                 width: 220,
//                 outline: "none",
//               }}
//             />

//             <div
//               style={{
//                 width: 28,
//                 height: 28,
//                 borderRadius: "50%",
//                 background: "linear-gradient(135deg,#1f6feb,#388bfd)",
//                 display: "grid",
//                 placeItems: "center",
//                 fontSize: 11,
//                 fontWeight: 700,
//               }}
//             >
//               AD
//             </div>
//           </div>

//           {/* Content */}
//           <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
//             {children}
//           </div>
//         </div>
//       </body>
//     </html>
//   );
// }







"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300","400","500","600"] });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400","500"] });

// Define proper types for navigation items
interface NavChildItem {
  href: string;
  label: string;
}

interface NavItem {
  href?: string;
  icon?: string;
  label: string;
  badge?: string;
  children?: NavChildItem[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

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
        label: "Users",
        icon: "◉",
        badge: "1.2k",
        children: [
          { href: "/admin/users/signups", label: "Signups" },
          { href: "/admin/users/otp", label: "Send & Verify OTP" },
        ],
      },
      { href: "/admin/content", icon: "◧", label: "Content / Posts" },
      { href: "/admin/orders", icon: "◫", label: "Orders & Payments", badge: "8" },
    ],
  },
  {
    label: "Auth",
    items: [
      { href: "/admin/otp-logs", icon: "⊡", label: "OTP Logs" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings", icon: "⊙", label: "Settings" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({});

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const pageTitle = (() => {
    if (pathname === "/admin") return "Dashboard";
    const seg = pathname.split("/").pop() ?? "";
    return seg.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase());
  })();

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0d1117",
          color: "#e6edf3",
          height: "100vh",
          display: "flex",
          overflow: "hidden",
          fontFamily: plexSans.style.fontFamily,
        }}
      >
        {/* Sidebar */}
        <nav
          style={{
            width: 220,
            background: "#161b22",
            borderRight: "1px solid #21282f",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* Logo */}
          <div
            style={{
              height: 52,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 16px",
              borderBottom: "1px solid #21282f",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 5,
                background: "#1f6feb",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              A
            </div>
            AdminConsole
          </div>

          {/* Nav */}
          {NAV.map((group) => (
            <div key={group.label} style={{ padding: "12px 0", borderBottom: "1px solid #21282f" }}>
              
              {/* Group Label */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: ".08em",
                  color: "#7d8590",
                  textTransform: "uppercase",
                  padding: "0 16px 6px",
                }}
              >
                {group.label}
              </div>

              {/* Items */}
              {group.items.map((item: NavItem) => {
                const isParent = !!item.children;

                // =======================
                // 🔥 PARENT (Users)
                // =======================
                if (isParent && item.children) {
                  const isOpen =
                    openMenus[item.label] ||
                    pathname.startsWith("/admin/users");

                  return (
                    <div key={item.label}>
                      {/* Parent */}
                      <div
                        onClick={() => toggleMenu(item.label)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          padding: "7px 16px",
                          cursor: "pointer",
                          color: "#7d8590",
                          fontSize: 13,
                        }}
                      >
                        <span style={{ width: 15 }}>{item.icon}</span>
                        {item.label}

                        {item.badge && (
                          <span
                            style={{
                              marginLeft: "auto",
                              background: "#1f6feb",
                              color: "#fff",
                              fontSize: 10,
                              fontFamily: plexMono.style.fontFamily,
                              padding: "1px 6px",
                              borderRadius: 10,
                              fontWeight: 600,
                            }}
                          >
                            {item.badge}
                          </span>
                        )}

                        {/* Arrow */}
                        <span style={{ marginLeft: 6 }}>
                          {isOpen ? "▼" : "▶"}
                        </span>
                      </div>

                      {/* Children */}
                      {isOpen &&
                        item.children.map((sub: NavChildItem) => {
                          const active = pathname === sub.href;

                          return (
                            <Link key={sub.href} href={sub.href} style={{ textDecoration: "none" }}>
                              <div
                                style={{
                                  padding: "6px 16px 6px 36px",
                                  fontSize: 12,
                                  cursor: "pointer",
                                  color: active ? "#e6edf3" : "#7d8590",
                                  background: active
                                    ? "rgba(31,111,235,.1)"
                                    : "transparent",
                                }}
                              >
                                • {sub.label}
                              </div>
                            </Link>
                          );
                        })}
                    </div>
                  );
                }

                // =======================
                // 🔹 NORMAL ITEM
                // =======================
                const active = item.href ? pathname === item.href : false;

                return (
                  <Link key={item.href} href={item.href || "#"} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "7px 16px",
                        cursor: "pointer",
                        color: active ? "#e6edf3" : "#7d8590",
                        fontSize: 13,
                        borderLeft: `2px solid ${
                          active ? "#388bfd" : "transparent"
                        }`,
                        background: active
                          ? "rgba(31,111,235,.1)"
                          : "transparent",
                      }}
                    >
                      <span style={{ width: 15 }}>{item.icon}</span>
                      {item.label}

                      {item.badge && (
                        <span
                          style={{
                            marginLeft: "auto",
                            background: "#1f6feb",
                            color: "#fff",
                            fontSize: 10,
                            fontFamily: plexMono.style.fontFamily,
                            padding: "1px 6px",
                            borderRadius: 10,
                            fontWeight: 600,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          
          {/* Topbar */}
          <div
            style={{
              height: 52,
              background: "#161b22",
              borderBottom: "1px solid #21282f",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "0 20px",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
              {pageTitle}
            </div>

            <div
              style={{
                fontFamily: plexMono.style.fontFamily,
                fontSize: 10,
                background: "rgba(46,160,67,.15)",
                color: "#2ea043",
                padding: "2px 8px",
                borderRadius: 12,
                border: "1px solid #2ea043",
              }}
            >
              ● LIVE
            </div>

            <input
              placeholder="Search..."
              style={{
                background: "#0d1117",
                border: "1px solid #2d3748",
                borderRadius: 6,
                padding: "5px 10px",
                color: "#e6edf3",
                fontSize: 12,
                width: 220,
                outline: "none",
              }}
            />

            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#1f6feb,#388bfd)",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              AD
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}