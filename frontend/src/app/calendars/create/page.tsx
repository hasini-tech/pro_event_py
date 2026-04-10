"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus2, Loader2, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

const TINT_OPTIONS = [
  "#9ca3af",
  "#ec4899",
  "#8b5cf6",
  "#6366f1",
  "#2563eb",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ef4444",
  "#0e7678",
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function appendCalendarParam(path: string, calendarId: string) {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("calendar", calendarId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function CreateCalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [locationScope, setLocationScope] = useState<"city" | "global">("city");
  const [tintColor, setTintColor] = useState("#0e7678");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  const coverGradient = useMemo(
    () => `linear-gradient(135deg, color-mix(in srgb, ${tintColor} 78%, white), color-mix(in srgb, ${tintColor} 28%, white))`,
    [tintColor]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await api.post("/events/calendars", {
        name,
        description,
        slug: slug || undefined,
        tint_color: tintColor,
        location_scope: locationScope,
        city: locationScope === "city" ? city : "",
      });

      const redirectTarget = searchParams?.get("redirect");
      if (redirectTarget) {
        router.push(appendCalendarParam(redirectTarget, response.data.id));
        return;
      }

      router.push("/calendars");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not create calendar.");
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
        <Loader2 className="animate-spin" size={34} color="var(--primary-color)" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "34px 20px 80px" }}>
      <h1 style={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 22px" }}>Create Calendar</h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
        <section
          style={{
            background: "#fff",
            borderRadius: 26,
            overflow: "hidden",
            border: "1px solid rgba(14,118,120,0.12)",
            boxShadow: "0 18px 42px rgba(17,39,45,0.06)",
          }}
        >
          <div style={{ height: 148, background: coverGradient, position: "relative" }}>
            <button
              type="button"
              onClick={() => setTintColor(TINT_OPTIONS[(TINT_OPTIONS.indexOf(tintColor) + 1) % TINT_OPTIONS.length])}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                border: "1px solid rgba(17,24,39,0.08)",
                borderRadius: 12,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.82)",
                color: "#4b5563",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Change Cover
            </button>
          </div>

          <div style={{ padding: "0 18px 18px" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: coverGradient,
                marginTop: -20,
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: "1.05rem",
                boxShadow: "0 14px 28px rgba(17,39,45,0.12)",
              }}
            >
              {(name || user?.name || "C").slice(0, 1).toUpperCase()}
            </div>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Calendar Name"
              required
              style={{
                width: "100%",
                marginTop: 16,
                border: "none",
                borderBottom: "2px solid #111827",
                background: "transparent",
                fontSize: "2rem",
                padding: "0 0 8px",
                color: "#111827",
                outline: "none",
                fontWeight: 500,
              }}
            />

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short description."
              rows={2}
              style={{
                width: "100%",
                marginTop: 12,
                border: "none",
                background: "transparent",
                color: "#6b7280",
                fontSize: "1rem",
                outline: "none",
                resize: "vertical",
                padding: 0,
              }}
            />
          </div>
        </section>

        <section
          style={{
            background: "#fff",
            borderRadius: 22,
            padding: 18,
            border: "1px solid rgba(14,118,120,0.12)",
            boxShadow: "0 18px 42px rgba(17,39,45,0.06)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 16, color: "#1f2937" }}>Customization</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div>
              <div style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: 10 }}>Tint Color</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {TINT_OPTIONS.map((color) => {
                  const isActive = color === tintColor;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setTintColor(color)}
                      aria-label={`Select ${color}`}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: isActive ? "3px solid rgba(17,24,39,0.28)" : "none",
                        background: color,
                        boxShadow: isActive ? "0 0 0 3px rgba(14,118,120,0.14)" : "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  );
                })}
              </div>

              <div style={{ color: "#6b7280", fontSize: "0.9rem", margin: "18px 0 8px" }}>Public URL</div>
              <div style={{ display: "flex", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(148,163,184,0.22)" }}>
                <div style={{ padding: "12px 14px", background: "#f8fafc", color: "#6b7280", whiteSpace: "nowrap" }}>lu.ma/</div>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="your-calendar"
                  style={{ flex: 1, border: "none", outline: "none", padding: "12px 14px", fontSize: "0.95rem" }}
                />
              </div>
            </div>

            <div>
              <div style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: 10 }}>Location</div>
              <div style={{ display: "inline-flex", padding: 4, borderRadius: 14, background: "#f8fafc", border: "1px solid rgba(148,163,184,0.18)", gap: 4 }}>
                {(["city", "global"] as const).map((scope) => {
                  const isActive = locationScope === scope;
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setLocationScope(scope)}
                      style={{
                        border: "none",
                        borderRadius: 10,
                        padding: "10px 16px",
                        background: isActive ? "#fff" : "transparent",
                        color: isActive ? "#1f2937" : "#94a3b8",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: isActive ? "0 6px 16px rgba(17,39,45,0.06)" : "none",
                        textTransform: "capitalize",
                      }}
                    >
                      {scope}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 18 }}>
                <label style={{ display: "block", color: "#6b7280", fontSize: "0.9rem", marginBottom: 8 }}>
                  {locationScope === "city" ? "Pick a city" : "Global audience"}
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 12,
                    border: "1px solid rgba(148,163,184,0.22)",
                    padding: "0 12px",
                    background: locationScope === "global" ? "#f8fafc" : "#fff",
                  }}
                >
                  <MapPin size={16} color="#94a3b8" />
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={locationScope === "global"}
                    placeholder={locationScope === "global" ? "Global calendar" : "Chennai"}
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      padding: "12px 0",
                      background: "transparent",
                      color: "#1f2937",
                      fontSize: "0.95rem",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(255,101,132,0.1)", color: "#be123c" }}>
            {error}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              border: "none",
              borderRadius: 14,
              padding: "13px 20px",
              background: "#111827",
              color: "#fff",
              fontWeight: 800,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              opacity: submitting ? 0.82 : 1,
            }}
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <CalendarPlus2 size={18} />}
            {submitting ? "Creating..." : "Create Calendar"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function CreateCalendarPage() {
  return (
    <Suspense fallback={null}>
      <CreateCalendarPageContent />
    </Suspense>
  );
}
