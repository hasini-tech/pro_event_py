"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  MapPin,
  Share2,
  Users,
  Megaphone,
  BarChart3,
  Link2,
  CheckSquare,
  Copy,
  ArrowRight,
} from "lucide-react";

const tabs = ["Overview", "Guests", "Registration", "Blasts", "Insights", "More"] as const;

export default function EventDetailLuma() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Overview");

  // Hide global navbar for this page
  useEffect(() => {
    document.body.classList.add("hide-nav");
    return () => document.body.classList.remove("hide-nav");
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #EAF4FF 0%, #F8FAFC 28%, #FFFFFF 100%)",
        color: "#1F2937",
      }}
    >
      {/* Custom slim header (replaces global nav) */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "linear-gradient(180deg, #eaf4ff 0%, #f9fbff 65%, rgba(250,252,255,0.9) 100%)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(15,23,42,0.06)",
          padding: "12px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#475569", fontWeight: 700 }}>
          <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#111827" }}>Events</span>
          <span>Calendars</span>
          <span>Discover</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", color: "#475569", fontWeight: 700 }}>
          <span style={{ fontSize: "13px" }}>4:58 PM GMT+5:30</span>
          <button
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              background: "#0F7377",
              color: "#fff",
              border: "none",
              fontWeight: 800,
              boxShadow: "0 10px 20px rgba(15,115,119,0.25)",
              cursor: "pointer",
            }}
          >
            Create Event
          </button>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#ff9a9e,#fad0c4)",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            🙂
          </div>
        </div>
      </div>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 28px 8px",
          color: "#475569",
          fontWeight: 700,
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ letterSpacing: "0.06em" }}>Personal ›</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0F172A" }}>time</span>
        </div>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <a href="#" style={{ color: "#475569" }}>
            Event Page ↗
          </a>
        </div>
      </header>

      <section style={{ maxWidth: "1150px", margin: "0 auto", padding: "10px 20px 90px" }}>
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            borderBottom: "1px solid #E2E8F0",
            paddingBottom: "10px",
            marginBottom: "22px",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 4px",
                border: "none",
                background: "transparent",
                fontWeight: 800,
                color: activeTab === tab ? "#0F172A" : "#94A3B8",
                borderBottom: activeTab === tab ? "3px solid #0F172A" : "3px solid transparent",
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Actions bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          {[
            { icon: Users, label: "Invite Guests" },
            { icon: Megaphone, label: "Send a Blast" },
            { icon: Share2, label: "Share Event" },
            { icon: BarChart3, label: "Insights" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: "14px 16px",
                borderRadius: "12px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              <item.icon size={18} />
              {item.label}
            </div>
          ))}
        </div>

        {/* Overview + When & Where */}
        {activeTab === "Overview" && (
          <div
            id="overview"
            style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: "18px" }}
          >
            <div
              style={{
                padding: "16px",
                borderRadius: "14px",
                background: "#F3FAF1",
                border: "1px solid #E2E8F0",
                display: "grid",
                gap: "12px",
                boxShadow: "0 12px 24px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", gap: "14px" }}>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: "14px",
                    background: "#0F172A",
                    backgroundImage: "radial-gradient(circle at 50% 50%, #00ff92 0%, #002b20 45%)",
                  }}
                />
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>time</div>
                  <div style={{ display: "flex", gap: "10px", color: "#475569", fontWeight: 700 }}>
                    <CalendarDays size={16} /> Saturday, March 28 · 3:30 PM – 4:30 PM
                  </div>
                  <div style={{ color: "#64748B", fontWeight: 700 }}>Register to see address</div>
                </div>
              </div>

              <div
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  background: "#fff",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: "6px", color: "#111827" }}>
                  Registration
                </div>
                <div style={{ color: "#475569" }}>
                  Welcome! To join the event, please register below.
                </div>
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    color: "#475569",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #ff9a9e, #fad0c4)",
                    }}
                  />
                  Hasini · hasini.developer@gmail.com
                </div>
                <button
                  style={{
                    marginTop: "12px",
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#0F9D7A",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  One-Click RSVP
                </button>
                <div
                  style={{
                    marginTop: "10px",
                    padding: "10px",
                    borderRadius: "10px",
                    background: "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#475569",
                    fontWeight: 700,
                  }}
                >
                  luma.com/lvfw8lhu
                  <Copy size={16} />
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "16px",
                borderRadius: "14px",
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                boxShadow: "0 12px 24px rgba(0,0,0,0.06)",
                display: "grid",
                gap: "12px",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>When & Where</div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#EF8F00", fontWeight: 800 }}>
                <div
                  style={{
                    width: 48,
                    height: 58,
                    borderRadius: "14px",
                    background: "#F8FAFC",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid #E2E8F0",
                    fontWeight: 900,
                    color: "#111827",
                  }}
                >
                  MAR <br /> 28
                </div>
                <div>
                  <div style={{ color: "#0F172A", fontWeight: 800 }}>Today · 3:30 PM – 4:30 PM</div>
                  <div style={{ color: "#475569" }}>GMT+5:30</div>
                </div>
              </div>

              <div
                style={{
                  marginTop: "6px",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "#FFF7ED",
                  color: "#B45309",
                  fontWeight: 700,
                  border: "1px dashed #F2C26B",
                }}
              >
                Location Missing — please add the address before your event starts.
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "6px" }}>
                <button
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "#0F172A",
                    color: "#fff",
                    border: "none",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  Edit Event <ArrowRight size={16} />
                </button>
                <button
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    fontWeight: 800,
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  Change Photo
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Guests" && (
          <div
            id="guests"
            style={{
              display: "grid",
              gap: "18px",
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "18px",
              boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "1.2rem" }}>At a Glance</div>
            <div style={{ color: "#94A3B8", fontSize: "1.6rem", fontWeight: 800 }}>0 Going</div>
            <div style={{ height: 8, borderRadius: 999, background: "#E2E8F0" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
              {[
                { label: "Invite Guests" },
                { label: "Check In Guests" },
                { label: "Guest List", sub: "Shown to guests" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    fontWeight: 700,
                  }}
                >
                  {item.label}
                  {item.sub && <div style={{ color: "#94A3B8", fontSize: "0.85rem" }}>{item.sub}</div>}
                </div>
              ))}
            </div>
            <div style={{ padding: "28px", textAlign: "center", color: "#94A3B8", fontWeight: 700 }}>
              No Guests Yet
            </div>
          </div>
        )}

        {activeTab === "Registration" && (
          <div id="registration" style={{ display: "grid", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
              {[
                { label: "Registration", value: "Open" },
                { label: "Event Capacity", value: "Unlimited" },
                { label: "Group Registration", value: "Off" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    background: "#fff",
                    border: "1px solid #E2E8F0",
                    fontWeight: 800,
                  }}
                >
                  {item.label}
                  <div style={{ color: "#94A3B8", fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px" }}>
              <div style={{ fontWeight: 800, marginBottom: "8px" }}>Tickets</div>
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px dashed #E2E8F0",
                  color: "#475569",
                  fontWeight: 700,
                }}
              >
                Connect Stripe to start selling tickets. Set up in under 5 minutes.
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "12px",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  fontWeight: 700,
                }}
              >
                <span>Standard</span>
                <span style={{ color: "#94A3B8" }}>Free</span>
              </div>
            </div>
            <div
              style={{
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                padding: "16px",
                display: "grid",
                gap: "12px",
              }}
            >
              <div style={{ fontWeight: 800 }}>Registration Email</div>
              <div style={{ color: "#475569" }}>
                Guests receive a confirmation email with calendar invite.
              </div>
              <button
                style={{
                  width: "160px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  background: "#111827",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Customize Email
              </button>
            </div>
          </div>
        )}

        {activeTab === "Blasts" && (
          <div
            id="blasts"
            style={{
              display: "grid",
              gap: "12px",
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "18px",
              boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>Send Blasts</div>
            <div
              style={{
                padding: "14px",
                borderRadius: "10px",
                background: "#F8FAFC",
                border: "1px dashed #E2E8F0",
                color: "#475569",
                fontWeight: 700,
              }}
            >
              Share updates with your guests via email, SMS, and push.
            </div>
            <div style={{ marginTop: "6px", fontWeight: 800 }}>System Messages</div>
            <div style={{ display: "grid", gap: "10px" }}>
              {["Event Reminders", "Post-Event Feedback"].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    justifyContent: "spaceBetween",
                    alignItems: "center",
                    fontWeight: 700,
                  }}
                >
                  <span>{item}</span>
                  <button
                    style={{
                      padding: "8px 12px",
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Insights" && (
          <div
            id="insights"
            style={{
              display: "grid",
              gap: "14px",
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "18px",
              boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>Page Views</div>
                <div style={{ color: "#475569" }}>See recent page views of the event page.</div>
              </div>
              <button
                style={{
                  padding: "8px 10px",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Past 7 Days ▾
              </button>
            </div>
            <div
              style={{
                height: 160,
                borderRadius: "10px",
                background: "linear-gradient(180deg,#eef2ff 0%,#fff 100%)",
                border: "1px solid #e2e8f0",
              }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                color: "#475569",
                fontWeight: 700,
              }}
            >
              <div>
                <div>Page Views</div>
                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    marginTop: "6px",
                    color: "#0f172a",
                    fontWeight: 800,
                  }}
                >
                  <span>24h: 2</span>
                  <span>7d: 2</span>
                  <span>30d: 2</span>
                </div>
              </div>
              <div>
                <div>Sources</div>
                <div style={{ marginTop: "6px", color: "#0f172a", fontWeight: 800 }}>Luma · 100%</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "More" && (
          <div id="more" style={{ display: "grid", gap: "14px" }}>
            <div
              style={{
                padding: "16px",
                borderRadius: "12px",
                background: "#fff",
                border: "1px solid #E2E8F0",
                boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: "8px" }}>Clone Event</div>
              <div style={{ color: "#475569", marginBottom: "10px" }}>
                Create a new event with the same information as this one.
              </div>
              <button
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: "#111827",
                  color: "#fff",
                  border: "none",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Clone Event
              </button>
            </div>
            <div
              style={{
                padding: "16px",
                borderRadius: "12px",
                background: "#fff",
                border: "1px solid #E2E8F0",
                boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: "8px" }}>Event Page</div>
              <div style={{ color: "#475569", marginBottom: "10px" }}>
                Update the public URL for this event.
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    fontWeight: 800,
                  }}
                >
                  lu.ma/
                </span>
                <input
                  defaultValue="lvfw8lhu"
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    flex: 1,
                  }}
                />
                <button
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "#E2E8F0",
                    color: "#475569",
                    border: "none",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
