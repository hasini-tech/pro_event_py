'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { QrCode, CheckCircle2, XCircle, ArrowLeft, Loader2 } from 'lucide-react';

export default function CheckInScanner() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const router = useRouter();
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Simulated scanner state (users would normally use a real hardware scanner or camera library)
  const [manualTicketRef, setManualTicketRef] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [scanMessage, setScanMessage] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const eventRes = await api.get(`/events/${slug}`);
        setEvent(eventRes.data);
      } catch (err) {
        setScanStatus('error');
        setScanMessage('Event not found');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [slug]);

  const handleSimulatedScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTicketRef) return;
    
    setScanStatus('scanning');
    
    try {
      const res = await api.post('/attendees/check-in', {
        ticket_ref: manualTicketRef,
        event_id: event.id
      });
      
      setScanStatus('success');
      setScanMessage(res.data.message || 'Ticket verified! Check-in successful.');
      setManualTicketRef('');
      
      // Reset after 3 seconds
      setTimeout(() => setScanStatus('idle'), 3000);
      
    } catch (err: any) {
      setScanStatus('error');
      setScanMessage(err.response?.data?.detail || 'Invalid ticket or already checked in.');
      
      setTimeout(() => setScanStatus('idle'), 3000);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={40} color="var(--primary-color)" /></div>;
  if (!event) return null;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
      <button 
        onClick={() => router.push(`/manage/${event.slug}`)}
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '30px' }}
      >
        <ArrowLeft size={20} /> Back to Dashboard
      </button>

      <h1 style={{ fontSize: '2rem', marginBottom: '10px' }}>Scanner: {event.title}</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '40px' }}>Scan QR codes or enter ticket references manually.</p>

      <div style={{ 
        background: 'var(--surface-color)', 
        borderRadius: '24px', 
        padding: '60px 20px', 
        border: '1px solid var(--border-color)',
        marginBottom: '30px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {scanStatus === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '150px', height: '150px', border: '4px dashed var(--border-color)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QrCode size={64} color="var(--text-secondary)" />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Ready to scan...</p>
          </div>
        )}

        {scanStatus === 'scanning' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <Loader2 className="animate-spin" size={64} color="var(--primary-color)" />
            <p style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>Verifying ticket...</p>
          </div>
        )}

        {scanStatus === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <CheckCircle2 size={80} color="#4bc0c0" />
            <h3 style={{ fontSize: '1.5rem', color: '#4bc0c0', margin: 0 }}>Valid Ticket!</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{scanMessage}</p>
          </div>
        )}

        {scanStatus === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <XCircle size={80} color="#ff6584" />
            <h3 style={{ fontSize: '1.5rem', color: '#ff6584', margin: 0 }}>Invalid Scan</h3>
            <p style={{ color: 'var(--text-primary)' }}>{scanMessage}</p>
          </div>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Manual Entry</h3>
        <form onSubmit={handleSimulatedScan} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={manualTicketRef}
            onChange={(e) => setManualTicketRef(e.target.value.toUpperCase())}
            placeholder="e.g. EVTLY-ABC123XY"
            style={{ flex: 1, padding: '14px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', fontSize: '16px', fontFamily: 'monospace' }}
          />
          <button 
            type="submit" 
            disabled={scanStatus !== 'idle'}
            style={{ padding: '14px 24px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: scanStatus !== 'idle' ? 'not-allowed' : 'pointer' }}
          >
            Verify
          </button>
        </form>
      </div>
    </div>
  );
}
