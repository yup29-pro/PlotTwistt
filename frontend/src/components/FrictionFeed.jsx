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
    color: '#FFFFFF',
    bg: 'rgba(255, 255, 255, 0.08)',
  },
  zoning_buffer_row: {
    label: 'Zoning & ROW Buffer',
    shortLabel: 'Zoning & Buffer',
    icon: Ruler,
    color: '#FFFFFF',
    bg: 'rgba(255, 255, 255, 0.08)',
  },
  civic_neighbor_friction: {
    label: 'Civic & Neighbor Friction',
    shortLabel: 'Civic & Community',
    icon: Users,
    color: '#FFFFFF',
    bg: 'rgba(255, 255, 255, 0.08)',
  },
  access_infrastructure: {
    label: 'Access & Infrastructure',
    shortLabel: 'Access',
    icon: Truck,
    color: '#FFFFFF',
    bg: 'rgba(255, 255, 255, 0.08)',
  },
};

const VERDICT_COLOR = { High: 'var(--text-main)', Moderate: 'var(--text-main)', Low: 'var(--text-main)' };
const SEVERITY_STYLE = {
  high: { color: 'var(--sev-high-fg)', bg: 'var(--sev-high-bg)', bar: 'var(--sev-high-bg)', ring: 'none' },
  medium: { color: 'var(--sev-med-fg)', bg: 'var(--sev-med-bg)', bar: 'var(--muted-on-dark)', ring: 'inset 0 0 0 1px rgba(255, 255, 255, 0.35)' },
  low: { color: 'var(--sev-low-fg)', bg: 'var(--sev-low-bg)', bar: 'var(--dark-border)', ring: 'none' },
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
  onScroll,
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
          background: 'var(--bg-panel)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '3px solid rgba(30, 31, 27, 0.12)',
            borderTopColor: 'var(--accent)',
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
        <ShieldAlert size={40} color="var(--text-muted)" />
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
      color: 'var(--accent)',
      bg: '#FFFFFF',
      border: 'var(--accent)',
      icon: ShieldAlert,
    },
    medium: {
      badgeText: 'MEDIUM RISK LEVEL',
      color: 'var(--dark-card)',
      bg: '#FFFFFF',
      border: '#FFFFFF',
      icon: AlertTriangle,
    },
    low: {
      badgeText: 'LOW RISK LEVEL',
      color: 'var(--text-muted)',
      bg: '#FFFFFF',
      border: '#FFFFFF',
      icon: ShieldCheck,
    },
  }[overall_risk] || {
    badgeText: 'CALCULATING',
    color: 'var(--text-muted)',
    bg: '#FFFFFF',
    border: '#FFFFFF',
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
        background: 'var(--bg-panel)',
        // The whole panel is one scroll area; the filter chips stick once they reach the top.
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
      }}
      onScroll={onScroll}
    >
      {/* Top Header Card: Overall Risk & Summary */}
      <div
        style={{
          padding: '20px 20px 6px',
          background: 'var(--bg-panel)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Location */}
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-main)', lineHeight: 1.3 }}>
            {location}
          </h2>
          {analysis?.hierarchy?.display_hierarchy ? (
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
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
            borderRadius: '24px',
            boxShadow: 'var(--shadow-soft)',
            background: riskMeta.bg,
            border: `1px solid ${riskMeta.border}`,
          }}
        >
          {hasScore ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-1)' }}>
              <span
                style={{
                  fontSize: '56px',
                  fontWeight: 600,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  fontVariantNumeric: 'tabular-nums',
                  color: verdictColor,
                }}
              >
                {analysis.friction_score}
              </span>
              <span style={{ fontSize: 'var(--text-base)', color: 'var(--text-dim)', fontWeight: 400 }}>/100</span>
            </div>
          ) : (
            <RiskIcon size={36} color="var(--text-main)" aria-hidden="true" />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: hasScore ? verdictColor : 'var(--text-main)',
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
            background: '#FFFFFF',
            borderLeft: `3px solid ${riskMeta.border === '#FFFFFF' ? '#FFFFFF' : riskMeta.color}`,
            borderRadius: '16px',
            boxShadow: 'var(--shadow-soft)',
            padding: '10px 14px',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.5,
            color: 'var(--text-main)',
          }}
        >
          {summary}
        </div>

        {analysis.lake_check === 'unavailable' ? (
          <span
            role="status"
            title="OpenStreetMap's lake and drain lookup didn't answer in time, so lake buffers weren't checked for this scan."
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              background: 'var(--chip)',
              color: 'var(--text-main)',
              border: '1px solid rgba(30, 31, 27, 0.16)',
              borderRadius: '999px',
              padding: '3px 10px',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
            }}
          >
            <Droplets size={12} aria-hidden="true" />
            Lake check unavailable
          </span>
        ) : null}

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
              color: 'var(--text-main)',
              background: '#FFFFFF',
              border: '1px solid #FFFFFF',
              borderRadius: '16px',
              padding: 'var(--space-2) var(--space-3)',
            }}
          >
            <Info size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
            <span>Some sources didn't respond, so this scan may be incomplete. Scan again later for a fuller picture.</span>
          </div>
        ) : null}
      </div>

      {/* Category Filter Pills (sticky) */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'var(--bg-panel)',
          padding: '8px 20px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div role="group" aria-label="Filter signals by category" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                  background: active ? 'var(--accent)' : 'var(--chip)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--chip)'}`,
                  color: 'var(--text-main)',
                  padding: '6px 10px',
                  borderRadius: '999px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span>{cat.label}</span>
                <span
                  style={{
                    background: active ? 'rgba(30, 31, 27, 0.14)' : 'rgba(30, 31, 27, 0.08)',
                    borderRadius: '999px',
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
          flexShrink: 0,
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
          <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>Friction points ({filteredFlags.length})</span>
          <span>Select a card to see its source</span>
        </div>

        {filteredFlags.map((flag) => {
          const catMeta = CATEGORY_META[flag.category] || {
            label: flag.category,
            icon: AlertTriangle,
            color: '#FFFFFF',
            bg: 'rgba(255, 255, 255, 0.08)',
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
                background: isSelected ? 'var(--dark-border)' : 'var(--dark-card)',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--dark-border)'}`,
                borderLeft: `4px solid ${sev.bar}`,
                borderRadius: '16px',
                padding: '14px',
                cursor: 'pointer',
                transition: 'all 0.18s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
                boxShadow: isSelected
                  ? '0 8px 24px rgba(0, 0, 0, 0.16)'
                  : 'var(--shadow-soft)',
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
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 500,
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
                            ? 'var(--accent)'
                            : flag.proximity_tier === 'corridor'
                            ? '#FFFFFF'
                            : 'var(--muted-on-dark)',
                        background:
                          flag.proximity_tier === 'hyperlocal'
                            ? 'rgba(251, 181, 78, 0.12)'
                            : 'rgba(255, 255, 255, 0.06)',
                        border: `1px solid ${
                          flag.proximity_tier === 'hyperlocal'
                            ? 'rgba(251, 181, 78, 0.4)'
                            : 'rgba(255, 255, 255, 0.14)'
                        }`,
                        padding: '2px 7px',
                        borderRadius: '999px',
                        fontWeight: 500,
                      }}
                    >
                      {flag.distance_label}
                    </span>
                  )}
                </div>

                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: sev.color,
                    background: sev.bg,
                    boxShadow: sev.ring,
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
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: '#FFFFFF',
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
                  color: 'var(--muted-on-dark)',
                }}
              >
                {flag.explanation}
              </p>

              {/* Verified Quote Snippet */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--dark-border)',
                  borderRadius: '16px',
                  padding: '8px 10px',
                  fontSize: '11.5px',
                  color: '#FFFFFF',
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
                  borderTop: '1px solid var(--dark-border)',
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
                    color: 'var(--muted-on-dark)',
                    fontWeight: 400,
                  }}
                >
                  {domain || 'Source'}
                </span>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--accent)',
                    fontWeight: 500,
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
                    background: 'var(--chip)',
                    border: '1px solid var(--chip)',
                    color: 'var(--text-main)',
                    padding: '6px 12px',
                    borderRadius: '999px',
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
