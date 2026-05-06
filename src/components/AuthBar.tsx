import React, { useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthBarProps {
  t: TFunction;
}

export function AuthBar({ t }: AuthBarProps) {
  const [user, setUser] = useState<User | null>(null);
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
      <button className="btn-icon" onClick={signOut} title={t('auth.sign_out') as string} style={{ fontSize: '0.78rem' }}>
        👤 {user.email?.split('@')[0]} · {t('auth.sign_out') as string}
      </button>
    );
  }

  return (
    <>
      <button className="btn-icon" onClick={() => setOpen(true)} style={{ fontSize: '0.78rem' }}>
        🔓 {t('auth.sign_in') as string}
      </button>
      {open ? (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{
            background: 'var(--card)', color: 'var(--card-foreground)', borderRadius: 6,
            padding: '1.5rem 1.75rem', maxWidth: 380, width: '92vw',
            boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
          }}>
            <h3 style={{ marginTop: 0 }}>{t('auth.modal_title') as string}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '0.75rem' }}>
              {t('auth.modal_intro') as string}
            </p>
            <input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={sendLink} disabled={sending || !email.trim()}>
                {sending ? t('auth.sending') as string : t('auth.send_link') as string}
              </button>
              <button className="btn" onClick={() => setOpen(false)}>{t('auth.cancel') as string}</button>
            </div>
            {sent ? (
              <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#10b981' }}>
                ✓ {t('auth.sent_msg') as string}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
