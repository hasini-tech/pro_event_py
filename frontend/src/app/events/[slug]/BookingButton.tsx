'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface BookingButtonProps {
  event: any;
}

export default function BookingButton({ event }: BookingButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isAtCapacity = event.max_seats > 0 && event.seats_left <= 0;
  const isHost = user && user.id === event.host_id;

  const handleBooking = async () => {
    if (!user) {
      router.push(`/login?redirect=/events/${event.slug}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/tickets/book', { event_id: event.id });
      const ticket = res.data;

      if (ticket.status === 'waitlisted') {
        setSuccessMessage("You're on the waitlist. We'll let you know if a seat opens up.");
        return;
      }

      if (event.is_paid) {
        const payRes = await api.post('/payments/create-session', {
          event_id: event.id,
          ticket_ref: ticket.ticket_ref,
          amount: event.ticket_price,
          event_title: event.title,
        });

        if (payRes.data.url) {
          window.location.href = payRes.data.url;
          return;
        }
      }

      setSuccessMessage('Your RSVP is confirmed.');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to book ticket');
    } finally {
      setLoading(false);
    }
  };

  if (isHost) {
    return (
      <button
        onClick={() => router.push(`/manage/${event.slug}`)}
        style={{ width: '100%', padding: '16px', background: 'transparent', color: 'var(--text-primary)', border: '2px solid var(--border-color)', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}
      >
        Manage Event
      </button>
    );
  }

  return (
    <>
      {error && <div style={{ color: '#ff6584', fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}
      {successMessage && <div style={{ color: '#1f6a52', fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>{successMessage}</div>}
      <button
        onClick={handleBooking}
        disabled={loading}
        style={{
          width: '100%',
          padding: '16px',
          background: 'var(--primary-color)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '1.05rem',
          fontWeight: 'bold',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {loading ? <Loader2 className="animate-spin" size={24} /> : isAtCapacity ? 'Join Waitlist' : event.is_paid ? 'Get Tickets' : 'RSVP'}
      </button>
    </>
  );
}
