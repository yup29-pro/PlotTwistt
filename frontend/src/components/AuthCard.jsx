import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

export const TOKEN_KEY = 'plottwistt_token';
export const USER_KEY = 'plottwistt_user';

const card = {
  background: '#FFFFFF',
  border: '1px solid #FFFFFF',
  borderRadius: '24px',
  padding: '36px',
  boxShadow: 'var(--shadow-soft)',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};
const labelStyle = { fontSize: '12px', fontWeight: 400, color: 'var(--text-main)', marginBottom: '6px', display: 'block' };
const inputStyle = (invalid) => ({
  width: '100%',
  background: 'var(--bg-panel)',
  border: `1px solid ${invalid ? 'var(--text-main)' : 'rgba(30, 31, 27, 0.16)'}`,
  boxShadow: invalid ? 'inset 0 0 0 1px var(--text-main)' : 'none',
  padding: '10px 14px',
  borderRadius: '999px',
  color: 'var(--text-main)',
  fontSize: 'var(--text-base)',
  fontFamily: 'inherit',
});
const primaryButton = (busy) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  background: 'var(--accent)',
  border: 'none',
  color: 'var(--text-main)',
  padding: '12px',
  borderRadius: '999px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: busy ? 'progress' : 'pointer',
  opacity: busy ? 0.75 : 1,
  boxShadow: 'var(--shadow-soft)',
});
const linkButton = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--text-main)',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const errorText = { fontSize: '12px', color: 'var(--text-main)', marginTop: '6px', display: 'flex', gap: '6px' };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validate(mode, { name, email, password }) {
  const errors = {};
  if (mode === 'signup' && !name.trim()) errors.name = 'Enter your name.';
  if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address, like name@example.com.';
  if (mode === 'signup' && password.length < 8) errors.password = 'Use at least 8 characters for your password.';
  if (mode === 'login' && !password) errors.password = 'Enter your password.';
  return errors;
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <div id={id} style={errorText}>
      <span aria-hidden="true" style={{ fontWeight: 700 }}>!</span>
      <span>{message}</span>
    </div>
  );
}

/** Sign in / create account / continue as guest. Calls onComplete(user) when done. */
export default function AuthCard({ onComplete }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [offerSignup, setOfferSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const firstFieldRef = useRef(null);
  const formErrorRef = useRef(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, [mode]);

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const switchMode = (next) => {
    setMode(next);
    setErrors({});
    setFormError('');
    setOfferSignup(false);
  };

  const finish = ({ token, user }) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    onComplete(user);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const found = validate(mode, values);
    setErrors(found);
    setFormError('');
    setOfferSignup(false);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const body =
        mode === 'signup'
          ? { name: values.name.trim(), email: values.email.trim(), password: values.password }
          : { email: values.email.trim(), password: values.password };
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        finish(data);
        return;
      }
      const detail = typeof data.detail === 'string' ? data.detail : `Something went wrong (HTTP ${res.status}). Try again.`;
      setFormError(detail);
      // The server never says whether an account exists, so offer sign-up on any failed sign-in.
      if (mode === 'login' && res.status === 401) setOfferSignup(true);
      requestAnimationFrame(() => formErrorRef.current?.focus());
    } catch {
      setFormError("Can't reach the server. Check that the backend is running, or continue as a guest.");
      requestAnimationFrame(() => formErrorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = () => {
    localStorage.removeItem(TOKEN_KEY);
    const guest = { name: 'Guest', guest: true };
    localStorage.setItem(USER_KEY, JSON.stringify(guest));
    onComplete(guest);
  };

  const isSignup = mode === 'signup';
  const field = (key, label, props) => (
    <div>
      <label htmlFor={`auth-${key}`} style={labelStyle}>
        {label}
      </label>
      <input
        id={`auth-${key}`}
        name={key}
        value={values[key]}
        onChange={set(key)}
        aria-invalid={errors[key] ? 'true' : undefined}
        aria-describedby={errors[key] ? `auth-${key}-error` : undefined}
        style={inputStyle(Boolean(errors[key]))}
        {...props}
      />
      <FieldError id={`auth-${key}-error`} message={errors[key]} />
    </div>
  );

  return (
    <div style={card}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
          {isSignup ? 'Create your account' : 'Sign in to PlotTwistt'}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {isSignup
            ? 'Your name labels the console. Accounts are stored on this demo server only.'
            : 'Use your email and password, or continue as a guest.'}
        </p>
      </div>

      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {isSignup
          ? field('name', 'Name', { type: 'text', autoComplete: 'name', ref: firstFieldRef })
          : null}
        {field('email', 'Email', {
          type: 'email',
          autoComplete: 'email',
          inputMode: 'email',
          spellCheck: false,
          ref: isSignup ? undefined : firstFieldRef,
        })}
        {field('password', 'Password', {
          type: 'password',
          autoComplete: isSignup ? 'new-password' : 'current-password',
        })}
        {isSignup && !errors.password ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-8px' }}>At least 8 characters.</div>
        ) : null}

        {formError ? (
          <div
            ref={formErrorRef}
            tabIndex={-1}
            role="alert"
            style={{
              background: 'var(--chip)',
              borderRadius: '16px',
              padding: '10px 14px',
              fontSize: '13px',
              color: 'var(--text-main)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span>{formError}</span>
            {offerSignup ? (
              <button type="button" style={{ ...linkButton, alignSelf: 'flex-start' }} onClick={() => switchMode('signup')}>
                Create an account with this email
              </button>
            ) : null}
          </div>
        ) : null}

        <button type="submit" disabled={busy} aria-busy={busy} style={{ ...primaryButton(busy), marginTop: '6px' }}>
          {busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null}
          <span>{busy ? (isSignup ? 'Creating account…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}</span>
        </button>
      </form>

      <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {isSignup ? (
          <>
            <span>Already have an account?</span>
            <button type="button" style={linkButton} onClick={() => switchMode('login')}>
              Sign in
            </button>
          </>
        ) : (
          <>
            <span>New here?</span>
            <button type="button" style={linkButton} onClick={() => switchMode('signup')}>
              Create an account
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={continueAsGuest}
        disabled={busy}
        style={{
          background: 'var(--chip)',
          border: '1px solid var(--chip)',
          color: 'var(--text-main)',
          padding: '12px',
          borderRadius: '999px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: busy ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Continue as guest (no password needed)
      </button>
    </div>
  );
}
