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
  Filter,
  Truck,
  MapPin,
  Info
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
    color: '#fb923c',
    bg: 'rgba(249, 115, 22, 0.12)',
  },
  access_infrastructure: {
    label: 'Access & Infrastructure',
    shortLabel: 'Access',
    icon: Truck,
    color: '#facc15',
    bg: 'rgba(250, 204, 21, 0.1)',
  },
};

const VERDICT_COLOR = { High: 'var(--risk-high)', Moderate: 'var(--risk-med)', Low: 'var(--risk-low)' };
const SEVERITY_STYLE = {
  high: { color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.16)', bar: 'var(--risk-high)' },
  medium: { color: '#fcd34d', bg: 'rgba(245, 158, 11, 0.16)', bar: 'var(--risk-med)' },
  low: { color: '#6ee7b7', bg: 'rgba(16, 185, 129, 0.14)', bar: 'var(--risk-low)' },
};

// Publisher domain shown on each card, e.g. "thehindu.com".
function sourceDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

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
        <div role="status" aria-live="polite" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-main)' }}>
            Scanning this site…
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)', marginTop: 'var(--space-1)' }}>
            Checking news, civic sources and map data near the pin
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
          color: 'var(--text-dim)',
          textAlign: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <ShieldAlert size={40} color="#334155" />
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-main)' }}>
          Pick a site to scan
        </div>
        <div style={{ fontSize: 'var(--text-sm)', maxWidth: '320px', lineHeight: 1.5 }}>
          Choose a preset or click the map, then press <strong style={{ color: 'var(--text-main)' }}>Scan this site</strong>.
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
    {
      id: 'access_infrastructure',
      label: 'Access',
      count: flags.filter((f) => f.category === 'access_infrastructure').length,
    },
  ];
  const hasScore = typeof analysis.friction_score === 'number';
  const verdictColor = VERDICT_COLOR[analysis.verdict] || 'var(--text-main)';

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
        {/* Location */}
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.3 }}>
            {location}
          </h2>
          {analysis?.hierarchy?.display_hierarchy ? (
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: '#7dd3fc',
                marginTop: 'var(--space-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
              }}
            >
              <MapPin size={12} aria-hidden="true" />
              <span>{analysis.hierarchy.display_hierarchy}</span>
            </div>
          ) : null}
        </div>

        {/* Friction score: the focal point of the feed */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            padding: 'var(--space-4)',
            borderRadius: '12px',
            background: riskMeta.bg,
            border: `1px solid ${riskMeta.border}`,
          }}
        >
          {hasScore ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-1)' }}>
              <span
                style={{
                  fontSize: '56px',
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  fontVariantNumeric: 'tabular-nums',
                  color: verdictColor,
                }}
              >
                {analysis.friction_score}
              </span>
              <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-dim)', fontWeight: 600 }}>/100</span>
            </div>
          ) : (
            <RiskIcon size={36} color={riskMeta.color} aria-hidden="true" />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                lineHeight: 1.1,
                color: hasScore ? verdictColor : riskMeta.color,
                textTransform: 'capitalize',
              }}
            >
              {hasScore ? `${analysis.verdict} friction` : `${overall_risk || 'Unknown'} risk`}
            </span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {flags.length} {flags.length === 1 ? 'signal' : 'signals'}, overall risk {overall_risk || 'unknown'}
              {analysis.data_source === 'cache' ? ' (cached result)' : ''}
            </span>
          </div>
        </div>

        {/* 2-Sentence Summary Card */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderLeft: `3px solid ${riskMeta.color}`,
            borderRadius: '4px 8px 8px 4px',
            padding: '10px 14px',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.5,
            color: '#cbd5e1',
          }}
        >
          {summary}
        </div>

        {/* Degraded: some sources failed (demo data has its own banner) */}
        {analysis.degraded && analysis.data_source !== 'demo' ? (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.45,
              color: '#cbd5e1',
              background: 'rgba(148, 163, 184, 0.08)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '8px',
              padding: 'var(--space-2) var(--space-3)',
            }}
          >
            <Info size={15} color="#94a3b8" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
            <span>Some sources didn't respond, so this scan may be incomplete. Scan again later for a fuller picture.</span>
          </div>
        ) : null}

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                aria-pressed={active}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: active ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${active ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                  color: active ? '#ffffff' : '#cbd5e1',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: 'var(--text-xs)',
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
            fontSize: 'var(--text-xs)',
            color: 'var(--text-dim)',
            paddingBottom: 'var(--space-1)',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Friction points ({filteredFlags.length})</span>
          <span>Select a card to see its source</span>
        </div>

        {filteredFlags.map((flag) => {
          const catMeta = CATEGORY_META[flag.category] || {
            label: flag.category,
            icon: AlertTriangle,
            color: '#94a3b8',
            bg: 'rgba(255,255,255,0.05)',
          };
          const CatIcon = catMeta.icon;

          const sev = SEVERITY_STYLE[flag.severity] || SEVERITY_STYLE.low;
          const domain = sourceDomain(flag.url);

          const isSelected = selectedFlagId === flag.id;

          return (
            <div
              key={flag.id}
              role="button"
              tabIndex={0}
              aria-label={`${flag.severity} severity: ${flag.headline}. View source.`}
              onClick={() => onSelectFlag(flag)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectFlag(flag);
                }
              }}
              style={{
                background: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                border: `1px solid ${isSelected ? '#38bdf8' : 'var(--border-subtle)'}`,
                borderLeft: `4px solid ${sev.bar}`,
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
              {/* Category, Distance, and Severity Pill Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

                  {/* Distance Proximity Tag */}
                  {flag.distance_label && (
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontFamily: 'var(--font-mono)',
                        color:
                          flag.proximity_tier === 'hyperlocal'
                            ? '#34d399'
                            : flag.proximity_tier === 'corridor'
                            ? '#38bdf8'
                            : '#94a3b8',
                        background:
                          flag.proximity_tier === 'hyperlocal'
                            ? 'rgba(52, 211, 153, 0.12)'
                            : 'rgba(56, 189, 248, 0.08)',
                        border: `1px solid ${
                          flag.proximity_tier === 'hyperlocal'
                            ? 'rgba(52, 211, 153, 0.25)'
                            : 'rgba(56, 189, 248, 0.2)'
                        }`,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {flag.distance_label}
                    </span>
                  )}
                </div>

                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    color: sev.color,
                    background: sev.bg,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    textTransform: 'capitalize',
                  }}
                >
                  {flag.severity} severity
                </span>
              </div>

              {/* Headline */}
              <h3
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  lineHeight: 1.35,
                }}
              >
                {flag.headline}
              </h3>

              {/* Plain English Impact */}
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  lineHeight: 1.5,
                  color: 'var(--text-muted)',
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
                  title={flag.source_title}
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '240px',
                    color: '#e2e8f0',
                    fontWeight: 600,
                  }}
                >
                  {domain || 'Source'}
                </span>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#7dd3fc',
                    fontWeight: 600,
                  }}
                >
                  <span>View source</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          );
        })}

        {filteredFlags.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-6) var(--space-4)',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: 'var(--text-sm)',
              lineHeight: 1.5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            {flags.length === 0 ? (
              <>
                <ShieldCheck size={28} color="var(--text-dim)" aria-hidden="true" />
                <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: 'var(--text-base)' }}>
                  No public signals found for this site
                </span>
                <span style={{ maxWidth: '300px' }}>
                  That isn't proof the site is clean. Check drainage, zoning and access on the ground.
                </span>
              </>
            ) : (
              <>
                <span>No signals in this category.</span>
                <button
                  onClick={() => setActiveCategory('All')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'var(--text-main)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Show all signals
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
