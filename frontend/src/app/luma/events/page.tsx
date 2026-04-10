"use client";

import { useState } from "react";
import { CalendarDays, MapPin, AlertTriangle, Users, Clock3 } from "lucide-react";

const mockEvents = [
  {
    id: "1",
    title: "time",
    status: "LIVE",
    date: "Today · 3:30 PM",
    warning: "Location Missing",
    guests: 0,
    cover: "https://i.imgur.com/2S1YQ7y.png",
  },
];

export default function LumaEventsPage() {
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f6f9ff 0%, #f9fafb 40%, #ffffff 100%)",
        color: "#0f172a",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 26px",
          color: "#475569",
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <CalendarDays size={16} />
            Events
          </span>
          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            Calendars
          </span>
          <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            Discover
          </span>
        </div>
        <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
          <span style={{ fontSize: "13px" }}>4:17 PM GMT+5:30</span>
          <button
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Create Event
          </button>
        </div>
      </header>

      <section style={{ maxWidth: "1180px", margin: "0 auto", padding: "8px 20px 90px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "18px" }}>
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            {(["upcoming", "past"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "none",
                  background: filter === key ? "#fff" : "transparent",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: filter === key ? "0 10px 18px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {key === "upcoming" ? "Upcoming" : "Past"}
              </button>
            ))}
          </div>
        </div>

        <h1 style={{ fontSize: "2rem", marginBottom: "18px" }}>Events</h1>

        <div style={{ display: "grid", gap: "22px" }}>
          {mockEvents.map((event) => (
            <div
              key={event.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "14px",
                alignItems: "stretch",
                padding: "16px",
                borderRadius: "16px",
                background: "#fff",
                boxShadow: "0 16px 32px rgba(0,0,0,0.06)",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "grid", gap: "10px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "#ef4444", fontWeight: 800 }}>
                  <span>{event.status}</span>
                  <Clock3 size={16} />
                  <span style={{ color: "#475569", fontWeight: 700 }}>{event.date}</span>
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800 }}>{event.title}</div>
                <div style={{ display: "flex", gap: "8px", color: "#f59e0b", fontWeight: 700, alignItems: "center" }}>
                  <AlertTriangle size={16} />
                  {event.warning}
                </div>
                <div style={{ display: "flex", gap: "8px", color: "#94a3b8", fontWeight: 700, alignItems: "center" }}>
                  <Users size={16} />
                  No guests
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "#111827",
                      color: "#fff",
                      border: "none",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Check In
                  </button>
                  <button
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "#f1f5f9",
                      color: "#111827",
                      border: "1px solid #e2e8f0",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Manage →
                  </button>
                </div>
              </div>
              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: "14px",
                  background: "#0f172a",
                  backgroundImage: `url(${event.cover})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
