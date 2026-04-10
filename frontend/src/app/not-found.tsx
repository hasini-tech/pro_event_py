import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          padding: "32px",
          borderRadius: 28,
          background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,251,251,0.96))",
          border: "1px solid rgba(14,118,120,0.12)",
          boxShadow: "0 18px 42px rgba(17,39,45,0.06)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "0.85rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 10 }}>
          404
        </div>
        <h1 style={{ fontSize: "2.2rem", margin: "0 0 10px", fontWeight: 800, letterSpacing: "-0.04em" }}>
          Page not found
        </h1>
        <p style={{ color: "#6b7280", lineHeight: 1.7, margin: "0 0 22px" }}>
          The page you were looking for does not exist or may have moved.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 18px",
            borderRadius: 14,
            background: "#111827",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
