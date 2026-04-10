import Link from 'next/link';
import { AlertCircle, ArrowRight } from 'lucide-react';

export default function PaymentFailedPage() {
  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '100px 20px' }}>
      <div style={{ padding: '36px', borderRadius: '32px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', textAlign: 'center' }}>
        <AlertCircle size={72} color="#ff6584" style={{ margin: '0 auto 18px' }} />
        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '12px' }}>Payment was not completed</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '28px' }}>
          No worries. Your booking was not finalized. You can try again from the event page or browse other events.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Link href="/events" style={{ padding: '14px 18px', borderRadius: '999px', background: 'var(--primary-color)', color: 'white', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Browse events
            <ArrowRight size={16} />
          </Link>
          <Link href="/dashboard?tab=tickets" style={{ padding: '14px 18px', borderRadius: '999px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.72)', fontWeight: 700 }}>
            My tickets
          </Link>
        </div>
      </div>
    </div>
  );
}
