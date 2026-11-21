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
  Info
} from 'lucide-react';
import MapCanvas from './components/MapCanvas';
import FrictionFeed from './components/FrictionFeed';
import ReceiptDrawer from './components/ReceiptDrawer';
import {
  SAMPLE_PRESETS,
  SAMPLE_ANALYSES,
  getSampleAnalysis,
} from './data/sampleData';

export default function App() {
  // State
  const [selectedLocation, setSelectedLocation] = useState(
    SAMPLE_PRESETS[0].name
  );
  const [coordinates, setCoordinates] = useState({
    lat: SAMPLE_PRESETS[0].lat,
    lng: SAMPLE_PRESETS[0].lng,
  });
  const [intent, setIntent] = useState('warehouse');
  const [analysis, setAnalysis] = useState(SAMPLE_ANALYSES['bellandur-buffer']);
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
      const res = await fetch('http://localhost:8000/health', { method: 'GET' });
      if (res.ok) {
        setBackendConnected(true);
      } else {
        setBackendConnected(false);
      }
    } catch {
      setBackendConnected(false);
    }
  };

  // Perform Analysis Scan
  const handleScan = async () => {
    setIsLoading(true);
    setErrorNotice(null);

    // If Sample Data mode is explicitly toggled ON
    if (useSampleData) {
      setTimeout(() => {
        const sample = getSampleAnalysis(selectedLocation, intent);
        setAnalysis(sample);
        setIsLoading(false);
      }, 450);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/analyze', {
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
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      setAnalysis(data);
      setBackendConnected(true);
    } catch (err) {
      console.warn('Backend request failed; falling back to offline radar sample data:', err);
      setBackendConnected(false);
      setErrorNotice(
        'Backend server (localhost:8000) is unreachable. Automatically loaded verified offline sample data for this location.'
      );
      // Seamlessly fallback to sample data
      const sample = getSampleAnalysis(selectedLocation, intent);
      setAnalysis(sample);
    } finally {
      setIsLoading(false);
    }
  };

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

        {/* Backend & Mode Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Backend Status Indicator */}
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
        </div>
      </header>

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

      {/* Main Split Layout: Left MapCanvas, Right FrictionFeed */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(400px, 1fr) 520px',
          height: 'calc(100vh - 56px)',
          overflow: 'hidden',
        }}
      >
        {/* Left Column: MapCanvas */}
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
