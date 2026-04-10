'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Bell,
  CalendarPlus2,
  CalendarRange,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Ticket,
  User,
  UserCircle,
  X,
} from 'lucide-react';

const linkStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '0.95rem',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

const iconButtonStyle: React.CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '14px',
  border: '1px solid var(--border-color)',
  background: 'rgba(255,255,255,0.9)',
  color: 'var(--text-secondary)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  boxShadow: '0 12px 26px rgba(17,39,45,0.05)',
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const createEventHref = user
    ? '/create-event/form'
    : '/create-event/continue?redirect=/create-event/form';

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-profile-menu]')) {
        return;
      }
      setShowProfileMenu(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateClick = () => {
    router.push(createEventHref);
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
    setIsMenuOpen(false);
    setShowProfileMenu(false);
  };

  const formattedTime = useMemo(() => {
    if (!now) return '';
    return now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
  }, [now]);

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '14px 0',
        backdropFilter: 'blur(20px)',
        background: 'rgba(255, 255, 255, 0.88)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div
        className="page-shell"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: 'fit-content',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--primary-color), var(--teal-700))',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              boxShadow: '0 16px 30px rgba(14,118,120,0.22)',
            }}
          >
            E
          </div>
          <div style={{ display: 'grid', gap: '2px' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Evently</span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>
              Events made simple
            </span>
          </div>
        </Link>

        <div
          className="desktop-menu"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1,
            gap: '22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <Link href="/events" style={linkStyle}>
              <Ticket size={18} strokeWidth={2} />
              Events
            </Link>
            <Link href="/calendars" style={linkStyle}>
              <CalendarRange size={18} strokeWidth={2} />
              Calendars
            </Link>
            <Link href="/discover" style={linkStyle}>
              <Compass size={18} strokeWidth={2} />
              Discover
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255,255,255,0.9)',
                color: 'var(--text-secondary)',
                fontWeight: 800,
                fontSize: '0.9rem',
                boxShadow: '0 12px 26px rgba(17,39,45,0.05)',
              }}
            >
              {mounted ? formattedTime : 'Loading...'}
            </div>

            <button onClick={handleCreateClick} className="primary-button" style={{ minHeight: '44px' }}>
              <CalendarPlus2 size={18} />
              Create Event
            </button>

            <button style={iconButtonStyle} aria-label="Search">
              <Search size={18} strokeWidth={2} />
            </button>

            {user ? (
              <div style={{ position: 'relative' }} data-profile-menu>
                <button
                  onClick={() => setShowProfileMenu((current) => !current)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '4px 6px 4px 4px',
                    borderRadius: '999px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.95)',
                    cursor: 'pointer',
                    boxShadow: '0 12px 26px rgba(17,39,45,0.06)',
                  }}
                >
                  <div style={{ ...iconButtonStyle, width: '36px', height: '36px', borderRadius: '50%', boxShadow: 'none' }}>
                    <Bell size={17} />
                  </div>
                  {user.profile_image ? (
                    <img
                      src={user.profile_image}
                      alt="profile"
                      style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary-color), var(--teal-700))',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                      }}
                    >
                      {user.name?.[0]?.toUpperCase() || <User size={18} />}
                    </div>
                  )}
                </button>

                {showProfileMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      marginTop: '10px',
                      width: '270px',
                      background: 'rgba(255,255,255,0.98)',
                      borderRadius: '24px',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 30px 60px rgba(17,39,45,0.12)',
                      overflow: 'hidden',
                      zIndex: 30,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '18px',
                        borderBottom: '1px solid rgba(14,118,120,0.08)',
                        background: 'linear-gradient(180deg, rgba(14,118,120,0.06), rgba(255,255,255,0.9))',
                      }}
                    >
                      {user.profile_image ? (
                        <img
                          src={user.profile_image}
                          alt="profile"
                          style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '46px',
                            height: '46px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--primary-color), var(--teal-700))',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'white',
                            fontWeight: 800,
                          }}
                        >
                          {user.name?.[0]?.toUpperCase() || <User size={18} />}
                        </div>
                      )}
                      <div style={{ lineHeight: 1.3 }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>{user.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{user.email}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', padding: '8px' }}>
                      <Link
                        href="/profile"
                        onClick={() => setShowProfileMenu(false)}
                        style={menuItemStyle}
                      >
                        <UserCircle size={18} color="var(--primary-color)" />
                        View Profile
                      </Link>
                      <Link
                        href="/dashboard?tab=events"
                        onClick={() => setShowProfileMenu(false)}
                        style={menuItemStyle}
                      >
                        <LayoutDashboard size={18} color="var(--primary-color)" />
                        Hosted Events
                      </Link>
                      <button onClick={handleLogout} style={{ ...menuItemStyle, border: 'none', textAlign: 'left' }}>
                        <LogOut size={18} color="var(--primary-color)" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link href="/login" className="secondary-button" style={{ minHeight: '44px' }}>
                  Log in
                </Link>
                <Link href="/signup" className="primary-button" style={{ minHeight: '44px' }}>
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>

        <button
          className="mobile-toggle"
          onClick={() => setIsMenuOpen((current) => !current)}
          style={iconButtonStyle}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 980px) {
              .desktop-menu { display: flex !important; }
              .mobile-toggle { display: none !important; }
            }
          `,
        }}
      />

      {isMenuOpen && (
        <div className="page-shell" style={{ marginTop: '14px' }}>
          <div
            className="glass-panel"
            style={{
              borderRadius: '26px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <Link href="/events" onClick={() => setIsMenuOpen(false)} style={mobileLinkStyle}>
              <Ticket size={18} />
              Events
            </Link>
            <Link href="/calendars" onClick={() => setIsMenuOpen(false)} style={mobileLinkStyle}>
              <CalendarRange size={18} />
              Calendars
            </Link>
            <Link href="/discover" onClick={() => setIsMenuOpen(false)} style={mobileLinkStyle}>
              <Compass size={18} />
              Discover
            </Link>
            <button onClick={handleCreateClick} className="primary-button" style={{ width: '100%' }}>
              <CalendarPlus2 size={18} />
              Create Event
            </button>
            {user ? (
              <>
                <Link href="/profile" onClick={() => setIsMenuOpen(false)} style={mobileLinkStyle}>
                  <UserCircle size={18} />
                  Profile
                </Link>
                <Link href="/dashboard?tab=events" onClick={() => setIsMenuOpen(false)} style={mobileLinkStyle}>
                  <LayoutDashboard size={18} />
                  Hosted Events
                </Link>
                <button
                  onClick={handleLogout}
                  style={{
                    ...mobileLinkStyle,
                    border: 'none',
                    textAlign: 'left',
                    background: 'rgba(255,255,255,0.92)',
                  }}
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </>
            ) : (
              <div style={{ display: 'grid', gap: '10px', marginTop: '4px' }}>
                <Link href="/login" onClick={() => setIsMenuOpen(false)} className="secondary-button" style={{ width: '100%' }}>
                  Log in
                </Link>
                <Link href="/signup" onClick={() => setIsMenuOpen(false)} className="primary-button" style={{ width: '100%' }}>
                  Start free
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

const menuItemStyle: React.CSSProperties = {
  padding: '12px 14px',
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
  borderRadius: '16px',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const mobileLinkStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: '16px',
  border: '1px solid var(--border-color)',
  background: 'rgba(255,255,255,0.92)',
  color: 'var(--text-primary)',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

export default Navbar;
