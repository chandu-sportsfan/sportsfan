"use client";
import { useState } from "react";

export default function OtpPage() {
  const [email, setEmail]       = useState("");
  const [otp, setOtp]           = useState("");
  const [sent, setSent]         = useState(false);
  const [sendMsg, setSendMsg]   = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSend() {
    if (!email) return;
    setLoading(true); setSendMsg("");
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) { setSent(true); setSendMsg("✅ OTP sent to " + email); }
    else setSendMsg("❌ " + (data.error ?? "Failed to send"));
  }

  async function handleVerify() {
    if (!email || !otp) return;
    setLoading(true); setVerifyMsg("");
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) setVerifyMsg("✅ OTP verified! User authenticated.");
    else setVerifyMsg("❌ " + (data.error ?? "Verification failed"));
  }

  const inputStyle = {
    width: "100%", background: "#0d1117", border: "1px solid #2d3748",
    borderRadius: 6, padding: "9px 12px", color: "#e6edf3",
    fontFamily: "inherit", fontSize: 13, outline: "none",
  } as React.CSSProperties;

  const btnStyle = (color: string) => ({
    padding: "9px 20px", borderRadius: 6, border: "none",
    background: color, color: "#fff", fontFamily: "inherit",
    fontSize: 13, fontWeight: 500, cursor: "pointer",
    opacity: loading ? 0.6 : 1,
  } as React.CSSProperties);

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 17, fontWeight: 600 }}>Send &amp; Verify OTP</h1>
        <p style={{ color: "#7d8590", fontSize: 12, marginTop: 2 }}>
          Test OTP flow directly from the admin panel
        </p>
      </div>

      <div style={{
        background: "#161b22", border: "1px solid #21282f",
        borderRadius: 6, padding: 24, maxWidth: 480,
      }}>
        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#7d8590", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>
            Email Address
          </div>
          <input
            style={inputStyle}
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setSent(false); setSendMsg(""); setVerifyMsg(""); }}
          />
        </div>

        {/* Send button */}
        <button style={btnStyle("#1f6feb")} onClick={handleSend} disabled={loading || !email}>
          {loading && !sent ? "Sending…" : "Send OTP"}
        </button>

        {sendMsg && (
          <div style={{ marginTop: 10, fontSize: 12, color: sendMsg.startsWith("✅") ? "#2ea043" : "#da3633" }}>
            {sendMsg}
          </div>
        )}

        {/* OTP input — shown after send */}
        {sent && (
          <>
            <div style={{ height: 1, background: "#21282f", margin: "20px 0" }} />
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#7d8590", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>
                Enter OTP
              </div>
              <input
                style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 20, letterSpacing: ".2em", textAlign: "center" }}
                type="text"
                placeholder="● ● ● ● ● ●"
                maxLength={6}
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, "")); setVerifyMsg(""); }}
              />
            </div>
            <button style={btnStyle("#2ea043")} onClick={handleVerify} disabled={loading || otp.length < 6}>
              {loading ? "Verifying…" : "Verify OTP"}
            </button>
            {verifyMsg && (
              <div style={{ marginTop: 10, fontSize: 12, color: verifyMsg.startsWith("✅") ? "#2ea043" : "#da3633" }}>
                {verifyMsg}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}