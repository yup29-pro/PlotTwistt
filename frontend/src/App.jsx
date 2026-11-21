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
        background: 'var(--bg-dark)',
      }}
    >
      {/* Top Application Header */}
      <header
        style={{
          height: '56px',
          padding: '0 20px',
          background: '#0d131f',
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
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(37, 99, 235, 0.4)',
            }}
          >
            <Radar size={20} color="#ffffff" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#ffffff',
                }}
              >
                PlotTwistt
              </h1>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: '#06b6d4',
                  background: 'rgba(6, 182, 212, 0.12)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                RADAR v1.0
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Land & Civic Friction Radar // Beyond 9TO5 Buildathon
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
              color: '#cbd5e1',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <UserCheck size={14} color="#38bdf8" />
            <span>{currentUser.name}</span>
          </div>

          {/* Backend Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '4px 10px',
              borderRadius: '6px',
              color: backendConnected ? '#10b981' : '#94a3b8',
            }}
          >
            {backendConnected ? (
              <>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                  }}
                />
                <span>API ONLINE (8000)</span>
              </>
            ) : (
              <>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#eab308',
                  }}
                />
                <span>MOCK / OFFLINE MODE</span>
              </>
            )}
          </div>

          {/* Sample Data Toggle Switch */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              background: useSampleData
                ? 'rgba(56, 189, 248, 0.15)'
                : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${
                useSampleData ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'
              }`,
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              color: useSampleData ? '#38bdf8' : '#94a3b8',
              transition: 'all 0.15s',
            }}
          >
            <Database size={14} />
            <span>Sample Data Only</span>
            <input
              type="checkbox"
              checked={useSampleData}
              onChange={(e) => setUseSampleData(e.target.checked)}
              style={{ display: 'none' }}
            />
          </label>

          {/* Logout / Intro Walkthrough Button */}
          <button
            onClick={handleLogout}
            title="Return to Presentation / Logout"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              padding: '5px 10px',
              borderRadius: '6px',
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
            background: 'rgba(239, 68, 68, 0.15)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fecaca',
            padding: '8px 20px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 1050,
          }}
        >
          <AlertCircle size={15} color="#ef4444" />
          <span>
            <strong>DEMO DATA</strong> &mdash; these flags are curated sample data, not live search results for this site.
          </span>
        </div>
      )}

      {/* Optional Toast / Warning Alert */}
      {errorNotice && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.15)',
            borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#fef08a',
            padding: '8px 20px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 1050,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} color="#eab308" />
            <span>{errorNotice}</span>
          </div>
          <button
            onClick={() => setErrorNotice(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fef08a',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
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
          height: 'calc(100vh - 56px)',
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
