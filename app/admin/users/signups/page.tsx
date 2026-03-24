// "use client";
// import { useEffect, useState } from "react";

// type User = {
//   email: string;
//   createdAt: number;
// };

// export default function SignupsPage() {
//   const [users, setUsers] = useState<User[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     fetch("/api/users")
//       .then(r => r.json())
//       .then(data => { setUsers(data.users); setLoading(false); });
//   }, []);

//   return (
//     <div>
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
//         <div style={{ fontSize: 11, color: "#7d8590", textTransform: "uppercase", letterSpacing: ".06em" }}>Total Signups</div>
//         <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 6 }}>
//           {loading ? "—" : users.length}
//         </div>
//       </div>

//       {/* Table */}
//       <div style={{ background: "#161b22", border: "1px solid #21282f", borderRadius: 6, overflow: "hidden" }}>
//         <table style={{ width: "100%", borderCollapse: "collapse" }}>
//           <thead>
//             <tr style={{ background: "#1c2330", borderBottom: "1px solid #21282f" }}>
//               {["#", "Email", "Signed Up"].map(h => (
//                 <th key={h} style={{ textAlign: "left", padding: "8px 14px", fontSize: 10, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "#7d8590" }}>{h}</th>
//               ))}
//             </tr>
//           </thead>
//           <tbody>
//             {loading ? (
//               <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#7d8590" }}>Loading…</td></tr>
//             ) : users.length === 0 ? (
//               <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#7d8590" }}>No signups yet</td></tr>
//             ) : (
//               users.map((u, i) => (
//                 <tr key={u.email} style={{ borderBottom: i < users.length - 1 ? "1px solid #21282f" : "none" }}>
//                   <td style={{ padding: "9px 14px", color: "#7d8590", fontFamily: "var(--font-mono)", fontSize: 12 }}>{i + 1}</td>
//                   <td style={{ padding: "9px 14px", fontSize: 12 }}>{u.email}</td>
//                   <td style={{ padding: "9px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "#7d8590" }}>
//                     {new Date(u.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
//                   </td>
//                 </tr>
//               ))
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
};

export default function SignupsPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null); // tracks which email is being deleted

  useEffect(() => {
    fetchUsers();
  }, []);

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

  async function handleDelete(email: string) {
    const confirmed = window.confirm(`Delete user "${email}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(email);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error("Delete failed");

      // Remove from local state instantly — no need to refetch
      setUsers(prev => prev.filter(u => u.email !== email));
    } catch {
      alert("Failed to delete user. Please try again.");
    } finally {
      setDeleting(null);
    }
  }

  const thStyle = {
    textAlign: "left" as const,
    padding: "8px 14px",
    fontSize: 10, fontWeight: 600,
    letterSpacing: ".07em",
    textTransform: "uppercase" as const,
    color: "#7d8590",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 17, fontWeight: 600 }}>Signups</h1>
        <p style={{ color: "#7d8590", fontSize: 12, marginTop: 2 }}>
          All registered users
        </p>
      </div>

      {/* Count card */}
      <div style={{
        background: "#161b22", border: "1px solid #21282f", borderRadius: 6,
        padding: 16, marginBottom: 20, display: "inline-block", minWidth: 180,
        borderTop: "2px solid #2ea043",
      }}>
        <div style={{ fontSize: 11, color: "#7d8590", textTransform: "uppercase", letterSpacing: ".06em" }}>
          Total Signups
        </div>
        <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 6 }}>
          {loading ? "—" : users.length}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#161b22", border: "1px solid #21282f", borderRadius: 6, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#1c2330", borderBottom: "1px solid #21282f" }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Signed Up</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#7d8590" }}>
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#7d8590" }}>
                  No signups yet
                </td>
              </tr>
            ) : (
              users.map((u, i) => {
                const initials = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";
                const isDeleting = deleting === u.email;

                return (
                  <tr
                    key={u.email}
                    style={{
                      borderBottom: i < users.length - 1 ? "1px solid #21282f" : "none",
                      opacity: isDeleting ? 0.4 : 1,
                      transition: "opacity .2s",
                    }}
                  >
                    {/* # */}
                    <td style={{ padding: "9px 14px", color: "#7d8590", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      {i + 1}
                    </td>

                    {/* Name with avatar */}
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "rgba(31,111,235,.2)", color: "#388bfd",
                          display: "grid", placeItems: "center",
                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                        }}>
                          {initials}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>
                          {u.firstName ?? "—"} {u.lastName ?? ""}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: "9px 14px", fontSize: 12, color: "#7d8590" }}>
                      {u.email}
                    </td>

                    {/* Signed up date */}
                    <td style={{ padding: "9px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "#7d8590" }}>
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                        : "—"}
                    </td>

                    {/* Delete button */}
                    <td style={{ padding: "9px 14px" }}>
                      <button
                        onClick={() => handleDelete(u.email)}
                        disabled={!!deleting}
                        style={{
                          padding: "4px 10px", borderRadius: 5,
                          border: "1px solid #da3633",
                          background: isDeleting ? "#3a1a1a" : "transparent",
                          color: "#da3633", fontSize: 11, fontWeight: 500,
                          cursor: deleting ? "not-allowed" : "pointer",
                          transition: "all .15s",
                          fontFamily: "inherit",
                        }}
                        onMouseEnter={e => { if (!deleting) (e.target as HTMLButtonElement).style.background = "#da3633"; (e.target as HTMLButtonElement).style.color = "#fff"; }}
                        onMouseLeave={e => { if (!deleting) (e.target as HTMLButtonElement).style.background = "transparent"; (e.target as HTMLButtonElement).style.color = "#da3633"; }}
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
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