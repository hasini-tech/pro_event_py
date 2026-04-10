"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  ShieldCheck,
  Loader2,
  AlertCircle,
  DollarSign,
  RefreshCw,
  MapPin,
  Clock3,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

type AdminEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  status: string;
  max_seats: number;
  seats_left: number;
  ticket_price: number;
  ticket_sales: number;
  host_name: string;
  host_id: string;
  slug: string;
  location: string;
  is_online: boolean;
  confirmed_count: number;
  waitlisted_count: number;
  attendee_count: number;
  created_at: string;
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: "18px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  color: "#6b7280",
  fontWeight: 600,
  fontSize: "13px",
};
const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: "13px" };

function formatDate(date: string, time?: string) {
  const d = new Date(date);
  const datePart = isNaN(d.getTime()) ? date : d.toLocaleDateString();
  return time ? `${datePart} · ${time}` : datePart;
}

function StatusPill({ status }: { status: string }) {
  const isPublished = status === "published";
  const bg = isPublished ? "#f0fdf4" : status === "draft" ? "#fef9c3" : "#fee2e2";
  const color = isPublished ? "#16a34a" : status === "draft" ? "#ca8a04" : "#dc2626";
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
        background: bg,
        color,
        textTransform: "capitalize",
      }}
    >
      {status || "unknown"}
    </span>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadEvents = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get("/events/admin/all");
      setEvents(data || []);
      setError("");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not load events.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/admin");
      return;
    }
    if (user.role !== "admin") {
      setError("Admin access required. Please sign in with an admin account.");
      setLoading(false);
      return;
    }
    loadEvents();
  }, [authLoading, user]);

  const summary = useMemo(() => {
    const total = events.length;
    const published = events.filter((e) => e.status === "published").length;
    const confirmed = events.reduce((sum, e) => sum + (Number(e.confirmed_count) || 0), 0);
    const revenue = events.reduce((sum, e) => sum + (Number(e.ticket_sales) || 0), 0);
    const seatsLeft = events.reduce((sum, e) => sum + (Number(e.seats_left) || 0), 0);
    return { total, published, confirmed, revenue, seatsLeft };
  }, [events]);

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={42} color="#0f7377" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...card, padding: "24px 26px", maxWidth: "520px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#b91c1c", fontWeight: 700 }}>
            <AlertCircle size={20} /> {error}
          </div>
          {!user && (
            <button
              onClick={() => router.replace("/login?redirect=/admin")}
              style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #0f7377", color: "#0f7377", background: "white", fontWeight: 700, cursor: "pointer" }}
            >
              Go to login
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 20px 96px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "22px" }}>
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderRadius: "999px",
              background: "rgba(15,115,119,0.08)",
              color: "#0f7377",
              fontWeight: 700,
            }}
          >
            <ShieldCheck size={16} /> Admin panel
          </div>
          <h1 style={{ marginTop: "10px", marginBottom: 4, fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>All events</h1>
          <p style={{ color: "#6b7280" }}>Live data fetched directly from the database.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ color: "#6b7280", fontSize: "14px" }}>
            Signed in as <strong>{user?.email}</strong>
          </div>
          <button
            onClick={loadEvents}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              color: "#0f7377",
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginBottom: "18px" }}>
        {[
          { label: "Total events", value: summary.total, icon: Calendar, color: "#0f7377" },
          { label: "Published", value: summary.published, icon: CheckCircle2, color: "#0f9d7a" },
          { label: "Confirmed RSVPs", value: summary.confirmed, icon: Users, color: "#4b5563" },
          { label: "Revenue", value: `$${summary.revenue.toFixed(2)}`, icon: DollarSign, color: "#1f6a52" },
          { label: "Seats left", value: summary.seatsLeft, icon: AlertCircle, color: "#ca8a04" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ ...card, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#6b7280", fontSize: "13px", marginBottom: "6px" }}>{label}</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color }}>{value}</div>
            </div>
            <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "rgba(15,115,119,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color }}>
              <Icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Events table */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
          <Calendar size={18} /> All Events ({events.length})
        </div>
        <div style={{ maxHeight: "640px", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["Title", "Host", "Date", "Status", "Seats", "Revenue", "Created", "Actions"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>
                    No events found.
                  </td>
                </tr>
              )}
              {events.map((evt, idx) => (
                <tr key={evt.id} style={{ borderBottom: idx !== events.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {evt.title}
                    <div style={{ color: "#6b7280", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <MapPin size={12} /> {evt.is_online ? "Online" : evt.location || "—"}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: "#6b7280" }}>{evt.host_name || "Host"}</td>
                  <td style={{ ...tdStyle, color: "#374151" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock3 size={14} color="#9ca3af" />
                      {formatDate(evt.date, evt.time)}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <StatusPill status={evt.status} />
                  </td>
                  <td style={{ ...tdStyle, color: "#6b7280" }}>
                    {evt.max_seats === 0 ? "Unlimited" : `${evt.max_seats} total / ${evt.seats_left ?? 0} left`}
                    <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                      RSVPs: {evt.attendee_count ?? 0} · Confirmed: {evt.confirmed_count ?? 0} · Waitlist: {evt.waitlisted_count ?? 0}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: "#111827", fontWeight: 700 }}>${Number(evt.ticket_sales || 0).toFixed(2)}</td>
                  <td style={{ ...tdStyle, color: "#6b7280" }}>{formatDate(evt.created_at)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => router.push(`/events/${evt.slug}`)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: "10px",
                          border: "1px solid #e5e7eb",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: "13px",
                          background: "#fff",
                          color: "#0f7377",
                        }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => router.push(`/manage/${evt.slug}`)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: "10px",
                          border: "1px solid #0f7377",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: "13px",
                          background: "rgba(15,115,119,0.08)",
                          color: "#0f7377",
                        }}
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
