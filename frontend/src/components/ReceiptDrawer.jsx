import React, { useEffect } from 'react';
import {
  X,
  ExternalLink,
  ShieldAlert,
  FileCheck2,
  FileText,
  Quote,
  Building,
  CheckCircle2,
  Clock,
  Hash,
  Share2
} from 'lucide-react';

export default function ReceiptDrawer({ flag, onClose }) {
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
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: '#64748b',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                EVIDENCE RECEIPT // PROOF TRAIL
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                Ref ID: #{flag.id}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#94a3b8',
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
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
              }}
            >
              {flag.severity} SEVERITY
            </span>

            <span
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Category: {flag.category.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Risk Title / Headline */}
          <div>
            <h2
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
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#38bdf8',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              PLAIN-ENGLISH OPERATIONAL IMPACT
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
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                VERIFIED SOURCE QUOTE EXTRACT
              </span>
            </div>

            <blockquote
              style={{
                fontSize: '13.5px',
                lineHeight: 1.6,
                color: '#f1f5f9',
                fontStyle: 'normal',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(56, 189, 248, 0.05)',
                padding: '12px 14px',
                borderRadius: '6px',
                border: '1px dashed rgba(56, 189, 248, 0.2)',
              }}
            >
              "{flag.quote}"
            </blockquote>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                color: '#10b981',
                fontWeight: 500,
              }}
            >
              <CheckCircle2 size={14} />
              <span>Exact string snippet verified from regulatory or reporting record</span>
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
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: '#64748b',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              REGULATORY GAZETTE / PUBLICATION
            </div>

            <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
              {flag.source_title}
            </div>

            <div
              style={{
                fontSize: '12px',
                color: '#64748b',
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
            <span>Open Source Gazette / Document</span>
            <ExternalLink size={16} />
          </a>

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
