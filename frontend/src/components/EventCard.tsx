'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';
import { DEFAULT_EVENT_COVER } from '@/lib/defaults';

interface EventProps {
  event: any;
}

export default function EventCard({ event }: EventProps) {
  const eventDate = new Date(event.date);
  const formattedDate = format(eventDate, 'MMM d, yyyy');

  return (
    <Link href={`/events/${event.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,251,251,0.96))',
          borderRadius: '28px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
          cursor: 'pointer',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 18px 36px rgba(17,39,45,0.06)',
        }}
        onMouseEnter={(eventTarget) => {
          eventTarget.currentTarget.style.transform = 'translateY(-4px)';
          eventTarget.currentTarget.style.boxShadow = '0 24px 44px rgba(17,39,45,0.1)';
          eventTarget.currentTarget.style.borderColor = 'var(--border-strong)';
        }}
        onMouseLeave={(eventTarget) => {
          eventTarget.currentTarget.style.transform = 'translateY(0)';
          eventTarget.currentTarget.style.boxShadow = '0 18px 36px rgba(17,39,45,0.06)';
          eventTarget.currentTarget.style.borderColor = 'var(--border-color)';
        }}
      >
        <div
          style={{
            width: '100%',
            height: '190px',
            backgroundColor: 'var(--teal-050)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <img
            src={event.cover_image || DEFAULT_EVENT_COVER}
            alt={event.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 35%, rgba(17,39,45,0.12) 100%)' }} />
          <div style={{ position: 'absolute', top: '14px', right: '14px' }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                padding: '7px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--primary-color)',
                border: '1px solid var(--border-color)',
              }}
            >
              {event.is_paid ? `Rs ${event.ticket_price}` : 'FREE'}
            </div>
          </div>
        </div>

        <div style={{ padding: '22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              alignSelf: 'flex-start',
              padding: '8px 12px',
              borderRadius: '999px',
              background: 'var(--primary-soft)',
              color: 'var(--primary-color)',
              fontWeight: 800,
              fontSize: '0.78rem',
              marginBottom: '14px',
            }}
          >
            {event.is_online ? 'Online event' : 'In-person event'}
          </div>

          <h3
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              marginBottom: '14px',
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {event.title}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
            <div style={metaRowStyle}>
              <Calendar size={15} strokeWidth={2} color="var(--primary-color)" />
              <span>
                {formattedDate} · {event.time}
              </span>
            </div>
            <div style={metaRowStyle}>
              <MapPin size={15} strokeWidth={2} color="var(--primary-color)" />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {event.is_online ? 'Online event' : event.location || 'Location TBA'}
              </span>
            </div>
            <div style={metaRowStyle}>
              <Users size={15} strokeWidth={2} color="var(--primary-color)" />
              <span>
                {event.max_seats === 0 ? 'Unlimited capacity' : `${event.seats_left} seats left`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  color: 'var(--text-secondary)',
  fontSize: '0.92rem',
  fontWeight: 600,
};
