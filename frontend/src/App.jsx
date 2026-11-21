import React, { useState, useEffect } from 'react';
import {
  Radar,
  Radio,
  SlidersHorizontal,
  Database,
  Wifi,
  WifiOff,
  AlertCircle,
  Sparkles,
  Info,
  LogOut,
  UserCheck
} from 'lucide-react';
import MapCanvas from './components/MapCanvas';
import FrictionFeed from './components/FrictionFeed';
import ReceiptDrawer from './components/ReceiptDrawer';
import OnboardingFlow from './components/OnboardingFlow';
import {
  SAMPLE_PRESETS,
  SAMPLE_ANALYSES,
  getSampleAnalysis,
} from './data/sampleData';

export default function App() {
  // Authentication & Flow State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('plottwistt_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Map & Radar States
  const [selectedLocation, setSelectedLocation] = useState(
    SAMPLE_PRESETS[0].name
  );
  const [coordinates, setCoordinates] = useState({
    lat: SAMPLE_PRESETS[0].lat,
    lng: SAMPLE_PRESETS[0].lng,
  });
  const [intent, setIntent] = useState('warehouse');
  const [analysis, setAnalysis] = useState({ ...SAMPLE_ANALYSES['bellandur-buffer'], data_source: 'demo' });
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);
  const [useSampleData, setUseSampleData] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [backendConnected, setBackendConnected] = useState(null);

  // Check backend health on initial load
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch('/api/health', { method: 'GET' });
      if (res.ok) {
        setBackendConnected(true);
      } else {
        setBackendConnected(false);
      }
    } catch {
      setBackendConnected(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('plottwistt_user');
    setCurrentUser(null);
  };

  // Perform Analysis Scan
  const handleScan = async () => {
    setIsLoading(true);
    setErrorNotice(null);

    // If Sample Data mode is explicitly toggled ON
    if (useSampleData) {
      setTimeout(() => {
        const sample = getSampleAnalysis(selectedLocation, intent);
        setAnalysis(sample ? { ...sample, data_source: 'demo' } : null);
        if (!sample) setErrorNotice('No sample data exists for this location.');
        setIsLoading(false);
      }, 450);
      return;
    }

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: selectedLocation,
          lat: coordinates.lat,
          lng: coordinates.lng,
          intent: intent,
        }),
      });

      if (!response.ok) {
        // The backend answered (e.g. 503 no data, 429 rate limit): show its message, not sample data.
        const body = await response.json().catch(() => ({}));
        const detail = typeof body.detail === 'string' ? body.detail : `Server returned HTTP ${response.status}`;
        setBackendConnected(true);
        setErrorNotice(detail);
        setAnalysis(null);
        return;
      }

      const data = await response.json();
      setAnalysis(data);
      setBackendConnected(true);
    } catch (err) {
      console.warn('Backend request failed; falling back to offline radar sample data:', err);
      setBackendConnected(false);
      // Offline sample data only exists for the demo localities.
      const sample = getSampleAnalysis(selectedLocation, intent);
      setErrorNotice(
        sample
          ? 'Backend server is unreachable. Showing offline sample data, not live results for this location.'
          : 'Backend server is unreachable and no offline sample data exists for this location.'
      );
      setAnalysis(sample ? { ...sample, data_source: 'demo' } : null);
    } finally {
      setIsLoading(false);
    }
  };

  // If user has not completed onboarding/login flow, render 3-Slide Interactive Globe + Auth
  if (!currentUser) {
    return <OnboardingFlow onComplete={(user) => setCurrentUser(user)} />;
  }

  // Once authenticated, render the full Radar Map & Audit Feed Console
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-page)',
      }}
    >
      {/* Top Application Header */}
      <header
        style={{
          height: '56px',
          padding: '0 20px',
          background: 'var(--bg-panel)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 1100,
        }}
      >
        {/* Brand & Mission Statement */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '999px',
              background: 'var(--dark-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <Radar size={20} color="#ffffff" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-main)',
                }}
              >
                PlotTwistt
              </h1>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--text-main)',
                  background: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  fontWeight: 500,
                }}
              >
                RADAR v1.0
              </span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-dim)' }}>
              Land and civic friction radar for Bengaluru sites
            </div>
          </div>
        </div>

        {/* Backend, User & Mode Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Active User Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-main)',
              background: 'var(--chip)',
              padding: '4px 10px',
              borderRadius: '999px',
              border: '1px solid var(--chip)',
            }}
          >
            <UserCheck size={14} color="var(--text-main)" />
            <span>{currentUser.name}</span>
          </div>

          {/* Backend Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--text-xs)',
              background: 'var(--chip)',
              border: '1px solid var(--chip)',
              padding: '4px 10px',
              borderRadius: '999px',
              color: 'var(--text-main)',
            }}
          >
            {backendConnected ? (
              <>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    boxShadow: '0 0 0 1px var(--text-main)',
                  }}
                />
                <span>API online</span>
              </>
            ) : (
              <>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'transparent',
                    boxShadow: 'inset 0 0 0 1.5px var(--text-muted)',
                  }}
                />
                <span>API offline</span>
              </>
            )}
          </div>

          {/* Sample Data Toggle Switch */}
          <label
            className="focus-within-ring"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              background: useSampleData
                ? 'var(--accent)'
                : 'var(--chip)',
              border: `1px solid ${
                useSampleData ? 'var(--accent)' : 'var(--chip)'
              }`,
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              color: 'var(--text-main)',
              transition: 'all 0.15s',
            }}
          >
            <Database size={14} />
            <span>Sample data {useSampleData ? 'on' : 'off'}</span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Use sample data only"
              checked={useSampleData}
              onChange={(e) => setUseSampleData(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', pointerEvents: 'none' }}
            />
          </label>

          {/* Logout / Intro Walkthrough Button */}
          <button
            onClick={handleLogout}
            title="Back to the intro"
            style={{
              background: 'var(--dark-card)',
              border: '1px solid var(--dark-border)',
              color: '#FFFFFF',
              padding: '5px 10px',
              borderRadius: '999px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <LogOut size={13} />
            <span>Intro</span>
          </button>
        </div>
      </header>

      {analysis?.data_source === 'demo' && (
        <div
          role="status"
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid var(--border-subtle)',
            color: 'var(--text-main)',
            padding: '8px 20px',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 1050,
          }}
        >
          <Info size={15} color="var(--text-main)" aria-hidden="true" />
          <span>
            <strong
              style={{
                color: 'var(--text-main)',
                background: 'var(--accent)',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: '999px',
                marginRight: '6px',
              }}
            >
              Demo
            </strong>
            These flags are curated sample data, not live search results for this site.
          </span>
        </div>
      )}

      {/* Optional Toast / Warning Alert */}
      {errorNotice && (
        <div
          role="status"
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid var(--accent)',
            color: 'var(--text-main)',
            padding: '8px 20px',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 1050,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} color="var(--text-main)" />
            <span>{errorNotice}</span>
          </div>
          <button
            onClick={() => setErrorNotice(null)}
            aria-label="Dismiss notice"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Split Layout: Left Clean MapCanvas, Right FrictionFeed */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(400px, 1fr) 520px',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left Column: MapCanvas (Clean without preset clutter) */}
        <section
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <MapCanvas
            selectedLocation={selectedLocation}
            setSelectedLocation={setSelectedLocation}
            coordinates={coordinates}
            setCoordinates={setCoordinates}
            intent={intent}
            setIntent={setIntent}
            onScan={handleScan}
            isLoading={isLoading}
            overallRisk={analysis?.overall_risk}
            lakeBufferBreach={Boolean(analysis?.lake_buffer_breach)}
          />
        </section>

        {/* Right Column: Friction Feed */}
        <section
          style={{
            height: '100%',
            borderLeft: '1px solid var(--border-subtle)',
            overflow: 'hidden',
          }}
        >
          <FrictionFeed
            analysis={analysis}
            isLoading={isLoading}
            onSelectFlag={(flag) => setSelectedFlag(flag)}
            selectedFlagId={selectedFlag?.id}
          />
        </section>
      </div>

      {/* Slide-over Evidence Receipt Drawer */}
      {selectedFlag && (
        <ReceiptDrawer
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
        />
      )}
    </div>
  );
}
