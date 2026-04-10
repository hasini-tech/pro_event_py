"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Check,
  ChevronDown,
  ClipboardCopy,
  FileText,
  Globe2,
  Loader2,
  MapPin,
  PencilLine,
  Shuffle,
  Ticket,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { DEFAULT_EVENT_COVER } from "@/lib/defaults";
import {
  getPersonalTimelineCacheKey,
  mergeUniqueTimelineItems,
  readPersonalTimelineCacheItems,
  readStoredTimelineIdentity,
  writePersonalTimelineCacheItems,
} from "@/lib/personalTimelineCache";
import styles from "@/app/create-event/page.module.css";

type EventStatus = "published" | "private" | "draft";

type OwnerCalendar = {
  id: string;
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

type CreateEventForm = {
  title: string;
  description: string;
  date: string;
  time: string;
  end_time: string;
  location: string;
  is_online: boolean;
  is_paid: boolean;
  ticket_price: number;
  max_seats: number;
  status: EventStatus;
  community_enabled: boolean;
  require_approval: boolean;
  agenda: string;
};

const initialFormState: CreateEventForm = {
  title: "",
  description: "",
  date: "",
  time: "",
  end_time: "",
  location: "",
  is_online: false,
  is_paid: false,
  ticket_price: 0,
  max_seats: 0,
  status: "published",
  community_enabled: true,
  require_approval: false,
  agenda: "",
};

const THEMES = ["Minimal", "Vivid", "Dark", "Neon", "Pastel"];

function getAuthToken() {
  if (typeof window === "undefined") return null;
  const localToken = localStorage.getItem("evently_token");
  if (localToken) return localToken;
  const cookieToken = document.cookie
    .split("; ")
    .find((e) => e.startsWith("evently_token="))
    ?.split("=")[1];
  return cookieToken || null;
}

function getCreateEventContinueHref(redirectPath: string) {
  return `/create-event/continue?${new URLSearchParams({ redirect: redirectPath }).toString()}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/** Simple toggle switch */
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className={styles.toggle} onClick={onChange}>
      <input type="checkbox" checked={checked} readOnly />
      <span className={styles.toggleTrack} />
      <span className={styles.toggleThumb} />
    </label>
  );
}

export default function CreateEventBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [formData, setFormData] = useState<CreateEventForm>(initialFormState);
  const [ownerCalendars, setOwnerCalendars] = useState<OwnerCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const [calendarLoadError, setCalendarLoadError] = useState("");

  // image state
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState("");
  const [previewHasError, setPreviewHasError] = useState(false);
  const [copied, setCopied] = useState(false);

  // theme cycling
  const [themeIdx, setThemeIdx] = useState(0);

  // Popover state
  const [activePopover, setActivePopover] = useState<"calendar" | "status" | "timezone" | "location" | null>(null);
  const requestedCalendarId = searchParams?.get("calendar");

  useEffect(() => {
    document.body.classList.add("hide-nav");
    return () => document.body.classList.remove("hide-nav");
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const token = getAuthToken();
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("evently_user") : null;
    if ((!token || !storedUser) && !user) {
      router.replace(getCreateEventContinueHref("/create-event/form"));
      return;
    }
    setAuthChecked(true);
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!authChecked || !user) return;

    let isActive = true;

    const fetchCalendars = async () => {
      setCalendarsLoading(true);
      try {
        const response = await api.get("/events/calendars");
        if (!isActive) return;
        const calendars = Array.isArray(response.data) ? response.data : [];
        setOwnerCalendars(calendars);
        setCalendarLoadError("");
        setSelectedCalendarId((current) => {
          const requested = requestedCalendarId
            ? calendars.find((calendar: OwnerCalendar) => calendar.id === requestedCalendarId)
            : null;
          if (requested) return requested.id;
          if (current && calendars.some((calendar: OwnerCalendar) => calendar.id === current)) {
            return current;
          }
          const fallback = calendars.find((calendar: OwnerCalendar) => calendar.is_default) || calendars[0];
          return fallback?.id || "";
        });
      } catch (err: any) {
        if (!isActive) return;
        setCalendarLoadError(err?.response?.data?.detail || "Could not load owner calendars.");
      } finally {
        if (isActive) {
          setCalendarsLoading(false);
        }
      }
    };

    fetchCalendars();

    return () => {
      isActive = false;
    };
  }, [authChecked, requestedCalendarId, user]);

  const updateField = <K extends keyof CreateEventForm>(field: K, value: CreateEventForm[K]) => {
    setFormData((cur) => ({ ...cur, [field]: value }));
  };

  const resolvedCoverImage = uploadedImage || imageUrlInput.trim() || DEFAULT_EVENT_COVER;

  useEffect(() => {
    setPreviewHasError(false);
  }, [resolvedCoverImage]);

  /* ── image handlers ── */
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please upload a valid image file."); e.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be smaller than 5 MB."); e.target.value = ""; return; }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setUploadedImage(dataUrl);
      setUploadedImageName(file.name);
      setError("");
    } catch {
      setError("That image could not be loaded. Try another file.");
      e.target.value = "";
    }
  };

  const clearUploadedImage = () => {
    setUploadedImage(null);
    setUploadedImageName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCopyUrl = async () => {
    const url = imageUrlInput.trim() || resolvedCoverImage;
    if (!url || url === DEFAULT_EVENT_COVER) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* ignore */}
  };

  /* ── submit ── */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = getAuthToken();
      if (!token) { setLoading(false); router.push(getCreateEventContinueHref("/create-event/form")); return; }

      const agendaItems = formData.agenda.split("\n").map((s) => s.trim()).filter(Boolean);

      const submitData = {
        ...formData,
        calendar_id: selectedCalendar?.id || undefined,
        host_id: user?.id || "",
        host_name: user?.name || "Event Host",
        host_bio: user?.bio || "",
        host_image: user?.profile_image || "",
        cover_image: resolvedCoverImage,
        ticket_price: formData.is_paid ? formData.ticket_price : 0,
        max_seats: Math.max(0, formData.max_seats),
        date: new Date(`${formData.date}T${formData.time || "00:00"}`).toISOString(),
        speakers: [],
        agenda: agendaItems,
        integrations: [],
      };

      const response = await api.post("/events/", submitData);
      const identity = user ?? readStoredTimelineIdentity();
      const personalCacheKey = getPersonalTimelineCacheKey(identity);
      const cachedPersonalEvents = readPersonalTimelineCacheItems<Record<string, unknown>>(personalCacheKey);
      writePersonalTimelineCacheItems(
        personalCacheKey,
        mergeUniqueTimelineItems(
          [{ ...response.data, relationship: "hosting" }],
          cachedPersonalEvents.filter(
            (event): event is Record<string, unknown> & { id?: unknown } =>
              Boolean(event) && typeof event === "object"
          )
        )
      );
      sessionStorage.setItem("latest_created_event", JSON.stringify(response.data));
      router.push(`/manage/${response.data.slug}`);
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setLoading(false);
        router.push(getCreateEventContinueHref("/create-event/form"));
        return;
      }
      const detail = err?.response?.data?.detail || err?.message || "Failed to create event";
      if (typeof detail === "string" && detail.includes("Event service is unavailable")) {
        setError("Event service is not running. From the project root, run powershell -ExecutionPolicy Bypass -File .\\backend\\start_services.ps1, wait a few seconds, then try creating the event again.");
      } else {
        setError(detail);
      }
      setLoading(false);
    }
    setLoading(false);
  };

  if (authLoading || !authChecked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary-color)" />
      </div>
    );
  }

  const statusLabel =
    formData.status === "published" ? "Public" : formData.status === "private" ? "Private" : "Draft";
  const selectedCalendar =
    ownerCalendars.find((calendar) => calendar.id === selectedCalendarId) ||
    ownerCalendars.find((calendar) => calendar.is_default) ||
    ownerCalendars[0] ||
    null;

  return (
    <div className={styles.page}>
      <input
        ref={fileInputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
      />

      <form className={styles.builder} onSubmit={handleSubmit}>
        {/* ──────────────────────────────────────── LEFT: image ── */}
        <aside className={styles.sidebar}>
          <div className={styles.coverCard}>
            {/* Cover image */}
            <div className={styles.coverMedia}>
              <img
                className={styles.coverImage}
                src={previewHasError ? DEFAULT_EVENT_COVER : resolvedCoverImage}
                alt={formData.title || "Event cover"}
                onError={() => setPreviewHasError(true)}
              />
              {/* Overlay buttons */}
              <div className={styles.coverOverlay}>
                {uploadedImage && (
                  <button type="button" className={styles.coverIconBtn} onClick={clearUploadedImage} title="Remove image">
                    <X size={16} />
                  </button>
                )}
                <button type="button" className={styles.coverIconBtn} onClick={() => fileInputRef.current?.click()} title="Upload image">
                  <UploadCloud size={18} />
                </button>
              </div>
            </div>

            {/* Theme row */}
            <div className={styles.themeRow}>
              <div className={styles.themeCard} onClick={() => setThemeIdx((i) => (i + 1) % THEMES.length)}>
                <div className={styles.themeThumb} />
                <div>
                  <div className={styles.themeLabel}>Theme</div>
                  <div className={styles.themeName}>{THEMES[themeIdx]}</div>
                </div>
                <ChevronDown size={14} className={styles.themeChevron} />
              </div>
              <button type="button" className={styles.themeShuffleBtn} onClick={() => setThemeIdx((i) => (i + 1) % THEMES.length)} title="Shuffle theme">
                <Shuffle size={16} />
              </button>
            </div>

            {/* Image URL + copy */}
            <div className={styles.urlRow}>
              <input
                className={styles.urlInput}
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="Paste image URL..."
              />
              <button
                type="button"
                className={`${styles.urlCopyBtn} ${copied ? styles.copied : ""}`}
                onClick={handleCopyUrl}
                title={copied ? "Copied!" : "Copy image URL"}
              >
                {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
              </button>
            </div>

            {uploadedImageName && (
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 10, padding: "0 2px" }}>
                Attached: {uploadedImageName}
              </div>
            )}
          </div>
        </aside>

        {/* ──────────────────────────────────────── RIGHT: form ── */}
        <div className={styles.editor}>
          {error && <div className={styles.error}>{error}</div>}

          {/* Invisible overlay to close popovers */}
          {activePopover && (
            <div
              style={{ position: "fixed", inset: 0, zIndex: 40 }}
              onClick={() => setActivePopover(null)}
            />
          )}

          {/* Top bar */}
          <div className={styles.topBar}>
            {/* Calendar selector */}
            <div style={{ position: "relative", zIndex: activePopover === "calendar" ? 50 : 1 }}>
              <button
                type="button"
                className={styles.calendarPill}
                onClick={() => setActivePopover(activePopover === "calendar" ? null : "calendar")}
              >
                <Calendar size={16} />
                {selectedCalendar?.name || user?.name || "Personal Calendar"}
                <ChevronDown size={14} />
              </button>

              {activePopover === "calendar" && (
                <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 8, background: "#fff", borderRadius: 18, padding: "14px", width: 280, boxShadow: "0 20px 44px rgba(17,39,45,0.12)", border: "1px solid rgba(14,118,120,0.12)", zIndex: 50 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 10 }}>Choose the calendar for this event</div>
                  {calendarsLoading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "18px 0", color: "#6b7280" }}>
                      <Loader2 className="animate-spin" size={18} />
                    </div>
                  ) : ownerCalendars.length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {ownerCalendars.map((calendar) => {
                        const isSelected = calendar.id === selectedCalendar?.id;
                        return (
                          <button
                            key={calendar.id}
                            type="button"
                            onClick={() => {
                              setSelectedCalendarId(calendar.id);
                              setActivePopover(null);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              width: "100%",
                              padding: 10,
                              borderRadius: 12,
                              border: "none",
                              background: isSelected ? "rgba(14,118,120,0.08)" : "transparent",
                              cursor: "pointer",
                              fontWeight: 700,
                              fontSize: "0.9rem",
                              color: "var(--text-primary)",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: `linear-gradient(135deg, ${calendar.tint_color}, color-mix(in srgb, ${calendar.tint_color} 30%, white))` }} />
                            <div style={{ display: "grid", gap: 2 }}>
                              <span>{calendar.name}</span>
                              <span style={{ fontSize: "0.74rem", color: "#6b7280", fontWeight: 600 }}>
                                {calendar.location_scope === "city" ? calendar.city || "City calendar" : "Global calendar"}
                              </span>
                            </div>
                            {isSelected ? <Check size={16} style={{ marginLeft: "auto", color: "#111827" }} /> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: "4px 0 12px", fontSize: "0.85rem", color: "#6b7280" }}>
                      No owner calendars found yet.
                    </div>
                  )}
                  <div style={{ padding: "12px 4px 0", fontSize: "0.85rem", color: "var(--text-secondary)", borderTop: "1px solid rgba(14,118,120,0.08)", marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePopover(null);
                        router.push("/calendars/create?redirect=/create-event");
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontWeight: 700, cursor: "pointer", marginBottom: 6, border: "none", background: "transparent", padding: 0 }}
                    >
                      <span style={{ fontSize: "1.1rem" }}>+</span> Create Calendar
                    </button>
                    <div style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>Creating the event under a calendar grants its admins manage access.</div>
                    {calendarLoadError && (
                      <div style={{ fontSize: "0.72rem", lineHeight: 1.5, color: "#b45309", marginTop: 8 }}>
                        {calendarLoadError}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status selector */}
            <div style={{ position: "relative", zIndex: activePopover === "status" ? 50 : 1 }}>
              <button
                type="button"
                className={styles.statusPill}
                onClick={() => setActivePopover(activePopover === "status" ? null : "status")}
              >
                <Globe2 size={14} />
                {statusLabel}
                <ChevronDown size={14} />
              </button>

              {activePopover === "status" && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, background: "#fff", borderRadius: 18, padding: 8, width: 260, boxShadow: "0 20px 44px rgba(17,39,45,0.12)", border: "1px solid rgba(14,118,120,0.12)", zIndex: 50 }}>
                  
                  <div
                    style={{ padding: 12, borderRadius: 12, background: formData.status === "published" ? "rgba(14,118,120,0.08)" : "transparent", cursor: "pointer" }}
                    onClick={() => { updateField("status", "published"); setActivePopover(null); }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 600, fontSize: "0.9rem", color: "#111827" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Globe2 size={14} color="#0e7678" /> Public</div>
                      {formData.status === "published" && <Check size={14} color="#0e7678" />}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 4, paddingLeft: 20 }}>Shown on your calendar and eligible to be featured.</div>
                  </div>

                  <div
                    style={{ padding: 12, borderRadius: 12, background: formData.status === "private" ? "rgba(14,118,120,0.08)" : "transparent", cursor: "pointer", marginTop: 4 }}
                    onClick={() => { updateField("status", "private"); setActivePopover(null); }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 600, fontSize: "0.9rem", color: "#111827" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0e7678" }}>Private</div>
                      {formData.status === "private" && <Check size={14} color="#0e7678" />}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 4, paddingLeft: 20 }}>Unlisted. Only people with the link can register.</div>
                  </div>

                </div>
              )}
            </div>
          </div>

          {/* Event name */}
          <input
            className={styles.titleInput}
            value={formData.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Event Name"
            required
          />

          {/* Date / Time block */}
          <div className={styles.dateTimeBlock}>
            <div className={styles.dateTimeRows}>
              {/* Start row */}
              <div className={styles.dateTimeRow}>
                <span className={styles.dtLabel}>Start</span>
                <span className={`${styles.dtDot} ${styles.dtDotFilled}`} />
                <input
                  className={styles.dtDateInput}
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateField("date", e.target.value)}
                  required
                />
                <input
                  className={styles.dtTimeInput}
                  type="time"
                  value={formData.time}
                  onChange={(e) => updateField("time", e.target.value)}
                  required
                />
              </div>
              {/* End row */}
              <div className={styles.dateTimeRow}>
                <span className={styles.dtLabel}>End</span>
                <span className={styles.dtDot} />
                <input
                  className={styles.dtDateInput}
                  type="date"
                  value={formData.date}
                  readOnly
                  style={{ color: "#9ca3af" }}
                />
                <input
                  className={styles.dtTimeInput}
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => updateField("end_time", e.target.value)}
                  placeholder="17:00"
                />
              </div>
            </div>

            {/* Timezone box */}
            <div
              className={styles.timezoneBox}
              style={{ position: "relative", zIndex: activePopover === "timezone" ? 50 : 1, cursor: "pointer" }}
              onClick={() => setActivePopover(activePopover === "timezone" ? null : "timezone")}
            >
              <Globe2 size={16} className={styles.tzIcon} />
              <span className={styles.tzLabel}>GMT-05:00</span>
              <span className={styles.tzSub}>Chicago</span>

              {activePopover === "timezone" && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, background: "#fff", borderRadius: 18, padding: "10px 0", width: 280, boxShadow: "0 20px 44px rgba(17,39,45,0.12)", border: "1px solid rgba(14,118,120,0.12)", zIndex: 50, maxHeight: 300, overflowY: "auto", textAlign: "left", cursor: "default" }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ padding: "0 14px 8px", borderBottom: "1px solid rgba(14,118,120,0.08)" }}>
                    <input type="text" placeholder="Search for a timezone" style={{ width: "100%", border: "none", outline: "none", fontSize: "0.85rem", color: "#111827", background: "transparent" }} />
                  </div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#9ca3af", padding: "10px 14px 4px", textTransform: "none" }}>Popular timezones</div>
                  {[
                    { label: "Pacific Time - Los Angeles", val: "GMT-07:00" },
                    { label: "Central Time - Chicago", val: "GMT-05:00" },
                    { label: "Eastern Time - Toronto", val: "GMT-04:00" },
                    { label: "Eastern Time - New York", val: "GMT-04:00" },
                    { label: "United Kingdom Time - London", val: "GMT+01:00" },
                  ].map((tz, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", fontSize: "0.85rem", cursor: "pointer", transition: "background 0.1s" }} onClick={() => setActivePopover(null)} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(14,118,120,0.08)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <span style={{ color: "#111827" }}>{tz.label}</span>
                      <span style={{ color: "#9ca3af" }}>{tz.val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          <div style={{ position: "relative", zIndex: activePopover === "location" ? 50 : 1 }}>
            <div
              className={styles.locationRow}
              onClick={() => setActivePopover(activePopover === "location" ? null : "location")}
            >
              <MapPin size={18} className={styles.rowIcon} />
              <div style={{ flex: 1 }}>
                <div className={styles.locationPrimary}>
                  {formData.is_online ? "Online Event" : "Add Event Location"}
                </div>
                <div className={styles.locationSub}>
                  {formData.is_online ? "Virtual link | shared after RSVP" : "Offline location or virtual link"}
                </div>
                {activePopover === "location" ? (
                  <input
                    style={{ marginTop: 4, width: "100%", background: "transparent", border: "none", outline: "none", color: "#374151", fontSize: "0.9rem", padding: 0 }}
                    value={formData.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    placeholder={formData.is_online ? "https://meet.example.com/launch" : "Enter location or virtual link"}
                    autoFocus
                  />
                ) : (
                  formData.location && (
                    <div style={{ marginTop: 4, fontSize: "0.9rem", color: "#374151", fontWeight: 500 }}>{formData.location}</div>
                  )
                )}
              </div>
            </div>

            {activePopover === "location" && (
              <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, background: "#fff", borderRadius: 18, padding: "12px 0 6px", width: "100%", border: "1px solid rgba(14,118,120,0.12)", boxShadow: "0 20px 44px rgba(17,39,45,0.12)", zIndex: 50 }}>
                
                <div style={{ padding: "0 14px", fontSize: "0.75rem", fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>Recent locations</div>
                <div style={{ padding: "0 14px 10px", fontSize: "0.85rem", color: "#9ca3af" }}>No recently used locations.</div>

                <div style={{ borderTop: "1px solid rgba(14,118,120,0.08)", paddingTop: 10 }}>
                  <div style={{ padding: "0 14px", fontSize: "0.75rem", fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>Virtual options</div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", transition: "background 0.1s" }} onClick={() => { updateField("is_online", true); updateField("location", "Zoom Meeting Link"); setActivePopover(null); }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(14,118,120,0.08)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <Globe2 size={16} color="#6b7280" />
                    <span style={{ fontSize: "0.85rem", color: "#111827", fontWeight: 600 }}>Create Zoom meeting</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", transition: "background 0.1s" }} onClick={() => { updateField("is_online", true); updateField("location", "Google Meet Link"); setActivePopover(null); }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(14,118,120,0.08)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <Globe2 size={16} color="#6b7280" />
                    <span style={{ fontSize: "0.85rem", color: "#111827", fontWeight: 600 }}>Create Google Meet</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#9ca3af", padding: "8px 14px 4px" }}>
                    If you have a virtual event link, you can enter or paste it above.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className={styles.descRow}>
            <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 0 }}>
              <FileText size={16} className={styles.rowIcon} />
            </div>
            <textarea
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#374151", fontSize: "0.95rem", resize: "none", minHeight: 40, padding: 0, margin: 0 }}
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Add Description"
              required
              rows={2}
            />
          </div>

          {/* ── Event Options ── */}
          <div className={styles.optionsSection}>
            <div className={styles.optionsTitle}>Event Options</div>
            <div className={styles.optionsList}>

              {/* Ticket Price */}
              <div className={styles.optionRow}>
                <div className={styles.optionLeft}>
                  <Ticket size={17} />
                  Ticket Price
                </div>
                <div className={styles.optionRight}>
                  {formData.is_paid ? (
                    <input
                      className={styles.priceInput}
                      type="number"
                      min={0}
                      step="0.5"
                      value={formData.ticket_price || ""}
                      onChange={(e) => updateField("ticket_price", Number(e.target.value))}
                      placeholder="0"
                    />
                  ) : (
                    <span>Free</span>
                  )}
                  <button
                    type="button"
                    className={styles.optionEditBtn}
                    onClick={() => updateField("is_paid", !formData.is_paid)}
                    title={formData.is_paid ? "Switch to free" : "Set price"}
                  >
                    <PencilLine size={15} />
                  </button>
                </div>
              </div>

              {/* Require Approval */}
              <div className={styles.optionRow}>
                <div className={styles.optionLeft}>
                  <Users size={17} />
                  Require Approval
                </div>
                <div className={styles.optionRight}>
                  <Toggle
                    checked={formData.require_approval}
                    onChange={() => updateField("require_approval", !formData.require_approval)}
                  />
                </div>
              </div>

              {/* Capacity */}
              <div className={styles.optionRow}>
                <div className={styles.optionLeft}>
                  <Users size={17} />
                  Capacity
                </div>
                <div className={styles.optionRight}>
                  <input
                    className={styles.capacityInput}
                    type="number"
                    min={0}
                    value={formData.max_seats || ""}
                    onChange={(e) => updateField("max_seats", Number(e.target.value))}
                    placeholder="Unlimited"
                  />
                  <button
                    type="button"
                    className={styles.optionEditBtn}
                    title="Edit capacity"
                  >
                    <PencilLine size={15} />
                  </button>
                </div>
              </div>

              {/* Online event toggle */}
              <div className={styles.optionRow}>
                <div className={styles.optionLeft}>
                  <Globe2 size={17} />
                  Online Event
                </div>
                <div className={styles.optionRight}>
                  <Toggle
                    checked={formData.is_online}
                    onChange={() => updateField("is_online", !formData.is_online)}
                  />
                </div>
              </div>

              {/* Community */}
              <div className={styles.optionRow}>
                <div className={styles.optionLeft}>
                  <Users size={17} />
                  Attendee Community
                </div>
                <div className={styles.optionRight}>
                  <Toggle
                    checked={formData.community_enabled}
                    onChange={() => updateField("community_enabled", !formData.community_enabled)}
                  />
                </div>
              </div>

              {/* Agenda */}
              <div className={styles.optionRow} style={{ alignItems: "flex-start" }}>
                <div className={styles.optionLeft} style={{ paddingTop: 2 }}>
                  <FileText size={17} />
                  Agenda
                </div>
                <div style={{ flex: 1, textAlign: "right" }}>
                  <textarea
                    className={styles.agendaTextarea}
                    value={formData.agenda}
                    onChange={(e) => updateField("agenda", e.target.value)}
                    placeholder={"Welcome\nKeynote\nNetworking"}
                    rows={3}
                    style={{ textAlign: "left" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className={styles.submitBar}>
            <button className={styles.submitButton} type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : null}
              {loading ? "Creating..." : "Create Event"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
