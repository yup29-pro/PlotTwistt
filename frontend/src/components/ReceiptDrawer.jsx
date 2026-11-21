import React, { useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  ShieldAlert,
  FileCheck2,
  FileText,
  Quote,
  Building,
  CheckCircle2,
  Info,
  Clock,
  Hash,
  Share2
} from 'lucide-react';
import { describeDistance } from '../utils/distance';

const isHttpUrl = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);

function sourceDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export default function ReceiptDrawer({ flag, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (flag && closeRef.current) closeRef.current.focus();
  }, [flag]);
  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!flag) return null;

  const severityColor =
    flag.severity === 'high'
      ? 'var(--sev-high-fg)'
      : flag.severity === 'medium'
      ? 'var(--sev-med-fg)'
      : 'var(--sev-low-fg)';

  const severityBg =
    flag.severity === 'high'
      ? 'var(--sev-high-bg)'
      : flag.severity === 'medium'
      ? 'var(--sev-med-bg)'
      : 'var(--sev-low-bg)';

  const domain = sourceDomain(flag.url);
  const dist = describeDistance(flag);
  const hasLink = isHttpUrl(flag.url);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(30, 31, 27, 0.35)',
          backdropFilter: 'blur(4px)',
          transition: 'opacity 0.2s',
        }}
      />

      {/* Slide-over Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          background: '#FFFFFF',
          borderLeft: '1px solid var(--border-subtle)',
          borderRadius: '24px 0 0 24px',
          overflow: 'hidden',
          boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2010,
          animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '999px',
                background: 'var(--accent)',
                border: '1px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-main)',
              }}
            >
              <FileCheck2 size={18} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: 'var(--text-main)',
                }}
              >
                Source receipt
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}>
                {domain || 'Unknown source'}
              </div>
            </div>
          </div>

          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close source receipt"
            style={{
              background: 'var(--chip)',
              border: '1px solid var(--chip)',
              borderRadius: '999px',
              color: 'var(--text-main)',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Metadata Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                background: severityBg,
                color: severityColor,
                border: `1px solid ${severityBg}`,
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {flag.severity} severity
            </span>

            <span
              style={{
                background: 'var(--chip)',
                color: 'var(--text-main)',
                border: '1px solid var(--chip)',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: 'var(--text-xs)',
                fontWeight: 400,
                textTransform: 'capitalize',
              }}
            >
              {flag.category.replace(/_/g, ' ')}
            </span>
            {flag.distance_label ? (
              <span
                style={{
                  color: 'var(--text-main)',
                  border: '1px solid rgba(30, 31, 27, 0.16)',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 400,
                }}
              >
                {flag.distance_label}
              </span>
            ) : null}
            <span
              style={{
                color: dist.known ? 'var(--text-main)' : 'var(--text-muted)',
                background: dist.known ? 'var(--chip)' : 'transparent',
                border: `1px ${dist.known ? 'solid' : 'dashed'} rgba(30, 31, 27, ${dist.known ? 0.08 : 0.24})`,
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: 'var(--text-xs)',
                fontWeight: dist.known ? 500 : 400,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {dist.text}
            </span>
            <span style={{ flexBasis: '100%', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {dist.basis}
              {dist.known && flag.distance_method === 'mentioned_place'
                ? '. Straight-line estimate to that place, not the exact spot of the event.'
                : '.'}
            </span>
          </div>

          {/* Risk Title / Headline */}
          <div>
            <h2
              id="receipt-title"
              style={{
                fontSize: '18px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--text-main)',
                lineHeight: 1.35,
              }}
            >
              {flag.headline}
            </h2>
          </div>

          {/* Plain-English Impact Section */}
          <div
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--bg-panel)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                fontWeight: 400,
              }}
            >
              What this means for the site
            </div>
            <p
              style={{
                fontSize: '13.5px',
                lineHeight: 1.6,
                color: 'var(--text-main)',
              }}
            >
              {flag.explanation}
            </p>
          </div>

          {/* Highlighted Quote Callout (The "Receipt") */}
          <div
            style={{
              background: 'var(--dark-card)',
              border: '1px solid var(--dark-border)',
              borderLeft: '4px solid var(--accent)',
              borderRadius: '16px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              position: 'relative',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
              <Quote size={18} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400 }}>
                Quote from the source
              </span>
            </div>

            <blockquote
              style={{
                fontSize: '15px',
                lineHeight: 1.65,
                color: '#FFFFFF',
                fontStyle: 'normal',
                fontFamily: 'var(--font-sans)',
              }}
            >
              “{flag.quote}”
            </blockquote>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: 'var(--text-xs)',
                color: 'var(--muted-on-dark)',
                fontWeight: 400,
              }}
            >
              <Info size={14} aria-hidden="true" />
              <span>Snippet as returned by search. Open the source to read it in context.</span>
            </div>
          </div>

          {/* Source Document Details */}
          <div
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--bg-panel)',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-dim)',
                fontWeight: 400,
              }}
            >
              Source{domain ? `: ${domain}` : ''}
            </div>

            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
              {flag.source_title}
            </div>

            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
                wordBreak: 'break-all',
              }}
            >
              {flag.url}
            </div>
          </div>
        </div>

        {/* Drawer Bottom Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: '#FFFFFF',
            display: 'flex',
            gap: '12px',
          }}
        >
          {hasLink ? (
            <a
              href={flag.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'var(--accent)',
                color: 'var(--text-main)',
                padding: '12px 16px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: 'var(--shadow-soft)',
                transition: 'all 0.15s',
              }}
            >
              <span>Open on {domain || 'source site'}</span>
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          ) : (
            <span style={{ flex: 1, alignSelf: 'center', fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>
              No link is available for this source.
            </span>
          )}

          <button
            onClick={onClose}
            style={{
              background: 'var(--dark-card)',
              border: '1px solid var(--dark-border)',
              color: '#FFFFFF',
              padding: '12px 18px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
