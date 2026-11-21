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
      ? 'var(--risk-high)'
      : flag.severity === 'medium'
      ? 'var(--risk-med)'
      : 'var(--risk-low)';

  const severityBg =
    flag.severity === 'high'
      ? 'var(--risk-high-bg)'
      : flag.severity === 'medium'
      ? 'var(--risk-med-bg)'
      : 'var(--risk-low-bg)';

  const domain = sourceDomain(flag.url);
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
          background: 'rgba(0, 0, 0, 0.75)',
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
          background: '#0d131f',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
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
            background: '#111827',
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
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <FileCheck2 size={18} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
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
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#cbd5e1',
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
                border: `1px solid ${severityColor}`,
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                textTransform: 'capitalize',
              }}
            >
              {flag.severity} severity
            </span>

            <span
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {flag.category.replace(/_/g, ' ')}
            </span>
            {flag.distance_label ? (
              <span
                style={{
                  color: '#7dd3fc',
                  border: '1px solid rgba(125, 211, 252, 0.3)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                }}
              >
                {flag.distance_label}
              </span>
            ) : null}
          </div>

          {/* Risk Title / Headline */}
          <div>
            <h2
              id="receipt-title"
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.35,
              }}
            >
              {flag.headline}
            </h2>
          </div>

          {/* Plain-English Impact Section */}
          <div
            style={{
              background: '#111827',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: '#7dd3fc',
                fontWeight: 600,
              }}
            >
              What this means for the site
            </div>
            <p
              style={{
                fontSize: '13.5px',
                lineHeight: 1.6,
                color: '#e2e8f0',
              }}
            >
              {flag.explanation}
            </p>
          </div>

          {/* Highlighted Quote Callout (The "Receipt") */}
          <div
            style={{
              background: 'rgba(2, 6, 23, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderLeft: '4px solid #38bdf8',
              borderRadius: '8px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              position: 'relative',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
              <Quote size={18} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                Quote from the source
              </span>
            </div>

            <blockquote
              style={{
                fontSize: '15px',
                lineHeight: 1.65,
                color: '#f1f5f9',
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
                color: 'var(--text-dim)',
                fontWeight: 500,
              }}
            >
              <Info size={14} aria-hidden="true" />
              <span>Snippet as returned by search. Open the source to read it in context.</span>
            </div>
          </div>

          {/* Source Document Details */}
          <div
            style={{
              background: '#111827',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
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
                fontWeight: 600,
              }}
            >
              Source{domain ? `: ${domain}` : ''}
            </div>

            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
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
            background: '#111827',
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
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#ffffff',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
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
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              padding: '12px 18px',
              borderRadius: '8px',
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
