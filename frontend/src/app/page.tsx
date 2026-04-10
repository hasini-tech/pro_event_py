'use client';

import { motion } from 'framer-motion';
import { CalendarDays, Clock3, Globe2, MapPin, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { DEFAULT_EVENT_COVER } from '@/lib/defaults';

type EventHighlight = {
  id: string;
  title: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  is_online?: boolean;
  cover_image?: string;
  confirmed_count?: number;
};

function HeroVisual({ event }: { event: EventHighlight | null }) {
  const eventDate = useMemo(() => {
    if (!event?.date) return null;
    const parsed = new Date(event.date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [event?.date]);

  const eventTitle = event?.title || 'Summer Launch Party';
  const coverImage = DEFAULT_EVENT_COVER;
  const dateLabel = eventDate
    ? eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Sun, Jul 23';
  const timeLabel = event?.time || '7:00 PM';
  const locationLabel = event?.is_online ? 'Online event' : event?.location || 'Oceanfront Venue';
  const guestLabel = event?.confirmed_count ? `${event.confirmed_count} guests` : '45 guests';

  return (
    <div
      style={{
        position: 'relative',
        width: 'min(620px, 100%)',
        aspectRatio: '1 / 1',
        marginInline: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '999px',
          background:
            'radial-gradient(circle at 50% 28%, rgba(14,118,120,0.3), rgba(14,118,120,0.14) 34%, rgba(255,255,255,0.94) 76%), linear-gradient(135deg, rgba(255,248,240,0.96), rgba(240,252,252,0.98))',
          boxShadow: '0 40px 80px rgba(17,39,45,0.08)',
          overflow: 'hidden',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '12% 17%',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '320px',
            borderRadius: '38px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 34px 60px rgba(17,39,45,0.16)',
            overflow: 'hidden',
            transform: 'rotate(-6deg)',
          }}
        >
          <div
            style={{
              padding: '14px 16px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: 'var(--text-secondary)',
              fontSize: '0.76rem',
              fontWeight: 700,
            }}
          >
            <span>9:41</span>
            <div
              style={{
                width: '92px',
                height: '22px',
                borderRadius: '999px',
                background: '#101820',
              }}
            />
            <span>5G</span>
          </div>

          <div style={{ padding: '0 14px 14px' }}>
            <div
              style={{
                borderRadius: '28px',
                overflow: 'hidden',
                background: 'rgba(14,118,120,0.08)',
                border: '1px solid var(--border-color)',
              }}
            >
              <img
                src={coverImage}
                alt={eventTitle}
                style={{ width: '100%', height: '220px', objectFit: 'cover' }}
              />
            </div>

            <div style={{ padding: '18px 6px 6px', display: 'grid', gap: '12px' }}>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.4rem',
                    lineHeight: 1.05,
                    letterSpacing: '-0.04em',
                    color: 'var(--text-primary)',
                  }}
                >
                  {eventTitle}
                </h3>
                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Hosted with Evently
                </p>
              </div>

              <div style={{ display: 'grid', gap: '9px', color: 'var(--text-secondary)' }}>
                <div style={detailRow}>
                  <CalendarDays size={15} color="var(--primary-color)" />
                  <span>{dateLabel}</span>
                </div>
                <div style={detailRow}>
                  <Clock3 size={15} color="var(--primary-color)" />
                  <span>{timeLabel}</span>
                </div>
                <div style={detailRow}>
                  {event?.is_online ? (
                    <Globe2 size={15} color="var(--primary-color)" />
                  ) : (
                    <MapPin size={15} color="var(--primary-color)" />
                  )}
                  <span>{locationLabel}</span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '18px',
                  background: 'rgba(14,118,120,0.06)',
                  border: '1px solid rgba(14,118,120,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {['#0e7678', '#33b0b1', '#a9dedd'].map((color, index) => (
                      <div
                        key={index}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: color,
                          border: '2px solid white',
                          marginLeft: index === 0 ? 0 : -8,
                        }}
                      />
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {guestLabel}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>Already interested</div>
                  </div>
                </div>

                <button
                  type="button"
                  style={{
                    border: 'none',
                    borderRadius: '14px',
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, var(--primary-color), var(--teal-800))',
                    color: '#fff',
                    fontWeight: 800,
                    boxShadow: '0 14px 26px rgba(14,118,120,0.22)',
                    cursor: 'pointer',
                  }}
                >
                  Register
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: '3%',
          bottom: '10%',
          width: '110px',
          height: '62px',
          borderRadius: '999px',
          border: '8px solid rgba(14,118,120,0.16)',
          boxShadow: '0 20px 36px rgba(17,39,45,0.1)',
          transform: 'rotate(-22deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '8%',
          bottom: '8%',
          width: '134px',
          height: '76px',
          borderRadius: '999px',
          border: '10px solid rgba(14,118,120,0.12)',
          boxShadow: '0 20px 36px rgba(17,39,45,0.08)',
          transform: 'rotate(21deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '6%',
          top: '26%',
          padding: '14px 16px',
          borderRadius: '24px',
          background: 'rgba(255,255,255,0.94)',
          border: '1px solid rgba(255,255,255,0.8)',
          boxShadow: '0 18px 36px rgba(17,39,45,0.1)',
          transform: 'rotate(8deg)',
        }}
      >
        <div style={{ color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 800 }}>EVENT</div>
        <div style={{ fontSize: '2rem', lineHeight: 1, fontWeight: 800, color: 'var(--text-primary)' }}>
          23
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: '10%',
          top: '18%',
          width: '20px',
          height: '20px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.8)',
          boxShadow: '0 0 0 10px rgba(255,255,255,0.18)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '26%',
          top: '18%',
          color: 'var(--primary-color)',
          transform: 'rotate(18deg)',
        }}
      >
        <Sparkles size={44} strokeWidth={1.6} />
      </div>
    </div>
  );
}

export default function Landing() {
  const router = useRouter();
  const [highlight, setHighlight] = useState<EventHighlight | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    document.body.classList.add('hide-nav');
    return () => document.body.classList.remove('hide-nav');
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const response = await api.get('/events');
        if (!mounted) return;
        const firstEvent = Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : null;
        setHighlight(firstEvent);
      } catch {
        if (mounted) {
          setHighlight(null);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const formattedTime = useMemo(
    () =>
      now.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      }),
    [now],
  );

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 10% 14%, rgba(104, 180, 204, 0.14), transparent 24%), radial-gradient(circle at 32% 18%, rgba(255, 218, 180, 0.16), transparent 26%), radial-gradient(circle at 84% 10%, rgba(14,118,120,0.08), transparent 22%), linear-gradient(180deg, #fffdfb 0%, #ffffff 46%, #f5fbfb 100%)',
      }}
    >
      <section className="page-shell" style={{ paddingTop: '28px', paddingBottom: '80px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '18px',
            alignItems: 'center',
            color: 'var(--text-tertiary)',
            fontSize: '0.92rem',
            fontWeight: 600,
            marginBottom: '26px',
            flexWrap: 'wrap',
          }}
        >
          <span>{formattedTime}</span>
          <button type="button" onClick={() => router.push('/events')} style={topLinkButton}>
            Explore Events
          </button>
          <button type="button" onClick={() => router.push('/login')} style={topLinkButton}>
            Sign in
          </button>
        </div>

        <div
          className="home-hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 0.9fr) minmax(340px, 1.1fr)',
            gap: '28px',
            alignItems: 'center',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            style={{
              display: 'grid',
              gap: '24px',
              maxWidth: '480px',
            }}
          >
            <div style={{ display: 'grid', gap: '14px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'rgba(17,39,45,0.34)',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                }}
              >
                <span style={{ fontSize: '2.9rem', lineHeight: 0.8 }}>evently</span>
                <Sparkles size={18} strokeWidth={1.8} />
              </div>

              <h1
                style={{
                  fontSize: 'clamp(3.2rem, 7vw, 6rem)',
                  lineHeight: 0.95,
                  letterSpacing: '-0.06em',
                  color: 'var(--text-primary)',
                  fontWeight: 400,
                }}
              >
                Delightful
                <br />
                events
                <br />
                <span
                  style={{
                    background: 'linear-gradient(90deg, var(--primary-color) 0%, #3dbfc0 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  start here.
                </span>
              </h1>

              <p
                style={{
                  color: 'rgba(17,39,45,0.66)',
                  fontSize: '1.08rem',
                  lineHeight: 1.6,
                  maxWidth: '430px',
                }}
              >
                Set up an event page, invite attendees, and manage registrations in one clean
                experience tailored to your brand.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => router.push('/create-event/continue?redirect=/create-event/form')}
                style={primaryCta}
              >
                Create Your First Event
              </button>
              <button type="button" onClick={() => router.push('/login?redirect=/events')} style={ghostCta}>
                Browse Events
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          >
            <HeroVisual event={highlight} />
          </motion.div>
        </div>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 940px) {
              .home-hero-grid {
                grid-template-columns: minmax(0, 1fr) !important;
              }
            }
          `,
        }}
      />
    </main>
  );
}

const detailRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '0.88rem',
  fontWeight: 600,
};

const topLinkButton: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text-tertiary)',
  fontWeight: 600,
  cursor: 'pointer',
};

const primaryCta: React.CSSProperties = {
  border: 'none',
  borderRadius: '14px',
  padding: '16px 22px',
  background: 'linear-gradient(135deg, var(--primary-color), var(--teal-800))',
  color: '#fff',
  fontSize: '1rem',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 18px 34px rgba(14,118,120,0.18)',
};

const ghostCta: React.CSSProperties = {
  border: '1px solid var(--border-color)',
  borderRadius: '14px',
  padding: '16px 22px',
  background: 'rgba(255,255,255,0.82)',
  color: 'var(--text-primary)',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 10px 26px rgba(17,39,45,0.04)',
};
