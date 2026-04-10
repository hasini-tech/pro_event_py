import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function PaymentSuccessPage() {
  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '100px 20px' }}>
      <div style={{ padding: '36px', borderRadius: '32px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', textAlign: 'center' }}>
        <CheckCircle2 size={72} color="#4bc0c0" style={{ margin: '0 auto 18px' }} />
        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '12px' }}>Payment successful</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '28px' }}>
          Your ticket is confirmed. We have updated your booking and the event host can now see your RSVP in the attendee dashboard.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link href="/dashboard?tab=tickets" style={{ padding: '14px 18px', borderRadius: '999px', background: 'var(--primary-color)', color: 'white', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            View my tickets
            <ArrowRight size={16} />
          </Link>
          <Link href="/events" style={{ padding: '14px 18px', borderRadius: '999px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.72)', fontWeight: 700 }}>
            Explore more events
          </Link>
        </div>
      </div>
    </div>
  );
}
