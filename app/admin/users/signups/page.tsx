"use client";
import { useEffect, useState } from "react";

type User = {
  email: string;
  createdAt: number;
};

export default function SignupsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/verify-otp")
      .then(r => r.json())
      .then(data => { setUsers(data.users); setLoading(false); });
  }, []);

  return (
    <div>
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
        <div style={{ fontSize: 11, color: "#7d8590", textTransform: "uppercase", letterSpacing: ".06em" }}>Total Signups</div>
        <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--font-mono)", marginTop: 6 }}>
          {loading ? "—" : users.length}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#161b22", border: "1px solid #21282f", borderRadius: 6, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#1c2330", borderBottom: "1px solid #21282f" }}>
              {["#", "Email", "Signed Up"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 14px", fontSize: 10, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "#7d8590" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#7d8590" }}>Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: 20, textAlign: "center", color: "#7d8590" }}>No signups yet</td></tr>
            ) : (
              users.map((u, i) => (
                <tr key={u.email} style={{ borderBottom: i < users.length - 1 ? "1px solid #21282f" : "none" }}>
                  <td style={{ padding: "9px 14px", color: "#7d8590", fontFamily: "var(--font-mono)", fontSize: 12 }}>{i + 1}</td>
                  <td style={{ padding: "9px 14px", fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: "9px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "#7d8590" }}>
                    {new Date(u.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}