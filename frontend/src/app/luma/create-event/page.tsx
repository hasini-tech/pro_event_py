"use client";

import { useState } from "react";

const bg = "linear-gradient(135deg, #0e7678 0%, #1a9a9c 30%, #c8ecec 65%, #ffffff 100%)";

export default function CreateEventLuma() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <main style={{ minHeight: "100vh", background: bg, fontFamily: "'DM Sans', sans-serif", color: "#0a3535" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap');
        * { box-sizing: border-box; }
        input, textarea { font-family: 'DM Sans', sans-serif; }
        .date-box:hover, .option-row:hover, .input-box:focus-within {
          border-color: #0e7678 !important;
          box-shadow: 0 0 0 3px rgba(14,118,120,0.1) !important;
        }
        .submit-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(14,118,120,0.42) !important; }
        .submit-btn:active { transform: translateY(0); }
        .create-btn:hover { background: rgba(255,255,255,0.25) !important; }
      `}</style>

      {/* ── Topbar ── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", maxWidth: "1080px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>
            luma<span style={{ opacity: 0.6 }}>*</span>
          </span>
          <nav style={{ display: "flex", gap: "20px" }}>
            {["Events", "Calendars", "Discover"].map(l => (
              <a key={l} href="#" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}>{l}</a>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>4:19 PM GMT+5:30</span>
          <button onClick={() => setShowAuth(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.9)", fontFamily: "inherit", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>Sign In</button>
          <button style={{ padding: "9px 16px", borderRadius: "10px", border: "1.5px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)", color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>Create Event</button>
        </div>
      </header>

      {/* ── Main Grid ── */}
      <section style={{ maxWidth: "1080px", margin: "0 auto", padding: "20px 32px 80px", display: "grid", gridTemplateColumns: "0.42fr 0.58fr", gap: "24px", alignItems: "start" }}>

        {/* LEFT */}
        <div style={{ display: "grid", gap: "16px" }}>

          {/* Cover */}
          <div style={{ height: "340px", borderRadius: "20px", background: "linear-gradient(145deg, #0e7678, #1fb8ba, #7ddada, #ffffff)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", boxShadow: "0 20px 48px rgba(14,118,120,0.32)" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.28) 0%, transparent 60%)" }} />
            <div style={{ width: "82%", height: "82%", borderRadius: "14px", border: "1.5px dashed rgba(255,255,255,0.45)", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.8)" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 9h18M9 21V9"/></svg>
                <span style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Upload Cover</span>
              </div>
            </div>
            <button style={{ position: "absolute", bottom: "14px", right: "14px", width: 38, height: 38, borderRadius: "50%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", border: "none", display: "grid", placeItems: "center", cursor: "pointer", color: "white" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </button>
          </div>

          {/* Theme row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: "14px", background: "rgba(255,255,255,0.72)", border: "1px solid rgba(14,118,120,0.18)", backdropFilter: "blur(8px)", fontWeight: 700, color: "#0a3535", fontSize: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 28, height: 20, borderRadius: "6px", background: "linear-gradient(90deg, #0e7678, #7ddada)" }} />
              <span>Theme</span>
            </div>
            <span>Ocean Teal ▾</span>
          </div>

          {/* URL row */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "12px", background: "rgba(255,255,255,0.72)", border: "1px solid rgba(14,118,120,0.18)", backdropFilter: "blur(8px)" }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#5a9a9b" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <input placeholder="Paste image URL…" style={{ flex: 1, border: "none", background: "transparent", fontFamily: "inherit", fontSize: "13px", color: "#2d6b6c", outline: "none" }} />
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#5a9a9b", display: "grid", placeItems: "center" }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
        </div>

        {/* RIGHT – Form Card */}
        <div style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(14,118,120,0.14)", borderRadius: "20px", padding: "22px", display: "grid", gap: "16px", boxShadow: "0 20px 48px rgba(14,118,120,0.14)" }}>

          {/* Event name + visibility */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <input placeholder="Event Name" style={{ flex: 1, fontFamily: "'Playfair Display', serif", fontSize: "1.65rem", fontWeight: 700, border: "none", background: "transparent", outline: "none", color: "#0a3535" }} />
            <button style={{ padding: "8px 14px", borderRadius: "10px", border: "1.5px solid rgba(14,118,120,0.18)", background: "rgba(255,255,255,0.9)", color: "#2d6b6c", fontWeight: 700, fontFamily: "inherit", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" }}>🌐 Public ▾</button>
          </div>

          <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #b2e0e1, transparent)" }} />

          {/* Date & Time */}
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#2d6b6c", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#1a9a9c" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Date & Time
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {["Start", "End"].map(label => (
                <div key={label} className="date-box" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 12px", borderRadius: "12px", background: "linear-gradient(135deg, #e8f7f7, #ffffff)", border: "1.5px solid rgba(14,118,120,0.18)", cursor: "pointer", transition: "border-color 0.2s, box-shadow 0.2s" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#0e7678", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "2px" }}>{label}</span>
                    <input type="date" style={{ border: "none", background: "transparent", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", color: "#0a3535", outline: "none", width: "100%" }} />
                  </div>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#1a9a9c" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <input type="time" style={{ width: "60px", fontSize: "13px", fontWeight: 700, color: "#0a3535", border: "none", background: "transparent", outline: "none" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "12px", background: "linear-gradient(135deg, #e0f4f4, #f5fcfc)", border: "1.5px solid rgba(14,118,120,0.18)", fontSize: "13px", color: "#2d6b6c", fontWeight: 600 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#1a9a9c" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                GMT+05:30 — Calcutta
              </div>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#5a9a9b" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          {/* Location */}
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#2d6b6c", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#1a9a9c" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Event Location
            </div>
            <div className="input-box" style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: "12px", background: "linear-gradient(135deg, #e8f7f7, #ffffff)", border: "1.5px solid rgba(14,118,120,0.18)", transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#5a9a9b" strokeWidth="2" style={{ marginTop: "2px", flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <input placeholder="Offline location or virtual link" style={{ flex: 1, border: "none", background: "transparent", fontFamily: "inherit", fontSize: "14px", color: "#0a3535", outline: "none" }} />
            </div>
          </div>

          {/* Description */}
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#2d6b6c", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#1a9a9c" strokeWidth="2.2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
              Description
            </div>
            <div className="input-box" style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", borderRadius: "12px", background: "linear-gradient(135deg, #e8f7f7, #ffffff)", border: "1.5px solid rgba(14,118,120,0.18)", transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#5a9a9b" strokeWidth="2" style={{ marginTop: "3px", flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <textarea rows={3} placeholder="Tell guests what makes this gathering special…" style={{ flex: 1, border: "none", background: "transparent", fontFamily: "inherit", fontSize: "14px", color: "#0a3535", outline: "none", resize: "vertical" }} />
            </div>
          </div>

          <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #b2e0e1, transparent)" }} />

          {/* Event Options */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#0a3535", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.08em", paddingBottom: "4px", borderBottom: "2px solid #b2e0e1" }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#0e7678" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            Event Options
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {[
              { label: "Ticket Price", value: "Free ✏️", icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#0e7678" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
              { label: "Require Approval", value: "Off", icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#0e7678" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
              { label: "Capacity", value: "Unlimited", icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#0e7678" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            ].map(item => (
              <div key={item.label} className="option-row" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "12px", background: "linear-gradient(135deg, #e8f7f7, #ffffff)", border: "1.5px solid rgba(14,118,120,0.18)", fontSize: "14px", color: "#0a3535", fontWeight: 600, cursor: "pointer", transition: "border-color 0.2s, box-shadow 0.2s" }}>
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{ color: "#0e7678", fontWeight: 700, fontSize: "13px" }}>{item.value}</span>
              </div>
            ))}
          </div>

          <button className="submit-btn" style={{ marginTop: "4px", padding: "15px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, #0e7678, #1fb8ba)", color: "#fff", fontFamily: "inherit", fontWeight: 800, fontSize: "1rem", cursor: "pointer", letterSpacing: "0.04em", boxShadow: "0 8px 24px rgba(14,118,120,0.35)", transition: "transform 0.15s, box-shadow 0.15s", position: "relative", overflow: "hidden" }}>
            <span style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.15), transparent)", pointerEvents: "none" }} />
            Create Event →
          </button>
        </div>
      </section>

      {/* ── Auth Modal ── */}
      {showAuth && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", zIndex: 20, backdropFilter: "blur(4px)" }}>
          <div style={{ width: "420px", borderRadius: "20px", background: "#fff", boxShadow: "0 24px 56px rgba(14,118,120,0.22)", padding: "26px", position: "relative" }}>
            <button onClick={() => setShowAuth(false)} style={{ position: "absolute", top: 14, right: 14, border: "none", background: "transparent", cursor: "pointer", color: "#5a9a9b" }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", fontWeight: 700, color: "#0a3535", marginBottom: "6px" }}>Welcome to Luma</div>
              <div style={{ color: "#5a9a9b", fontSize: "0.95rem" }}>Please sign in or sign up below.</div>
            </div>
            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontWeight: 700, color: "#2d6b6c", fontSize: "13px", marginBottom: "6px" }}>Email</label>
                <div style={{ display: "flex", alignItems: "center", borderRadius: "12px", border: "1.5px solid rgba(14,118,120,0.2)", background: "linear-gradient(135deg, #e8f7f7, #fff)", padding: "11px 14px", gap: "10px" }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#5a9a9b" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input placeholder="you@email.com" style={{ border: "none", background: "transparent", width: "100%", fontFamily: "inherit", fontSize: "14px", outline: "none", color: "#0a3535" }} />
                </div>
              </div>
              <button style={{ padding: "13px", borderRadius: "12px", background: "linear-gradient(135deg, #0e7678, #1fb8ba)", color: "#fff", fontWeight: 800, fontFamily: "inherit", border: "none", cursor: "pointer", fontSize: "14px", letterSpacing: "0.03em" }}>Continue with Email</button>
              {[
                { icon: <img src="https://www.svgrepo.com/show/475656/google-color.svg" width={18} height={18} alt="Google" />, label: "Sign in with Google" },
                { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>, label: "Sign in with Passkey" },
                { icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>, label: "Use phone number" },
              ].map(btn => (
                <button key={btn.label} style={{ padding: "12px 14px", borderRadius: "12px", background: "#fff", border: "1.5px solid rgba(14,118,120,0.18)", display: "flex", alignItems: "center", gap: "12px", fontWeight: 700, fontFamily: "inherit", fontSize: "14px", cursor: "pointer", color: "#0a3535" }}>
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}