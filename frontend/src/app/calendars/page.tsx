"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, MapPin, Plus, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  isLocalFallbackResponse,
  mergeUniqueTimelineItems,
  readStoredTimelineIdentity,
} from "@/lib/personalTimelineCache";
import {
  getOwnerCalendarsCacheKey,
  readOwnerCalendarsCache,
  writeOwnerCalendarsCache,
} from "@/lib/ownerCalendarCache";

type OwnerCalendar = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  tint_color: string;
  location_scope: "city" | "global";
  city: string;
  subscriber_count: number;
  is_default: boolean;
  event_count: number;
  upcoming_event_count: number;
};

function buildCalendarGradient(color: string) {
  return `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 42%, white))`;
}

export default function CalendarsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [calendars, setCalendars] = useState<OwnerCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    const fetchCalendars = async () => {
      setLoading(true);
      const identity = user ?? readStoredTimelineIdentity();
      const cacheKey = getOwnerCalendarsCacheKey(identity);
      const cachedCalendars = readOwnerCalendarsCache<OwnerCalendar>(cacheKey).filter(
        (calendar): calendar is OwnerCalendar => Boolean(calendar) && typeof calendar === "object",
      );

      if (cachedCalendars.length > 0) {
        setCalendars(cachedCalendars);
        setLoading(false);
      }

      try {
        const response = await api.get("/events/calendars");
        const fetchedCalendars = Array.isArray(response.data) ? response.data : [];
        const fallbackResponse = isLocalFallbackResponse(response.headers);
        const nextCalendars =
          fallbackResponse && cachedCalendars.length > 0
            ? mergeUniqueTimelineItems(cachedCalendars, fetchedCalendars)
            : fetchedCalendars;

        setCalendars(nextCalendars);
        if (!fallbackResponse || cachedCalendars.length === 0) {
          writeOwnerCalendarsCache(cacheKey, nextCalendars);
        }
        setError("");
      } catch (err: any) {
        if (cachedCalendars.length > 0) {
          setCalendars(cachedCalendars);
          setError("");
        } else {
          setError(err?.response?.data?.detail || "Could not load your calendars right now.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCalendars();
  }, [authLoading, router, user]);

  if (authLoading || loading) {
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
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "44px 20px 80px" }}>
      <section style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "2.6rem", fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 12px" }}>Calendars</h1>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr auto",
            gap: 18,
            padding: 20,
            borderRadius: 28,
            background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,250,251,0.94))",
            border: "1px solid rgba(14,118,120,0.12)",
            boxShadow: "0 18px 42px rgba(17,39,45,0.06)",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: 24,
              background: "linear-gradient(135deg, rgba(14,118,120,0.18), rgba(255,255,255,0.95))",
              display: "grid",
              placeItems: "center",
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                background: "linear-gradient(135deg, #f06292, #f8f8ff)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                boxShadow: "0 14px 30px rgba(240,98,146,0.25)",
              }}
            >
              <CalendarDays size={26} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#1f2937", marginBottom: 6 }}>Welcome to Owner Calendars</div>
            <div style={{ color: "#6b7280", lineHeight: 1.6, maxWidth: 560 }}>
              Create and manage your personal calendars, then assign events to the right one while publishing.
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/calendars/create")}
            style={{
              border: "none",
              borderRadius: 16,
              padding: "12px 18px",
              background: "#111827",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Plus size={16} />
            Create
          </button>
        </div>
      </section>

      {error && (
        <div style={{ marginBottom: 18, padding: "14px 16px", borderRadius: 16, background: "rgba(255,101,132,0.1)", color: "#be123c" }}>
          {error}
        </div>
      )}

      <section style={{ marginBottom: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "2rem", margin: 0, fontWeight: 800 }}>My Calendars</h2>
          <button
            type="button"
            onClick={() => router.push("/calendars/create")}
            style={{
              border: "1px solid rgba(14,118,120,0.12)",
              borderRadius: 14,
              padding: "10px 14px",
              background: "#fff",
              color: "#4b5563",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Plus size={16} />
            Create
          </button>
        </div>

        {calendars.length === 0 ? (
          <div
            style={{
              padding: 28,
              borderRadius: 24,
              background: "#fff",
              border: "1px dashed rgba(14,118,120,0.22)",
              color: "#6b7280",
            }}
          >
            No calendars yet.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
            {calendars.map((calendar) => (
              <Link
                key={calendar.id}
                href={`/calendars/${calendar.slug}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  padding: 18,
                  borderRadius: 26,
                  background: "#fff",
                  border: "1px solid rgba(14,118,120,0.1)",
                  boxShadow: "0 18px 40px rgba(17,39,45,0.05)",
                  display: "grid",
                  gap: 14,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(eventTarget) => {
                  eventTarget.currentTarget.style.transform = "translateY(-4px)";
                  eventTarget.currentTarget.style.boxShadow = "0 24px 44px rgba(17,39,45,0.1)";
                  eventTarget.currentTarget.style.borderColor = "rgba(14,118,120,0.24)";
                }}
                onMouseLeave={(eventTarget) => {
                  eventTarget.currentTarget.style.transform = "translateY(0)";
                  eventTarget.currentTarget.style.boxShadow = "0 18px 40px rgba(17,39,45,0.05)";
                  eventTarget.currentTarget.style.borderColor = "rgba(14,118,120,0.1)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: buildCalendarGradient(calendar.tint_color),
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                      fontSize: "1.05rem",
                    }}
                  >
                    {(calendar.name || "C").slice(0, 1).toUpperCase()}
                  </div>
                  {calendar.is_default && (
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(14,118,120,0.08)",
                        color: "var(--primary-color)",
                        fontWeight: 800,
                        fontSize: "0.74rem",
                      }}
                    >
                      Default
                    </span>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: "1.28rem", fontWeight: 800, color: "#111827", marginBottom: 4 }}>{calendar.name}</div>
                  <div style={{ color: "#94a3b8", fontSize: "0.92rem", marginBottom: 8 }}>lu.ma/{calendar.slug}</div>
                  <div style={{ color: "#6b7280", fontSize: "0.95rem", lineHeight: 1.55 }}>
                    {calendar.description || "No description yet."}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, color: "#4b5563", fontSize: "0.9rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Users size={15} color="var(--primary-color)" />
                    <span>{calendar.subscriber_count} Subscriber{calendar.subscriber_count === 1 ? "" : "s"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CalendarDays size={15} color="var(--primary-color)" />
                    <span>{calendar.event_count} event{calendar.event_count === 1 ? "" : "s"} · {calendar.upcoming_event_count} upcoming</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <MapPin size={15} color="var(--primary-color)" />
                    <span>{calendar.location_scope === "city" ? calendar.city || "City calendar" : "Global calendar"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section style={{ borderTop: "1px solid rgba(148,163,184,0.22)", paddingTop: 28 }}>
        <h2 style={{ fontSize: "2rem", margin: "0 0 16px", fontWeight: 800 }}>Subscribed Calendars</h2>
        <div
          style={{
            padding: 28,
            borderRadius: 24,
            background: "#fff",
            border: "1px dashed rgba(148,163,184,0.22)",
            color: "#94a3b8",
          }}
        >
          Subscription support is not wired yet. Your owner calendars above are stored in the database and ready to use while creating events.
        </div>
      </section>
    </main>
  );
}
