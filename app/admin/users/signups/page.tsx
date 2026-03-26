// "use client";
// import { useEffect, useState } from "react";

// type User = {
//   email: string;
//   firstName: string;
//   lastName: string;
//   createdAt: number;
// };

// export default function SignupsPage() {
//   const [users, setUsers]     = useState<User[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [deleting, setDeleting] = useState<string | null>(null); // tracks which email is being deleted

//   useEffect(() => {
//     fetchUsers();
//   }, []);

//   async function fetchUsers() {
//     setLoading(true);
//     try {
//       const res  = await fetch("/api/users");
//       const data = await res.json();
//       setUsers(data.users ?? []);
//     } catch {
//       setUsers([]);
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function handleDelete(email: string) {
//     const confirmed = window.confirm(`Delete user "${email}"? This cannot be undone.`);
//     if (!confirmed) return;

//     setDeleting(email);
//     try {
//       const res = await fetch("/api/users", {
//         method: "DELETE",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email }),
//       });

//       if (!res.ok) throw new Error("Delete failed");

//       // Remove from local state instantly — no need to refetch
//       setUsers(prev => prev.filter(u => u.email !== email));
//     } catch {
//       alert("Failed to delete user. Please try again.");
//     } finally {
//       setDeleting(null);
//     }
//   }

//   const thStyle = {
//     textAlign: "left" as const,
//     padding: "8px 14px",
//     fontSize: 10, fontWeight: 600,
//     letterSpacing: ".07em",
//     textTransform: "uppercase" as const,
//     color: "#7d8590",
//   };

//   return (
//     <div>
//       {/* Header */}
//       <div style={{ marginBottom: 18 }}>
//         <h1 style={{ fontSize: 17, fontWeight: 600 }}>Signups</h1>
//         <p style={{ color: "#7d8590", fontSize: 12, marginTop: 2 }}>
//           All registered users
//         </p>
//       </div>

//       {/* Count card */}
//       <div style={{
//         background: "#161b22", border: "1px solid #21282f", borderRadius: 6,
//         padding: 16, marginBottom: 20, display: "inline-block", minWidth: 180,
//         borderTop: "2px solid #2ea043",
//       }}>
//         <div style={{ fontSize: 11, color: "#7d8590", textTransform: "uppercase", letterSpacing: ".06em" }}>
//           Total Signups
//         </div>
//         <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 6 }}>
//           {loading ? "—" : users.length}
//         </div>
//       </div>

//       {/* Table */}
//       <div style={{ background: "#161b22", border: "1px solid #21282f", borderRadius: 6, overflow: "hidden" }}>
//         <table style={{ width: "100%", borderCollapse: "collapse" }}>
//           <thead>
//             <tr style={{ background: "#1c2330", borderBottom: "1px solid #21282f" }}>
//               <th style={thStyle}>#</th>
//               <th style={thStyle}>Name</th>
//               <th style={thStyle}>Email</th>
//               <th style={thStyle}>Signed Up</th>
//               <th style={thStyle}>Action</th>
//             </tr>
//           </thead>
//           <tbody>
//             {loading ? (
//               <tr>
//                 <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#7d8590" }}>
//                   Loading…
//                 </td>
//               </tr>
//             ) : users.length === 0 ? (
//               <tr>
//                 <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#7d8590" }}>
//                   No signups yet
//                 </td>
//               </tr>
//             ) : (
//               users.map((u, i) => {
//                 const initials = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";
//                 const isDeleting = deleting === u.email;

//                 return (
//                   <tr
//                     key={u.email}
//                     style={{
//                       borderBottom: i < users.length - 1 ? "1px solid #21282f" : "none",
//                       opacity: isDeleting ? 0.4 : 1,
//                       transition: "opacity .2s",
//                     }}
//                   >
//                     {/* # */}
//                     <td style={{ padding: "9px 14px", color: "#7d8590", fontFamily: "var(--font-mono)", fontSize: 12 }}>
//                       {i + 1}
//                     </td>

//                     {/* Name with avatar */}
//                     <td style={{ padding: "9px 14px" }}>
//                       <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
//                         <div style={{
//                           width: 28, height: 28, borderRadius: "50%",
//                           background: "rgba(31,111,235,.2)", color: "#388bfd",
//                           display: "grid", placeItems: "center",
//                           fontSize: 10, fontWeight: 700, flexShrink: 0,
//                         }}>
//                           {initials}
//                         </div>
//                         <div style={{ fontSize: 12, fontWeight: 500 }}>
//                           {u.firstName ?? "—"} {u.lastName ?? ""}
//                         </div>
//                       </div>
//                     </td>

//                     {/* Email */}
//                     <td style={{ padding: "9px 14px", fontSize: 12, color: "#7d8590" }}>
//                       {u.email}
//                     </td>

//                     {/* Signed up date */}
//                     <td style={{ padding: "9px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "#7d8590" }}>
//                       {u.createdAt
//                         ? new Date(u.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
//                         : "—"}
//                     </td>

//                     {/* Delete button */}
//                     <td style={{ padding: "9px 14px" }}>
//                       <button
//                         onClick={() => handleDelete(u.email)}
//                         disabled={!!deleting}
//                         style={{
//                           padding: "4px 10px", borderRadius: 5,
//                           border: "1px solid #da3633",
//                           background: isDeleting ? "#3a1a1a" : "transparent",
//                           color: "#da3633", fontSize: 11, fontWeight: 500,
//                           cursor: deleting ? "not-allowed" : "pointer",
//                           transition: "all .15s",
//                           fontFamily: "inherit",
//                         }}
//                         onMouseEnter={e => { if (!deleting) (e.target as HTMLButtonElement).style.background = "#da3633"; (e.target as HTMLButtonElement).style.color = "#fff"; }}
//                         onMouseLeave={e => { if (!deleting) (e.target as HTMLButtonElement).style.background = "transparent"; (e.target as HTMLButtonElement).style.color = "#da3633"; }}
//                       >
//                         {isDeleting ? "Deleting…" : "Delete"}
//                       </button>
//                     </td>
//                   </tr>
//                 );
//               })
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }











"use client";
import { useEffect, useState } from "react";

type User = {
  email: string;
  firstName: string;
  lastName: string;
  createdAt: number;
  status: "active" | "disabled";
  role: "user" | "moderator" | "admin";
};

export default function SignupsPage() {
  const [users, setUsers]       = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch]     = useState("");

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res  = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  // ── Toggle active/disabled ──────────────────────
  async function handleToggleStatus(user: User) {
    const newStatus = user.status === "active" ? "disabled" : "active";
    setUpdating(user.email);
    try {
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, status: newStatus }),
      });
      setUsers(prev =>
        prev.map(u => u.email === user.email ? { ...u, status: newStatus } : u)
      );
    } catch {
      alert("Failed to update status.");
    } finally {
      setUpdating(null);
    }
  }

  // ── Change role ─────────────────────────────────
  async function handleRoleChange(email: string, role: string) {
    setUpdating(email);
    try {
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      setUsers(prev =>
        prev.map(u => u.email === email ? { ...u, role: role as User["role"] } : u)
      );
    } catch {
      alert("Failed to update role.");
    } finally {
      setUpdating(null);
    }
  }

  // ── Delete ──────────────────────────────────────
  async function handleDelete(email: string) {
    if (!window.confirm(`Delete "${email}"? This cannot be undone.`)) return;
    setDeleting(email);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setUsers(prev => prev.filter(u => u.email !== email));
    } catch {
      alert("Failed to delete user.");
    } finally {
      setDeleting(null);
    }
  }

  // ── Filtered users ──────────────────────────────
  const filtered = users.filter(u =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  // ── Stats ───────────────────────────────────────
  const totalActive   = users.filter(u => u.status === "active").length;
  const totalDisabled = users.filter(u => u.status === "disabled").length;

  const thStyle = {
    textAlign: "left" as const, padding: "8px 14px",
    fontSize: 10, fontWeight: 600, letterSpacing: ".07em",
    textTransform: "uppercase" as const, color: "#7d8590",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 17, fontWeight: 600 }}>User Management</h1>
        <p style={{ color: "#7d8590", fontSize: 12, marginTop: 2 }}>
          Control user access, roles and account status
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Users",    value: users.length,   color: "#388bfd" },
          { label: "Active",         value: totalActive,    color: "#2ea043" },
          { label: "Disabled",       value: totalDisabled,  color: "#da3633" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#161b22", border: "1px solid #21282f",
            borderTop: `2px solid ${s.color}`, borderRadius: 6, padding: 16,
          }}>
            <div style={{ fontSize: 11, color: "#7d8590", textTransform: "uppercase", letterSpacing: ".06em" }}>
              {s.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 6 }}>
              {loading ? "—" : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#161b22", border: "1px solid #21282f", borderRadius: 6, overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid #21282f" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0d1117", border: "1px solid #2d3748", borderRadius: 6, padding: "5px 10px", width: 220 }}>
            <span style={{ color: "#7d8590" }}>⌕</span>
            <input
              placeholder="Search name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: "none", background: "none", outline: "none", color: "#e6edf3", fontSize: 12, width: "100%", fontFamily: "inherit" }}
            />
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#7d8590" }}>
            {filtered.length} of {users.length} users
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#1c2330", borderBottom: "1px solid #21282f" }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Signed Up</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#7d8590" }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#7d8590" }}>No users found</td></tr>
            ) : (
              filtered.map((u, i) => {
                const initials    = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";
                const isDeleting  = deleting === u.email;
                const isUpdating  = updating === u.email;
                const isActive    = u.status !== "disabled";

                return (
                  <tr key={u.email} style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid #21282f" : "none",
                    opacity: isDeleting ? 0.4 : 1,
                    transition: "opacity .2s",
                    background: !isActive ? "rgba(218,54,51,.04)" : "transparent",
                  }}>
                    {/* # */}
                    <td style={{ padding: "9px 14px", color: "#7d8590", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      {i + 1}
                    </td>

                    {/* Name */}
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: isActive ? "rgba(31,111,235,.2)" : "rgba(218,54,51,.15)",
                          color: isActive ? "#388bfd" : "#da3633",
                          display: "grid", placeItems: "center",
                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                        }}>{initials}</div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>
                          {u.firstName ?? "—"} {u.lastName ?? ""}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: "9px 14px", fontSize: 12, color: "#7d8590" }}>
                      {u.email}
                    </td>

                    {/* Role dropdown */}
                    <td style={{ padding: "9px 14px" }}>
                      <select
                        value={u.role ?? "user"}
                        disabled={isUpdating}
                        onChange={e => handleRoleChange(u.email, e.target.value)}
                        style={{
                          background: "#0d1117", border: "1px solid #2d3748",
                          borderRadius: 5, padding: "3px 8px",
                          color: "#e6edf3", fontSize: 11,
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        <option value="user">User</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>

                    {/* Signed up */}
                    <td style={{ padding: "9px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "#7d8590" }}>
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                        : "—"}
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
                        background: isActive ? "rgba(46,160,67,.15)" : "rgba(218,54,51,.15)",
                        color: isActive ? "#2ea043" : "#da3633",
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                        {isActive ? "Active" : "Disabled"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* Toggle status */}
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isUpdating || isDeleting}
                          style={{
                            padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 500,
                            border: `1px solid ${isActive ? "#d29922" : "#2ea043"}`,
                            background: "transparent",
                            color: isActive ? "#d29922" : "#2ea043",
                            cursor: isUpdating ? "not-allowed" : "pointer",
                            fontFamily: "inherit", transition: "all .15s",
                          }}
                        >
                          {isUpdating ? "…" : isActive ? "Disable" : "Enable"}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(u.email)}
                          disabled={!!deleting || isUpdating}
                          style={{
                            padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 500,
                            border: "1px solid #da3633", background: "transparent",
                            color: "#da3633", cursor: isDeleting ? "not-allowed" : "pointer",
                            fontFamily: "inherit", transition: "all .15s",
                          }}
                        >
                          {isDeleting ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}