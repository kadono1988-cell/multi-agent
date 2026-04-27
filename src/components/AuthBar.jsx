import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Minimal email-link sign in / sign out button. We deliberately keep this
// light: anonymous users still see the public app, but signing in lets the
// app stamp owner_id on new rows so a future "private mode" toggle can
// filter on it. Magic-link delivery is whatever the Supabase project has
// configured (default: email OTP via Supabase Auth's built-in template).

export function AuthBar({ t }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user || null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const sendLink = async () => {
    if (!email.trim()) return;
    setSending(true);
    setSent(false);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) alert(error.message);
    else setSent(true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setOpen(false);
  };

  if (user) {
    return (
      <button className="btn-icon" onClick={signOut} title={t('auth.sign_out')} style={{ fontSize: '0.78rem' }}>
        👤 {user.email?.split('@')[0]} · {t('auth.sign_out')}
      </button>
    );
  }

  return (
    <>
      <button className="btn-icon" onClick={() => setOpen(true)} style={{ fontSize: '0.78rem' }}>
        🔓 {t('auth.sign_in')}
      </button>
      {open ? (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card)', color: 'var(--card-foreground)', borderRadius: 6,
            padding: '1.5rem 1.75rem', maxWidth: 380, width: '92vw',
            boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
          }}>
            <h3 style={{ marginTop: 0 }}>{t('auth.modal_title')}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '0.75rem' }}>
              {t('auth.modal_intro')}
            </p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={sendLink} disabled={sending || !email.trim()}>
                {sending ? t('auth.sending') : t('auth.send_link')}
              </button>
              <button className="btn" onClick={() => setOpen(false)}>{t('auth.cancel')}</button>
            </div>
            {sent ? (
              <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#10b981' }}>
                ✓ {t('auth.sent_msg')}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
