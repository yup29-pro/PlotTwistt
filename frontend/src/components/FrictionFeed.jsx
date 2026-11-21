import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Droplets,
  Ruler,
  Users,
  FileText,
  ChevronRight,
  ExternalLink,
  Flame,
  Filter
} from 'lucide-react';

const CATEGORY_META = {
  flooding_drainage: {
    label: 'Flooding & Drainage',
    shortLabel: 'Drainage',
    icon: Droplets,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.1)',
  },
  zoning_buffer_row: {
    label: 'Zoning & ROW Buffer',
    shortLabel: 'Zoning & Buffer',
    icon: Ruler,
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.1)',
  },
  civic_neighbor_friction: {
    label: 'Civic & Neighbor Friction',
    shortLabel: 'Civic & Community',
    icon: Users,
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.1)',
  },
};

export default function FrictionFeed({
  analysis,
  isLoading,
  onSelectFlag,
  selectedFlagId,
}) {
  const [activeCategory, setActiveCategory] = useState('All');

  if (isLoading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          background: 'var(--bg-dark)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '3px solid rgba(56, 189, 248, 0.2)',
            borderTopColor: '#38bdf8',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
            Triangulating Land Friction...
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Cross-referencing satellite drainage buffers, court gazettes & civic forums
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          color: '#64748b',
          textAlign: 'center',
          gap: '12px',
        }}
      >
        <ShieldAlert size={40} color="#334155" />
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8' }}>
          Radar In Standby Mode
        </div>
        <div style={{ fontSize: '13px', maxWidth: '320px', lineHeight: 1.5 }}>
          Select a preset or click on the map, then hit <strong>Scan Radar</strong> to compute site friction.
        </div>
      </div>
    );
  }

  const { location, overall_risk, summary, flags = [] } = analysis;

  const riskMeta = {
    high: {
      badgeText: 'HIGH RISK LEVEL',
      color: 'var(--risk-high)',
      bg: 'var(--risk-high-bg)',
      border: 'var(--risk-high-border)',
      icon: ShieldAlert,
    },
    medium: {
      badgeText: 'MEDIUM RISK LEVEL',
      color: 'var(--risk-med)',
      bg: 'var(--risk-med-bg)',
      border: 'var(--risk-med-border)',
      icon: AlertTriangle,
    },
    low: {
      badgeText: 'LOW RISK LEVEL',
      color: 'var(--risk-low)',
      bg: 'var(--risk-low-bg)',
      border: 'var(--risk-low-border)',
      icon: ShieldCheck,
    },
  }[overall_risk] || {
    badgeText: 'CALCULATING',
    color: '#94a3b8',
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
    icon: ShieldAlert,
  };

  const RiskIcon = riskMeta.icon;

  // Filter flags
  const filteredFlags =
    activeCategory === 'All'
      ? flags
      : flags.filter((f) => f.category === activeCategory);

  const categories = [
    { id: 'All', label: 'All Signals', count: flags.length },
    {
      id: 'flooding_drainage',
      label: 'Drainage',
      count: flags.filter((f) => f.category === 'flooding_drainage').length,
    },
    {
      id: 'zoning_buffer_row',
      label: 'Zoning & ROW',
      count: flags.filter((f) => f.category === 'zoning_buffer_row').length,
    },
    {
      id: 'civic_neighbor_friction',
      label: 'Civic Friction',
      count: flags.filter((f) => f.category === 'civic_neighbor_friction').length,
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-dark)',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Card: Overall Risk & Summary */}
      <div
        style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'linear-gradient(180deg, #111827 0%, #0d121e 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Risk Badge and Location Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#64748b',
                marginBottom: '4px',
              }}
            >
              RADAR TARGET AUDIT
            </div>
            <h2
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#f8fafc',
                lineHeight: 1.3,
              }}
            >
              {location}
            </h2>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: riskMeta.bg,
              border: `1px solid ${riskMeta.border}`,
              color: riskMeta.color,
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              boxShadow: `0 0 16px ${riskMeta.bg}`,
            }}
          >
            <RiskIcon size={16} />
            <span>{riskMeta.badgeText}</span>
          </div>
        </div>

        {/* 2-Sentence Summary Card */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderLeft: `3px solid ${riskMeta.color}`,
            borderRadius: '4px 8px 8px 4px',
            padding: '10px 14px',
            fontSize: '13px',
            lineHeight: 1.5,
            color: '#cbd5e1',
          }}
        >
          {summary}
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: active ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${active ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                  color: active ? '#ffffff' : '#94a3b8',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span>{cat.label}</span>
                <span
                  style={{
                    background: active ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Flag List Feed */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            paddingBottom: '4px',
          }}
        >
          <span>DETECTED FRICTION POINTS ({filteredFlags.length})</span>
          <span>CLICK TO INSPECT RECEIPT</span>
        </div>

        {filteredFlags.map((flag) => {
          const catMeta = CATEGORY_META[flag.category] || {
            label: flag.category,
            icon: AlertTriangle,
            color: '#94a3b8',
            bg: 'rgba(255,255,255,0.05)',
          };
          const CatIcon = catMeta.icon;

          const severityColor =
            flag.severity === 'high'
              ? 'var(--risk-high)'
              : flag.severity === 'medium'
              ? 'var(--risk-med)'
              : 'var(--risk-low)';

          const isSelected = selectedFlagId === flag.id;

          return (
            <div
              key={flag.id}
              onClick={() => onSelectFlag(flag)}
              style={{
                background: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                border: `1px solid ${isSelected ? '#38bdf8' : 'var(--border-subtle)'}`,
                borderLeft: `4px solid ${severityColor}`,
                borderRadius: '8px',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all 0.18s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
                boxShadow: isSelected
                  ? '0 0 18px rgba(56, 189, 248, 0.2)'
                  : '0 2px 6px rgba(0,0,0,0.3)',
              }}
            >
              {/* Category and Severity Pill Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: catMeta.bg,
                    color: catMeta.color,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <CatIcon size={12} />
                  <span>{catMeta.label}</span>
                </div>

                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: severityColor,
                    letterSpacing: '0.05em',
                  }}
                >
                  {flag.severity} SEVERITY
                </div>
              </div>

              {/* Headline */}
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#f8fafc',
                  lineHeight: 1.35,
                }}
              >
                {flag.headline}
              </h3>

              {/* Plain English Impact */}
              <p
                style={{
                  fontSize: '12.5px',
                  lineHeight: 1.5,
                  color: '#94a3b8',
                }}
              >
                {flag.explanation}
              </p>

              {/* Verified Quote Snippet */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '11.5px',
                  color: '#cbd5e1',
                  fontStyle: 'italic',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.45,
                }}
              >
                "{flag.quote}"
              </div>

              {/* Source & Drawer Trigger Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingTop: '8px',
                  marginTop: '4px',
                  fontSize: '11px',
                }}
              >
                <span
                  style={{
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '220px',
                  }}
                >
                  Source: {flag.source_title}
                </span>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#38bdf8',
                    fontWeight: 600,
                  }}
                >
                  <span>Inspect Receipt</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          );
        })}

        {filteredFlags.length === 0 && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '13px',
            }}
          >
            No friction points detected in this category.
          </div>
        )}
      </div>
    </div>
  );
}
