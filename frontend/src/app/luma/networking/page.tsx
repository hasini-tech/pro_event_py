"use client";

export default function NetworkingCard() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f766e, #0b3b4a 55%, #0f172a)",
        color: "#fff",
        padding: "28px",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.75fr",
          gap: "16px",
          background: "#0b2933",
          borderRadius: "18px",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
            <div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>Digital Name Card</div>
              <div style={{ color: "#a5f3fc", fontWeight: 700, marginTop: "4px" }}>
                Your professional identity in one place
              </div>
            </div>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "10px",
                background: "#fff",
                display: "grid",
                placeItems: "center",
                color: "#0f172a",
                fontWeight: 800,
              }}
            >
              QR
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
            {["Share", "Copy", "Download"].map((label) => (
              <button
                key={label}
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "20px" }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0ea5e9, #0f172a)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "1.2rem",
              }}
            >
              hh
            </div>
            <div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>hasini hasini</div>
              <div style={{ color: "#a5f3fc", fontWeight: 700 }}>Product Designer · Community Host</div>
            </div>
          </div>

          <div style={{ marginTop: "20px", display: "grid", gap: "10px", color: "#cbd5e1", fontWeight: 700 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>hasini.developer@gmail.com</span>
            </div>
            <div>+91 99999 99999</div>
            <div>LinkedIn · Twitter · Website</div>
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            color: "#0f172a",
            padding: "20px",
            display: "grid",
            gap: "12px",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Quick Actions</div>
          {[
            "Edit Profile",
            "Generate QR Code",
            "Download Card",
            "Copy Link",
            "Share Profile",
            "Preview Public Posts",
          ].map((item) => (
            <button
              key={item}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {item}
            </button>
          ))}
          <button
            style={{
              marginTop: "8px",
              padding: "12px",
              borderRadius: "10px",
              background: "#0f766e",
              color: "#fff",
              border: "none",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            View Public Profile
          </button>
        </div>
      </div>
    </main>
  );
}
