"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  AtSign,
  Calendar,
  ChevronRight,
  Clock3,
  Copy,
  Apple,
  Download,
  ExternalLink,
  Eye,
  Facebook,
  Info,
  Layout,
  Link as LinkIcon,
  Linkedin,
  List,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  Monitor,
  PencilLine,
  Phone,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Send,
  Settings,
  Share2,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Twitter,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { DEFAULT_EVENT_COVER } from "@/lib/defaults";
import {
  getPersonalTimelineCacheKey,
  isLocalFallbackResponse,
  mergeUniqueTimelineItems,
  readPersonalTimelineCacheItems,
  readStoredTimelineIdentity,
  writePersonalTimelineCacheItems,
} from "@/lib/personalTimelineCache";
import { QRCodeSVG } from "qrcode.react";

type EventRecord = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  is_online?: boolean;
  cover_image?: string;
  share_url?: string;
  is_paid?: boolean;
  ticket_price?: number;
  max_seats?: number;
  status?: string;
  agenda?: string[];
  confirmed_count?: number;
  attendee_count?: number;
  checked_in_count?: number;
  ticket_sales?: number;
  conversion_rate?: number;
  waitlisted_count?: number;
};

type Insight = { label: string; value: string | number };
type CachedHostedEvent = EventRecord & { relationship?: string };

type EditForm = {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  is_online: boolean;
  is_paid: boolean;
  ticket_price: number;
  max_seats: number;
  status: string;
};

const tabs = [
  { key: "overview", label: "Overview" },
  { key: "guests", label: "Guests" },
  { key: "registration", label: "Registration" },
  { key: "blasts", label: "Blasts" },
  { key: "insights", label: "Insights" },
  { key: "more", label: "More" },
] as const;

const statuses = ["published", "private", "draft", "cancelled"] as const;

function dateValue(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

function timeValue(event: EventRecord) {
  if (event.time) return String(event.time).slice(0, 5);
  if (!event.date) return "";
  const d = new Date(event.date);
  if (Number.isNaN(d.getTime())) return "";
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

function buildEditForm(event: EventRecord): EditForm {
  return {
    title: event.title || "",
    description: event.description || "",
    date: dateValue(event.date),
    time: timeValue(event),
    location: event.location || "",
    is_online: Boolean(event.is_online),
    is_paid: Boolean(event.is_paid),
    ticket_price: Number(event.ticket_price || 0),
    max_seats: Number(event.max_seats || 0),
    status: event.status || "published",
  };
}

function buildShareUrl(event: EventRecord | null) {
  if (!event) return "";
  if (event.share_url) return event.share_url;
  const configuredBase = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "";
  const base = configuredBase.replace(/\/$/, "");
  return base ? `${base}/events/${event.slug}` : `/events/${event.slug}`;
}

function buildInviteMessage(event: EventRecord, shareUrl: string) {
  const when = event.date ? new Date(event.date).toLocaleString() : "Date and time to be announced";
  const where = event.is_online ? "Online event" : event.location || "Venue to be announced";
  return `You are invited to ${event.title}.\n\nWhen: ${when}\nWhere: ${where}\n\nRSVP here: ${shareUrl}`;
}

async function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

function readCachedHostedEvents(identity: { id?: string | null; email?: string | null } | null | undefined) {
  const cacheKey = getPersonalTimelineCacheKey(identity);
  const items = readPersonalTimelineCacheItems<CachedHostedEvent>(cacheKey).filter(
    (item): item is CachedHostedEvent => Boolean(item) && typeof item === "object",
  );

  return {
    cacheKey,
    items: items.filter((item) => {
      const relationship = typeof item.relationship === "string" ? item.relationship : "hosting";
      return relationship === "hosting";
    }),
  };
}

function writeCachedHostedEvent(
  identity: { id?: string | null; email?: string | null } | null | undefined,
  event: EventRecord,
) {
  const { cacheKey, items } = readCachedHostedEvents(identity);
  writePersonalTimelineCacheItems(
    cacheKey,
    mergeUniqueTimelineItems([{ ...event, relationship: "hosting" }], items),
  );
}

export default function ManageEventPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const { user, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("overview");
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [guests, setGuests] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [blasts, setBlasts] = useState<any[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isGuestListOpen, setIsGuestListOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("evently_token") : null;
    if (!user || !token) router.replace(`/login?redirect=/manage/${slug}`);
  }, [authLoading, router, slug, user]);

  useEffect(() => {
    if (authLoading || !user || !slug) {
      return;
    }

    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const identity = user ?? readStoredTimelineIdentity();
      const { items: cachedHostedEvents } = readCachedHostedEvents(identity);
      const cachedEvent =
        cachedHostedEvents.find((item) => String(item.slug || "").trim() === slug) || null;

      if (cachedEvent && mounted) {
        setEvent(cachedEvent);
        setEditForm(buildEditForm(cachedEvent));
        setLoading(false);
      }

      try {
        const response = await api.get(`/events/manage/${slug}`);
        const eventData = response.data;
        if (!mounted) return;
        setEvent(eventData);
        setEditForm(buildEditForm(eventData));
        writeCachedHostedEvent(identity, eventData);

        // Fetch guests from ticket service
        api
          .get(`/tickets/event/${eventData.id}`)
          .then((res) => mounted && setGuests(res.data || []))
          .catch(() => {});

        // Fetch registrations from attendee service
        api
          .get(`/attendees/event/${eventData.id}`)
          .then((res) => mounted && setRegistrations(res.data || []))
          .catch(() => {});

        // Fetch blasts (currently simulated or empty)
        api
          .get(`/blasts?event_id=${eventData.id}`)
          .then((res) => mounted && setBlasts(res.data || []))
          .catch(() => {});

        // Set insights from event metrics instead of a failing dedicated endpoint
        const metrics = [
          { label: "Confirmed Guests", value: eventData.confirmed_count || 0 },
          { label: "Total Registrations", value: eventData.attendee_count || 0 },
          { label: "Checked-in", value: eventData.checked_in_count || 0 },
          { label: "Ticket Sales", value: `Rs ${eventData.ticket_sales || 0}` },
          { label: "Conversion Rate", value: `${eventData.conversion_rate || 0}%` },
          { label: "Waitlisted", value: eventData.waitlisted_count || 0 },
        ];
        setInsights(metrics);
      } catch (err: any) {
        if (!mounted) return;
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail;
        const usedFallback = isLocalFallbackResponse(err?.response?.headers);

        if (status === 401) {
          router.replace(`/login?redirect=/manage/${slug}`);
          return;
        }

        if (status === 403) {
          setError("You are not authorized to manage this event.");
          return;
        }

        if (cachedEvent && (usedFallback || !status || status >= 500)) {
          setEvent(cachedEvent);
          setEditForm(buildEditForm(cachedEvent));
          setError(null);
          setMessage("Showing your last saved event details while the event service reconnects.");
          return;
        }

        setError(detail || "Failed to load event");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [authLoading, router, slug, user]);

  const eventDate = useMemo(() => (event?.date ? new Date(event.date) : null), [event?.date]);
  const formattedDate = eventDate ? eventDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Date TBA";
  const formattedTime = event?.time || (eventDate ? eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Time TBA");
  const shareUrl = useMemo(() => buildShareUrl(event), [event]);
  const inviteMessage = useMemo(() => (event ? buildInviteMessage(event, shareUrl) : ""), [event, shareUrl]);
  const locationLabel = useMemo(() => {
    if (!event) return "";
    if (event.is_online) return "Online";
    return event.location || "Venue TBA";
  }, [event]);

  const shareEvent = async () => {
    if (!event || !shareUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: event.title, text: `Join ${event.title}`, url: shareUrl });
        setMessage("Share options opened for this event.");
        return;
      }
      await copyText(shareUrl);
      setMessage("Event link copied.");
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        await copyText(shareUrl);
        setMessage("Event link copied.");
      }
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !editForm) return;
    setSaving(true);
    try {
      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        date: new Date(`${editForm.date}T${editForm.time || "00:00"}`).toISOString(),
        time: editForm.time,
        location: editForm.location.trim(),
        is_online: editForm.is_online,
        is_paid: editForm.is_paid,
        ticket_price: editForm.is_paid ? Number(editForm.ticket_price || 0) : 0,
        max_seats: Math.max(0, Number(editForm.max_seats || 0)),
        status: editForm.status,
        agenda: (event as any).agenda || [],
      };
      const { data } = await api.put(`/events/${event.id}`, payload);
      setEvent(data);
      setEditForm(buildEditForm(data));
      writeCachedHostedEvent(user ?? readStoredTimelineIdentity(), data);
      setEditOpen(false);
      setMessage("Event details updated.");
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || "Failed to update event details.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageShell><div style={{ minHeight: "40vh", display: "grid", placeItems: "center" }}><Loader2 className="animate-spin" size={34} color="var(--primary-color)" /></div></PageShell>;
  }
  if (error) return <PageShell>{error}</PageShell>;
  if (!event) return <PageShell>Event not found.</PageShell>;

  return (
    <PageShell>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 20px 80px" }}>
        {/* Breadcrumb & Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#666", fontSize: "0.95rem", marginBottom: 12 }}>
            <span>Personal</span>
            <ChevronRight size={14} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <h1 style={{ fontSize: "3.2rem", fontWeight: 800, margin: 0, letterSpacing: "-0.04em" }}>{event.title}</h1>
            <a 
              href={`/events/${event.slug}`} 
              target="_blank" 
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#f5f5f5", color: "#333", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none" }}
            >
              Event Page <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Tab Bar */}
        <TabBar activeTab={activeTab} onChange={setActiveTab} />

        {/* Main Content Sections */}
        <section style={{ marginTop: 0 }}>
          {activeTab === "overview" && (
            <div style={{ display: "grid", gap: 32 }}>
              {/* Quick Action Buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <div onClick={() => setInviteOpen(true)} style={quickActionCard}>
                  <div style={{ ...iconCircle, background: "rgba(0, 102, 255, 0.08)", color: "#0066FF" }}><Users size={20} /></div>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Invite Guests</span>
                </div>
                <div onClick={() => setActiveTab("blasts")} style={quickActionCard}>
                  <div style={{ ...iconCircle, background: "rgba(147, 51, 234, 0.08)", color: "#9333ea" }}><Zap size={20} /></div>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Send a Blast</span>
                </div>
                <div onClick={shareEvent} style={quickActionCard}>
                  <div style={{ ...iconCircle, background: "rgba(236, 72, 153, 0.08)", color: "#ec4899" }}><Share2 size={20} /></div>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Share Event</span>
                </div>
              </div>

              {/* Event Summary Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, alignItems: "start" }}>
                {/* Left: Event Card Visual */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 24, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr" }}>
                      <div style={{ height: 160, background: `url(${event.cover_image || DEFAULT_EVENT_COVER}) center/cover` }} />
                      <div style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "1.4rem", marginBottom: 12, letterSpacing: "-0.03em" }}>{event.title}</div>
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                            <div style={dateBadgeMini}>
                              <div style={{ fontSize: "0.6rem", textTransform: "uppercase", fontWeight: 700, color: "#ef4444" }}>{eventDate ? eventDate.toLocaleDateString(undefined, { month: "short" }) : "Mo"}</div>
                              <div style={{ fontSize: "0.9rem", fontWeight: 800 }}>{eventDate ? eventDate.getDate() : "1"}</div>
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{formattedDate.split(",")[1]?.trim() || formattedDate}</div>
                              <div style={{ fontSize: "0.85rem", color: "#666" }}>{formattedTime} - {formattedTime}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", color: "#666" }}>
                            <MapPin size={14} /> <span>{event.is_online ? "Registration for Address" : (event.location || "Register to See Address")}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Hosted By Section */}
                    <div style={{ padding: "0 20px 20px", marginTop: -4 }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#999", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>Hosted By</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f0f0f0", overflow: "hidden" }}>
                          {user?.profile_image ? <img src={user.profile_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Users size={16} style={{ transform: "translate(6px, 6px)" }} />}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{user?.name || "Host"}</span>
                      </div>
                      
                      {/* One Click RSVP placeholder (as in screenshot) */}
                      <div style={{ marginTop: 24, padding: 18, borderRadius: 18, background: "#f9f9f9", border: "1px solid #efefef" }}>
                         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>Registration</div>
                            <div style={{ padding: "4px 8px", background: "white", borderRadius: 8, fontSize: "0.75rem", border: "1px solid #eee" }}>Status</div>
                         </div>
                         <button disabled style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#9333ea", color: "white", fontWeight: 800, border: "none", opacity: 0.8 }}>One-Click RSVP</button>
                      </div>
                    </div>
                    
                    {/* Event URL Bar */}
                    <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "1fr auto", borderTop: "1px solid #f0f0f0" }}>
                       <div style={{ padding: "14px 20px", background: "#f8f8f8", color: "#666", fontSize: "0.9rem", fontWeight: 600 }}>{shareUrl.replace(/^https?:\/\//, "")} ↗</div>
                       <div onClick={async() => { await copyText(shareUrl); setMessage("Link copied."); }} style={{ padding: "14px 24px", background: "#ddd", color: "#666", fontWeight: 800, fontSize: "0.8rem", cursor: "pointer", letterSpacing: "0.05em" }}>COPY</div>
                    </div>
                  </div>
                  {/* Footer Social Icons */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
                    <span style={{ fontSize: "0.9rem", color: "#666", fontWeight: 600 }}>Share Event</span>
                    <div style={{ display: "flex", gap: 14, color: "#666" }}>
                      <Facebook size={18} style={{ cursor: "pointer" }} />
                      <Twitter size={18} style={{ cursor: "pointer" }} />
                      <Linkedin size={18} style={{ cursor: "pointer" }} />
                      <Mail size={18} style={{ cursor: "pointer" }} />
                    </div>
                  </div>
                </div>

                {/* Right: When & Where Section */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Card style={{ padding: 32 }}>
                    <h3 style={{ margin: "0 0 24px", fontSize: "1.2rem", fontWeight: 800 }}>When & Where</h3>
                    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 28 }}>
                      <div style={dateBadgeLarge}>
                        <div style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, color: "#999" }}>{eventDate ? eventDate.toLocaleDateString(undefined, { month: "short" }) : "Mo"}</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800 }}>{eventDate ? eventDate.getDate() : "1"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 4 }}>{formattedDate.split(",")[0] === "Today" ? "Today" : (formattedDate.split(",")[1]?.trim() || formattedDate)}</div>
                        <div style={{ fontSize: "0.95rem", color: "#666", fontWeight: 500 }}>{formattedTime} - {formattedTime} GMT{eventDate ? eventDate.toLocaleTimeString("en-us",{timeZoneName:"short"}).split(" ").pop() : "+5:30"}</div>
                      </div>
                    </div>

                    {!event.location && !event.is_online ? (
                      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                        <div style={{ ...dateBadgeLarge, background: "#f5f5f5", color: "#999" }}><AlertTriangle size={24} /></div>
                        <div>
                          <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#facc15", marginBottom: 4 }}>Location Missing</div>
                          <div style={{ fontSize: "0.9rem", color: "#666", lineHeight: 1.5 }}>Please enter the location of the event before it starts.</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                        <div style={{ ...dateBadgeLarge, background: "rgba(0, 102, 255, 0.05)", color: "#0066FF" }}><MapPin size={24} /></div>
                        <div>
                          <div style={{ fontSize: "1.02rem", fontWeight: 800, marginBottom: 4 }}>{event.is_online ? "Virtual Event" : "Venue Address"}</div>
                          <div style={{ fontSize: "0.9rem", color: "#666", lineHeight: 1.5 }}>{event.location || "Registered guests can see it."}</div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 40, display: "flex", gap: 12 }}>
                      <button onClick={() => { setEditForm(buildEditForm(event)); setEditOpen(true); }} style={ghostBtn}>Edit Event</button>
                      <button style={ghostBtn}>Change Photo</button>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Invites Section */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0 }}>Invites</h3>
                  <button onClick={() => setInviteOpen(true)} style={{ ...pillBtn, background: "#f5f5f5", color: "#333", border: "none", boxShadow: "none", borderRadius: 10, padding: "8px 12px", fontSize: "0.9rem" }}>
                    <Plus size={16} /> Invite Guests
                  </button>
                </div>
                <p style={{ color: "#666", fontSize: "0.95rem", marginTop: 8, marginBottom: 24 }}>Invite subscribers, contacts and past guests via email or SMS.</p>
                <div style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: "#bbb" }}>
                  <Users size={48} strokeWidth={1.5} />
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>No Invites Sent</span>
                  <p style={{ color: "#999", fontSize: "0.9rem", margin: 0 }}>You can invite subscribers, contacts and past guests to the event.</p>
                </div>
              </div>

              {/* Hosts Section */}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                  <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0 }}>Hosts</h3>
                  <button style={{ ...pillBtn, background: "#f5f5f5", color: "#333", border: "none", boxShadow: "none", borderRadius: 10, padding: "8px 12px", fontSize: "0.9rem" }}>
                    <Plus size={16} /> Add Host
                  </button>
                </div>
                <div style={{ padding: "14px 18px", background: "#fff", borderRadius: 20, border: "1px solid #f1f1f1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Users size={20} color="#666" />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                           <span style={{ fontWeight: 800, fontSize: "1.05rem" }}>{user?.name || " Monica"}</span>
                           <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a", padding: "2px 8px", borderRadius: 99, background: "rgba(34, 197, 94, 0.1)" }}>Creator</span>
                        </div>
                        <div style={{ fontSize: "0.9rem", color: "#666" }}>{user?.email || "monicanazi142003@gmail.com"}</div>
                      </div>
                   </div>
                </div>
                <div style={{ marginTop: 24, fontSize: "0.95rem", color: "#666", display: "flex", alignItems: "center", gap: 8 }}>
                   <Users size={16} /> Manage check-in staff and options
                </div>
              </div>

              {/* Visibility & Discovery */}
              <div style={{ marginTop: 40 }}>
                <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0 }}>Visibility & Discovery</h3>
                <p style={{ color: "#666", fontSize: "0.95rem", marginTop: 8, marginBottom: 24 }}>Control how people can find your event.</p>
                <div style={{ padding: 24, background: "#fff", borderRadius: 20, border: "1px solid #f1f1f1", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
                   <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                      <div style={{ ...iconCircle, background: "#f5f5f5", color: "#666" }}><Users size={20} /></div>
                      <div>
                        <div style={{ fontSize: "0.85rem", color: "#666", fontWeight: 700, marginBottom: 4 }}>Managing Calendar</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 10 }}>Your Personal Calendar</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", color: "#666", marginBottom: 16 }}>
                          <span style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}><Users size={14} /> Public</span>
                          <span> — This event is listed on your profile page.</span>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button style={tinyBtn}><Users size={14} /> Change Visibility</button>
                          <button style={tinyBtn}><Users size={14} /> Transfer Calendar</button>
                        </div>
                      </div>
                   </div>
                </div>
                <div style={{ marginTop: 28, display: "flex", gap: 12, alignItems: "flex-start", color: "#999", fontSize: "0.95rem" }}>
                   <Star size={18} />
                   <p style={{ margin: 0, lineHeight: 1.5 }}>You can submit the event to a relevant Luma discovery page or other community calendars for a chance to be featured, so it can be discovered more easily.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "guests" && (
            <div style={{ display: "grid", gap: 32 }}>
              <div>
                <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 16px" }}>At a Glance</h3>
                <div style={{ color: "#bbb", fontSize: "1.8rem", fontWeight: 800, marginBottom: 20 }}>0 Going</div>
                <div style={{ height: 4, background: "#eee", borderRadius: 2, marginBottom: 32 }} />
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  <div onClick={() => setInviteOpen(true)} style={quickActionCardSmall}>
                    <div style={{ ...iconCircleSmall, background: "rgba(0, 102, 255, 0.08)", color: "#0066FF" }}><Users size={16} /></div>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Invite Guests</span>
                  </div>
                  <div onClick={() => router.push(`/check-in/${event.slug}`)} style={quickActionCardSmall}>
                    <div style={{ ...iconCircleSmall, background: "rgba(34, 197, 94, 0.08)", color: "#16a34a" }}><QrCode size={16} /></div>
                    <span onClick={(e) => { e.stopPropagation(); setIsCheckInOpen(true); }} style={{ fontWeight: 700, fontSize: "0.95rem" }}>Check In Guests</span>
                  </div>
                  <div onClick={() => setIsGuestListOpen(true)} style={quickActionCardSmall}>
                    <div style={{ ...iconCircleSmall, background: "rgba(245, 158, 11, 0.08)", color: "#f59e0b" }}><Users size={16} /></div>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Guest List <span style={{ fontWeight: 500, fontSize: "0.8rem", color: "#999" }}>Shown to guests</span></span>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                  <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0 }}>Guest List</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={tinyBtn}><UserPlus size={16} /></button>
                    <button style={tinyBtn}><List size={16} /></button>
                    <button style={tinyBtn}><Download size={16} /></button>
                  </div>
                </div>
                
                {guests.length === 0 ? (
                  <div style={{ padding: "80px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, color: "#ccc" }}>
                    <Users size={64} strokeWidth={1} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: "1.2rem", color: "#bbb", marginBottom: 4 }}>No Guests Yet</div>
                      <div style={{ color: "#999" }}>Share the event or invite people to get started!</div>
                    </div>
                  </div>
                ) : (
                  <Card style={{ padding: 0 }}>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {guests.map((g, i) => (
                        <li key={i} style={{ padding: "16px 24px", borderBottom: i === guests.length - 1 ? "none" : "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <User size={18} color="#999" />
                            </div>
                            <div>
                               <div style={{ fontWeight: 700, fontSize: "1.02rem" }}>{g.user_name || g.user_email || "Guest"}</div>
                               <div style={{ fontSize: "0.85rem", color: "#666" }}>{g.user_email}</div>
                            </div>
                          </div>
                          <span style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: 99, background: g.status === 'confirmed' ? "rgba(34, 197, 94, 0.1)" : "#f5f5f5", color: g.status === 'confirmed' ? "#16a34a" : "#666", fontWeight: 800 }}>{g.status}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </div>
          )}

          {activeTab === "registration" && (
            <div style={{ display: "grid", gap: 32 }}>
              {/* Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                <div style={quickActionCardSmall}>
                  <div style={{ ...iconCircleSmall, background: "rgba(34, 197, 94, 0.08)", color: "#16a34a" }}><Layout size={16} /></div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Registration</span>
                    <span style={{ fontSize: "0.75rem", color: "#666" }}>Open</span>
                  </div>
                </div>
                <div style={quickActionCardSmall}>
                  <div style={{ ...iconCircleSmall, background: "rgba(245, 158, 11, 0.08)", color: "#f59e0b" }}><Monitor size={16} /></div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Event Capacity</span>
                    <span style={{ fontSize: "0.75rem", color: "#666" }}>{event.max_seats || "Unlimited"}</span>
                  </div>
                </div>
                <div style={quickActionCardSmall}>
                  <div style={{ ...iconCircleSmall, background: "rgba(147, 51, 234, 0.08)", color: "#9333ea" }}><Users size={16} /></div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Group Registration</span>
                    <span style={{ fontSize: "0.75rem", color: "#666" }}>Off</span>
                  </div>
                </div>
              </div>

              {/* Tickets Section */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0 }}>Tickets</h3>
                  <button style={{ ...pillBtn, background: "#f5f5f5", color: "#333", border: "none", boxShadow: "none", borderRadius: 10, padding: "8px 12px", fontSize: "0.9rem" }}>
                    <Plus size={16} /> New Ticket Type
                  </button>
                </div>

                {/* Stripe Banner */}
                <div style={{ marginBottom: 20, padding: 20, background: "#fff", borderRadius: 20, border: "1px solid #f1f1f1", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center" }}>
                   <div style={{ width: 50, height: 50, borderRadius: "50%", background: "linear-gradient(135deg, #000, #333)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                      <Zap size={24} />
                   </div>
                   <div>
                      <div style={{ fontWeight: 800, fontSize: "1.02rem" }}>Start Selling. <span style={{ fontWeight: 500, color: "#666" }}>Connect Stripe to accept payments and receive payouts.</span></div>
                   </div>
                   <button style={{ ...actionPrimary, padding: "10px 18px", borderRadius: 12 }}>Get Started</button>
                </div>

                <div style={{ padding: "16px 20px", background: "#fff", borderRadius: 16, border: "1px solid #f1f1f1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                      Standard <span style={{ color: "#999", fontWeight: 500 }}>Free</span>
                   </div>
                   <div style={{ color: "#999", display: "flex", alignItems: "center", gap: 6, fontSize: "0.9rem" }}>
                      <Users size={16} /> 0
                   </div>
                </div>
              </div>

              {/* Registration Email */}
              <div>
                <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 8px" }}>Registration Email</h3>
                <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: 20 }}>Tailor the confirmation email sent to guests after they register.</p>
                <button style={{ ...actionPrimary, background: "#000", color: "#fff" }}><Mail size={16} /> Customize Email</button>
              </div>

              {/* Questions Section */}
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 16px" }}>Registration Questions</h3>
                <div style={{ display: "grid", gap: 24 }}>
                   {/* Personal Info */}
                   <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 12, color: "#16a34a" }}>
                         <UserCheck size={18} /> Personal Information
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                         <div style={questionBox}><User size={14} /> Name <span style={{ marginLeft: "auto", color: "#ccc" }}>Full Name</span></div>
                         <div style={questionBox}><Mail size={14} /> Email <span style={{ marginLeft: "auto", color: "#16a34a" }}>Required</span></div>
                         <div style={questionBox}><Phone size={14} /> Phone <span style={{ marginLeft: "auto", color: "#999" }}>Off</span></div>
                      </div>
                   </div>
                   {/* Web3 Identity */}
                   <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 12, color: "#9333ea" }}>
                         <Wallet size={18} /> Web3 Identity
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                         <div style={questionBox}>ETH Address <span style={{ marginLeft: "auto", color: "#999" }}>Off</span></div>
                         <div style={questionBox}>SOL Address <span style={{ marginLeft: "auto", color: "#999" }}>Off</span></div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "blasts" && (
            <div style={{ display: "grid", gap: 32 }}>
              {/* Header Input */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", background: "#fff", borderRadius: 20, border: "1px solid #f1f1f1" }}>
                 <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f5f5f5", overflow: "hidden" }}>
                   {user?.profile_image ? <img src={user.profile_image} alt="" style={{ width: "100%", height: "100%" }} /> : <User size={20} style={{ transform: "translate(6px, 6px)" }} />}
                 </div>
                 <span style={{ color: "#bbb", fontWeight: 600 }}>Send a blast to your guests...</span>
              </div>

              {/* Illustration Box */}
              <div style={{ padding: "48px 32px", borderRadius: 24, background: "#fff", border: "1px dashed #ddd", display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "center" }}>
                 <div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 10px" }}>Send Blasts</h3>
                    <p style={{ color: "#666", fontSize: "1rem", lineHeight: 1.5, maxWidth: 360, margin: 0 }}>Share updates with your guests via email, SMS, and push notifications.</p>
                 </div>
                 <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: 140, height: 140 }}>
                    <div style={{ position: "absolute", width: 140, height: 140, borderRadius: "50%", border: "1px dashed #eee" }} />
                    <div style={{ position: "absolute", width: 100, height: 100, borderRadius: "50%", border: "1px dashed #eee" }} />
                    <div style={{ ...blastIcon, background: "#fff", color: "#0066FF", top: 10, right: 10 }}><Mail size={20} /></div>
                    <div style={{ ...blastIcon, background: "#fff", color: "#16a34a", top: 10, left: 10 }}><Smartphone size={20} /></div>
                    <div style={{ ...blastIcon, background: "#fff", color: "#9333ea", bottom: 20, right: 20 }}><Zap size={20} /></div>
                    <div style={{ padding: 12, borderRadius: "50%", background: "#f9f9f9", color: "#666" }}><Megaphone size={28} /></div>
                 </div>
              </div>

              {/* System Messages */}
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 24px" }}>System Messages</h3>
                <div style={{ display: "grid", gap: 12 }}>
                   <div style={systemMsgRow}>
                      <div style={{ ...iconCircleSmall, background: "#f9f9f9", color: "#bbb" }}><Calendar size={16} /></div>
                      <div style={{ flex: 1 }}>
                         <div style={{ fontWeight: 700, fontSize: "1.02rem" }}>Event Reminders</div>
                         <div style={{ fontSize: "0.85rem", color: "#999" }}>Reminders are sent automatically via email, SMS, and push notification.</div>
                      </div>
                      <button style={tinyBtn}>Manage</button>
                   </div>
                   <div style={systemMsgRow}>
                      <div style={{ ...iconCircleSmall, background: "#f9f9f9", color: "#bbb" }}><Star size={16} /></div>
                      <div style={{ flex: 1 }}>
                         <div style={{ fontWeight: 700, fontSize: "1.02rem" }}>Post-Event Feedback</div>
                         <div style={{ fontSize: "0.85rem", color: "#999" }}>Schedule a feedback email to go out after the event.</div>
                      </div>
                      <button style={tinyBtn}>Schedule</button>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "insights" && (
            <div style={{ display: "grid", gap: 32 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h3 style={{ fontSize: "1.45rem", fontWeight: 800, margin: 0 }}>Page Views</h3>
                  <button style={tinyBtn}><Clock3 size={16} /> Past 7 Days <ChevronRight size={14} style={{ transform: "rotate(90deg)" }} /></button>
                </div>
                <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: 24 }}>See recent page views of the event page.</p>
                
                {/* Visual Chart Placeholder */}
                <div style={{ padding: 40, background: "#fff", borderRadius: 24, border: "1px solid #f1f1f1", position: "relative", minHeight: 300, display: "flex", alignItems: "flex-end", gap: 12 }}>
                   {[0.2, 0.1, 0.4, 0.3, 0.5, 0.8, 0.4, 0.1, 0.9].map((h, i) => (
                     <div key={i} style={{ flex: 1, height: `${h * 200}px`, background: i === 8 ? "#ec4899" : "#eee", borderRadius: 4 }} />
                   ))}
                   <div style={{ position: "absolute", inset: 0, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#eee", pointerEvents: "none" }}>
                      <div style={{ borderTop: "1px solid #f9f9f9", width: "100%" }} />
                      <div style={{ borderTop: "1px solid #f9f9f9", width: "100%" }} />
                      <div style={{ borderTop: "1px solid #f9f9f9", width: "100%" }} />
                   </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                <div>
                   <h4 style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 20 }}>Page Views</h4>
                   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <div><div style={{ fontSize: "0.85rem", color: "#666", fontWeight: 700 }}>24 hours</div><div style={{ fontSize: "1.5rem", fontWeight: 800 }}>2</div></div>
                      <div><div style={{ fontSize: "0.85rem", color: "#666", fontWeight: 700 }}>7 days</div><div style={{ fontSize: "1.5rem", fontWeight: 800 }}>2</div></div>
                      <div><div style={{ fontSize: "0.85rem", color: "#666", fontWeight: 700 }}>30 days</div><div style={{ fontSize: "1.5rem", fontWeight: 800 }}>2</div></div>
                   </div>

                   <h4 style={{ fontWeight: 800, fontSize: "1.1rem", marginTop: 40, marginBottom: 20 }}>Live Traffic</h4>
                   <div style={{ display: "grid", gap: 12 }}>
                      <div style={trafficRow}>
                        <Monitor size={16} color="#bbb" />
                        <div style={{ flex: 1 }}>
                           <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Visitor from Luma</div>
                           <div style={{ fontSize: "0.8rem", color: "#999" }}>Tiruppur, Tamil Nadu • Embed</div>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "#999" }}>1h</span>
                      </div>
                   </div>
                </div>

                <div>
                   <div style={{ display: "grid", gap: 32 }}>
                      <section>
                         <h4 style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 16 }}>Sources</h4>
                         <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", padding: "8px 0", borderBottom: "1px solid #f5f5f5" }}>
                            <span style={{ color: "#666" }}>Luma</span>
                            <span style={{ fontWeight: 700 }}>100%</span>
                         </div>
                      </section>
                      <section>
                         <h4 style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 16 }}>Cities</h4>
                         <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", padding: "8px 0", borderBottom: "1px solid #f5f5f5" }}>
                            <span style={{ color: "#666" }}>Tiruppur, IN</span>
                            <span style={{ fontWeight: 700 }}>100%</span>
                         </div>
                      </section>
                      <section>
                         <h4 style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: 16 }}>UTM Sources</h4>
                         <p style={{ fontSize: "0.9rem", color: "#999", lineHeight: 1.5, margin: 0 }}>Set up a tracking link by adding ?utm_source=your-link-name to your URL.</p>
                      </section>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "more" && (
            <div style={{ display: "grid", gap: 48, maxWidth: 680 }}>
              {/* Clone Event */}
              <section>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 12px" }}>Clone Event</h3>
                <p style={{ color: "#666", fontSize: "1.05rem", lineHeight: 1.5, marginBottom: 28 }}>Create a new event with the same information as this one. Everything except the guest list and event blasts will be copied over.</p>
                <button style={{ ...actionPrimary, background: "#333", borderRadius: 12, padding: "12px 20px" }}>
                  <RotateCcw size={18} /> Clone Event
                </button>
              </section>

              {/* Event Page URL */}
              <section>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 12px" }}>Event Page</h3>
                <p style={{ color: "#666", fontSize: "1.05rem", lineHeight: 1.5, marginBottom: 28 }}>When you choose a new URL, the current one will no longer work. Do not change your URL if you have already shared the event.</p>
                
                <div style={{ padding: "14px 20px", background: "#f5f5f5", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, fontSize: "0.9rem", color: "#666" }}>
                   <span>Upgrade to Luma Plus to set a custom URL for this event.</span>
                   <span style={{ fontWeight: 700, cursor: "pointer" }}>Learn More</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                   <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#999" }}>Public URL</div>
                   <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "12px 16px", background: "#f9f9f9", borderRadius: 12, border: "1px solid #eee", fontSize: "1.05rem" }}>
                         <span style={{ color: "#bbb", marginRight: 8 }}>lu.ma/</span>
                         <span style={{ fontWeight: 600 }}>{event.slug}</span>
                      </div>
                      <button style={{ ...actionPrimary, background: "#999", borderRadius: 12, cursor: "not-allowed" }}>Update</button>
                   </div>
                </div>
              </section>

              {/* Embed Event */}
              <section>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 12px" }}>Embed Event</h3>
                <p style={{ color: "#666", fontSize: "1.05rem", lineHeight: 1.5, marginBottom: 28 }}>Have your own site? Embed the event to let visitors know about it.</p>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
                   <div style={embedCardActive}>
                      <div style={{ ...iconCircleSmall, background: "rgba(236, 72, 153, 0.1)", color: "#ec4899" }}><Layout size={16} /></div>
                      <span style={{ fontWeight: 700 }}>Embed as Button</span>
                      <Users size={16} style={{ marginLeft: "auto", color: "#ec4899" }} />
                   </div>
                   <div style={embedCard}>
                      <div style={{ ...iconCircleSmall, background: "rgba(236, 72, 153, 0.1)", color: "#ec4899" }}><Monitor size={16} /></div>
                      <span style={{ fontWeight: 700 }}>Embed Event Page</span>
                   </div>
                </div>

                <div style={{ fontSize: "0.95rem", color: "#666", marginBottom: 16 }}>Paste the following HTML code snippet to your page:</div>
                <div style={{ position: "relative", padding: 24, background: "#fdfdfd", border: "1px solid #eee", borderRadius: 12, overflow: "hidden", marginBottom: 32 }}>
                   <div onClick={() => copyText(`<script src="${shareUrl}"></script>`)} style={{ position: "absolute", top: 12, right: 12, padding: "6px 12px", background: "#f5f5f5", borderRadius: 8, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      <Copy size={14} /> Copy
                   </div>
                   <pre style={{ margin: 0, fontSize: "0.85rem", color: "#9333ea", lineHeight: 1.6 }}>
{`<a
  href="${shareUrl}"
  class="luma-checkout--button"
  data-luma-action="checkout"
  data-luma-event-id="${event.id}"
>
  Register for Event
</a>

<script id="luma-checkout" src="https://embed.lu.ma/checkout-button.js"></script>`}
                   </pre>
                </div>

                <div style={{ fontSize: "0.95rem", color: "#666", marginBottom: 16 }}>This gives you the following button. Click it to see it in action!</div>
                <div style={{ padding: "40px", background: "#fff", border: "1px solid #eee", borderRadius: 20, display: "flex", justifyContent: "center", marginBottom: 32 }}>
                   <button style={{ padding: "14px 28px", background: "#000", color: "white", borderRadius: 99, fontWeight: 900, border: "none" }}>Register for Event</button>
                </div>

                <p style={{ fontSize: "0.9rem", color: "#666", lineHeight: 1.5 }}>
                   If you want to use your own styling for the button, simply remove the <code style={{ color: "#333", fontWeight: 600 }}>luma-checkout--button</code> class from the snippet above.
                   <br /><br />
                   For advanced usage, check out our <span style={{ color: "#ec4899", fontWeight: 700 }}>example code and documentation.</span>
                </p>
              </section>

              {/* Cancel Event */}
              <section style={{ borderTop: "1px solid #eee", paddingTop: 48 }}>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 12px" }}>Cancel Event</h3>
                <p style={{ color: "#666", fontSize: "1.05rem", lineHeight: 1.5, marginBottom: 28 }}>Cancel and permanently delete this event. This operation cannot be undone. If there are any registered guests, we will notify them that the event has been canceled.</p>
                <button style={{ ...actionPrimary, background: "#ef4444", borderRadius: 12, opacity: 0.9 }}>
                  <Trash2 size={18} /> Cancel Event
                </button>
              </section>
            </div>
          )}
        </section>
      </div>

      {inviteOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", display: "grid", placeItems: "center", zIndex: 1000 }}>
          <div style={{ width: "min(92vw, 840px)", height: "min(90vh, 600px)", background: "#fff", borderRadius: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.15)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
             <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>Invite Guests</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                   <div style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid #eee", fontSize: "0.8rem", fontWeight: 700, color: "#999", display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", border: "2px solid #ddd" }} /> 15 LEFT
                   </div>
                   <button onClick={() => setInviteOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#666" }}><X size={20} /></button>
                </div>
             </div>
             <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
                {/* Sidebar */}
                <div style={{ width: 260, borderRight: "1px solid #f0f0f0", background: "#fdfdfd", padding: "20px 12px" }}>
                   <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ ...inviteSidebarItem, background: "#f5f5f5", color: "#000" }}><Sparkles size={16} /> Suggestions</div>
                      <div style={inviteSidebarItem}><AtSign size={16} /> Enter Emails</div>
                   </div>
                   <div style={{ marginTop: 32, padding: "0 12px", fontSize: "0.75rem", fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.05em" }}>Calendar Contacts</div>
                   <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
                      <div style={inviteSidebarItem}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#bbb" }} /> Everyone <span style={{ marginLeft: "auto", color: "#bbb" }}>0</span></div>
                   </div>
                   <div style={{ marginTop: 32, padding: "0 12px", fontSize: "0.75rem", fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.05em" }}>Events</div>
                   <div style={{ marginTop: 12, padding: "0 12px", fontSize: "0.85rem", color: "#bbb", display: "flex", alignItems: "center", gap: 8 }}>
                      <Clock3 size={14} /> This is your first event.
                   </div>
                </div>
                {/* Main Content */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, textAlign: "center" }}>
                   <div style={{ position: "relative", width: 200, height: 160, marginBottom: 40 }}>
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                         <div style={{ width: 80, height: 80, background: "#fff", border: "1px solid #eee", borderRadius: 20, boxShadow: "0 12px 24px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ddd" }}>
                            <Sparkles size={40} />
                         </div>
                      </div>
                      <div style={{ ...inviteCircle, background: "#dcfce7", top: 10, left: 10 }}><Users size={16} color="#16a34a" /></div>
                      <div style={{ ...inviteCircle, background: "#ffedd5", top: -20, left: 90 }}><Users size={16} color="#f97316" /></div>
                      <div style={{ ...inviteCircle, background: "#f3e8ff", top: 20, right: 10 }}><Users size={16} color="#9333ea" /></div>
                   </div>
                   <h3 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 12px" }}>Start Inviting Guests</h3>
                   <p style={{ color: "#999", fontSize: "1rem", lineHeight: 1.5, maxWidth: 320, margin: "0 0 32px" }}>After you host an event, you'll find past guests here.</p>
                   <button style={{ ...actionPrimary, background: "#333", padding: "14px 40px", borderRadius: 12, marginBottom: 16 }}><Mail size={18} /> Enter Emails</button>
                   <div style={{ fontSize: "0.85rem", color: "#ccc", margin: "10px 0" }}>or</div>
                   <button style={{ ...actionPrimary, background: "#4285f4", padding: "14px 40px", borderRadius: 12 }}><Zap size={18} /> Import from Google</button>
                </div>
             </div>
             <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f0f0", display: "flex", justifyContent: "flex-end" }}>
                <button style={{ ...actionPrimary, background: "#bbb", borderRadius: 10, padding: "10px 24px" }}>Next <ChevronRight size={18} /></button>
             </div>
          </div>
        </div>
      )}

      {isCheckInOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", display: "grid", placeItems: "center", zIndex: 1100 }}>
          <div style={{ width: 360, background: "#fff", borderRadius: 24, padding: 32, textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.15)", position: "relative" }}>
             <button onClick={() => setIsCheckInOpen(false)} style={{ position: "absolute", top: 16, right: 16, border: "none", background: "transparent", cursor: "pointer", color: "#bbb" }}><X size={20} /></button>
             <div style={{ ...iconCircle, background: "#f5f5f5", color: "#333", width: 64, height: 64, margin: "0 auto 24px" }}><QrCode size={32} /></div>
             <h3 style={{ fontSize: "1.45rem", fontWeight: 800, marginBottom: 16 }}>Check In Guests</h3>
             <p style={{ color: "#666", fontSize: "1rem", lineHeight: 1.5, marginBottom: 32 }}>You can check in guests with our web scanner, or with our iOS and Android apps.</p>
             <div style={{ display: "grid", gap: 12 }}>
                <button onClick={() => router.push(`/check-in/${event.slug}`)} style={{ ...actionPrimary, background: "#333", width: "100%", justifyContent: "center", borderRadius: 12 }}>Open Web Scanner</button>
                <button style={{ ...actionPrimary, background: "#f5f5f5", color: "#333", width: "100%", justifyContent: "center", borderRadius: 12 }}><Apple size={18} /> Download for iOS</button>
                <button style={{ ...actionPrimary, background: "#f5f5f5", color: "#333", width: "100%", justifyContent: "center", borderRadius: 12 }}><Play size={18} /> Download for Android</button>
             </div>
          </div>
        </div>
      )}

      {isGuestListOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", display: "grid", placeItems: "center", zIndex: 1100 }}>
          <div style={{ width: 360, background: "#fff", borderRadius: 24, padding: 32, textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.15)", position: "relative" }}>
             <button onClick={() => setIsGuestListOpen(false)} style={{ position: "absolute", top: 16, right: 16, border: "none", background: "transparent", cursor: "pointer", color: "#bbb" }}><X size={20} /></button>
             <div style={{ ...iconCircle, background: "#f5f5f5", color: "#333", width: 64, height: 64, margin: "0 auto 24px" }}><Users size={32} /></div>
             <h3 style={{ fontSize: "1.45rem", fontWeight: 800, marginBottom: 16 }}>Public Guest List</h3>
             <p style={{ color: "#666", fontSize: "1rem", lineHeight: 1.5, marginBottom: 32 }}>Show guest count and a few guests on the event page, and let registered guests see the full guest list.</p>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#f9f9f9", borderRadius: 16, marginBottom: 32 }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Show Public Guest List</span>
                <div style={{ width: 44, height: 24, borderRadius: 12, background: "#333", padding: 2, display: "flex", justifyContent: "flex-end", cursor: "pointer" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff" }} />
                </div>
             </div>
             <button onClick={() => setIsGuestListOpen(false)} style={{ ...actionPrimary, background: "#333", width: "100%", justifyContent: "center", borderRadius: 12 }}>Confirm</button>
          </div>
        </div>
      )}

      {editOpen && editForm && (
        <Modal title="Edit Event Details" subtitle="Update the event page, schedule, and ticket settings here." onClose={() => setEditOpen(false)}>
          <form onSubmit={saveEdit} style={{ display: "grid", gap: 14 }}>
            <input name="title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required style={inputStyle} placeholder="Event title" />
            <textarea name="description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={4} style={{ ...inputStyle, minHeight: 100, fontFamily: "inherit" }} placeholder="Description" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} required style={inputStyle} />
              <input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} required style={inputStyle} />
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={inputStyle}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            </div>
            <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} required style={inputStyle} placeholder="Venue address or online link" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <input type="number" min={0} value={editForm.max_seats} onChange={(e) => setEditForm({ ...editForm, max_seats: Number(e.target.value || 0) })} style={inputStyle} placeholder="Capacity" />
              <input type="number" min={0} step={0.5} value={editForm.ticket_price} onChange={(e) => setEditForm({ ...editForm, ticket_price: Number(e.target.value || 0) })} disabled={!editForm.is_paid} style={{ ...inputStyle, opacity: editForm.is_paid ? 1 : 0.6 }} placeholder="Ticket price" />
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "#334155", fontWeight: 700 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><input type="checkbox" checked={editForm.is_online} onChange={(e) => setEditForm({ ...editForm, is_online: e.target.checked })} /> Online event</label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><input type="checkbox" checked={editForm.is_paid} onChange={(e) => setEditForm({ ...editForm, is_paid: e.target.checked })} /> Paid tickets</label>
            </div>
            {/* Added Agenda for better functionality */}
            <div style={{ display: "grid", gap: 6 }}>
              <div style={label}>Agenda (one item per line)</div>
              <textarea 
                value={(event as any).agenda?.join("\n") || ""} 
                onChange={(e) => {
                  const agenda = e.target.value.split("\n").filter(Boolean);
                  setEvent({ ...event, agenda } as any);
                }} 
                rows={3} 
                style={{ ...inputStyle, minHeight: 80, fontFamily: "inherit" }} 
                placeholder="Welcome\nKeynote\nNetworking" 
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setEditOpen(false)} style={actionSecondary}>Cancel</button>
              <button type="submit" disabled={saving} style={actionPrimary}>{saving ? <Loader2 className="animate-spin" size={16} /> : <PencilLine size={16} />}{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </form>
        </Modal>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", background: "#fdfdfd", color: "#000", fontFamily: "inherit" }}>{children}</div>;
}

function TabBar({ activeTab, onChange }: { activeTab: (typeof tabs)[number]["key"]; onChange: (key: (typeof tabs)[number]["key"]) => void; }) {
  return (
    <div style={{ display: "flex", gap: 24, borderBottom: "1px solid #eee", marginBottom: 32 }}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{ 
              padding: "12px 2px", 
              border: "none", 
              background: "transparent", 
              color: active ? "#000" : "#666", 
              fontWeight: active ? 700 : 500, 
              fontSize: "1.05rem",
              cursor: "pointer", 
              borderBottom: active ? "2px solid #000" : "2px solid transparent",
              transition: "all 0.2s"
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", borderRadius: 20, padding: 24, border: "1px solid #f1f1f1", boxShadow: "0 4px 12px rgba(0,0,0,0.02)", ...style }}>{children}</div>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; }) {
  return <div style={{ position: "fixed", inset: 0, background: "rgba(17,39,45,0.42)", display: "grid", placeItems: "center", padding: 20, zIndex: 200 }}><div style={{ width: "min(92vw, 620px)", background: "linear-gradient(180deg, rgba(255,255,255,0.99), rgba(245,251,251,0.97))", borderRadius: 30, border: "1px solid var(--border-color)", boxShadow: "0 32px 70px rgba(17,39,45,0.18)" }}><div style={{ padding: "22px 24px 16px", borderBottom: "1px solid rgba(14,118,120,0.08)", display: "flex", justifyContent: "space-between", gap: 16 }}><div><div style={{ fontSize: "1.3rem", fontWeight: 800 }}>{title}</div><div style={{ color: "var(--text-secondary)", marginTop: 6 }}>{subtitle}</div></div><button onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}><X size={20} /></button></div><div style={{ padding: 24 }}>{children}</div></div></div>;
}

const metaChip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.9)", border: "1px solid var(--border-color)", fontWeight: 800 };
const pillBtn: React.CSSProperties = { padding: "12px 14px", borderRadius: 16, border: "1px solid var(--border-color)", background: "#fff", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 12px 24px rgba(17,39,45,0.04)" };
const panel: React.CSSProperties = { padding: "16px 18px", borderRadius: 20, background: "rgba(14,118,120,0.05)", border: "1px solid rgba(14,118,120,0.08)" };
const label: React.CSSProperties = { color: "var(--text-secondary)", fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--border-color)", background: "#fff", color: "#0f172a" };
const actionPrimary: React.CSSProperties = { padding: "12px 16px", borderRadius: 14, border: "none", background: "#000", color: "#fff", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 };
const actionSecondary: React.CSSProperties = { padding: "12px 16px", borderRadius: 14, border: "1px solid #eee", background: "#fff", color: "#000", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 };

const quickActionCard: React.CSSProperties = { display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", background: "#fff", borderRadius: 24, border: "1px solid #f1f1f1", boxShadow: "0 4px 12px rgba(0,0,0,0.02)", cursor: "pointer" };
const iconCircle: React.CSSProperties = { width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" };
const dateBadgeMini: React.CSSProperties = { width: 42, height: 42, borderRadius: 10, background: "#fdf2f2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #fee2e2" };
const dateBadgeLarge: React.CSSProperties = { width: 54, height: 54, borderRadius: 14, background: "#fff", border: "1px solid #eee", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.03)" };
const ghostBtn: React.CSSProperties = { flex: 1, padding: "12px", borderRadius: 12, background: "#f5f5f5", color: "#333", border: "none", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" };
const tinyBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 10, background: "#f5f5f5", color: "#333", border: "none", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };

const iconCircleSmall: React.CSSProperties = { width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" };
const quickActionCardSmall: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#fff", borderRadius: 16, border: "1px solid #f1f1f1", cursor: "pointer" };
const questionBox: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f9f9f9", borderRadius: 12, fontSize: "0.9rem", color: "#666", border: "1px solid #f0f0f0" };
const blastIcon: React.CSSProperties = { position: "absolute", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" };
const systemMsgRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 14, padding: "12px 0" };
const trafficRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 14, padding: "12px 0" };

const embedCard: React.CSSProperties = { padding: 16, background: "#fff", border: "1px solid #f1f1f1", borderRadius: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" };
const embedCardActive: React.CSSProperties = { ...embedCard, border: "1px solid #ec4899", background: "rgba(236, 72, 153, 0.02)" };

const inviteSidebarItem: React.CSSProperties = { padding: "8px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem", fontWeight: 600, color: "#666", cursor: "pointer" };
const inviteCircle: React.CSSProperties = { position: "absolute", width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "4px solid #fff", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" };
