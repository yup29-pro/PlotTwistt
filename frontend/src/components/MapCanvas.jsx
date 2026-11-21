import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Crosshair,
  Search,
  Building2,
  Store,
  Compass,
  Radar,
  Layers,
  Sparkles
} from 'lucide-react';
import { SAMPLE_PRESETS } from '../data/sampleData';

// Fix Leaflet's default icon path issues in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Radar Pulsing Marker Icon
function createRadarIcon(color = '#06b6d4') {
  return L.divIcon({
    className: 'custom-radar-pin',
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: ${color}; opacity: 0.25; animation: radar-pulse 1.8s infinite ease-out;"></div>
        <div style="position: absolute; width: 18px; height: 18px; border-radius: 50%; background: ${color}; opacity: 0.6;"></div>
        <div style="position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #ffffff; border: 2px solid ${color};"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function createPresetIcon() {
  return L.divIcon({
    className: 'preset-pin',
    html: `
      <div style="width: 22px; height: 22px; border-radius: 50%; background: #1e293b; border: 2px solid #94a3b8; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #38bdf8;"></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
}

export default function MapCanvas({
  selectedLocation,
  setSelectedLocation,
  coordinates,
  setCoordinates,
  intent,
  setIntent,
  onScan,
  isLoading,
  overallRisk
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const activeMarkerRef = useRef(null);
  const presetMarkersGroupRef = useRef(null);

  // Intent icons and labels
  const intents = [
    { id: 'warehouse', label: 'Warehouse / Logistics', icon: Building2 },
    { id: 'retail', label: 'Commercial Retail', icon: Store },
    { id: 'plot', label: 'Land Plot / Layout', icon: Compass },
  ];

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = coordinates.lat || 12.9352;
    const initialLng = coordinates.lng || 77.6744;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12,
      zoomControl: false,
    });

    // Dark styled OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'dark-tiles',
    }).addTo(map);

    // Zoom controls at top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Click on map to place pin
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setCoordinates({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });
      setSelectedLocation(`Custom Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update active radar marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeMarkerRef.current) {
      map.removeLayer(activeMarkerRef.current);
    }

    const pinColor =
      overallRisk === 'high'
        ? '#ef4444'
        : overallRisk === 'medium'
        ? '#f59e0b'
        : overallRisk === 'low'
        ? '#10b981'
        : '#06b6d4';

    const marker = L.marker([coordinates.lat, coordinates.lng], {
      icon: createRadarIcon(pinColor),
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
        <strong style="color: #f8fafc; font-size: 14px;">${selectedLocation}</strong><br/>
        <span style="color: #94a3b8; font-size: 11px;">${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}</span><br/>
        <span style="color: #38bdf8; font-weight: 600; text-transform: uppercase; font-size: 10px; margin-top: 4px; display: inline-block;">Target: ${intent}</span>
      </div>
    `);

    activeMarkerRef.current = marker;
    map.setView([coordinates.lat, coordinates.lng], map.getZoom(), { animate: true });
  }, [coordinates, overallRisk]);

  // Render Preset pins on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (presetMarkersGroupRef.current) {
      map.removeLayer(presetMarkersGroupRef.current);
    }

    const group = L.layerGroup();
    SAMPLE_PRESETS.forEach((preset) => {
      const marker = L.marker([preset.lat, preset.lng], {
        icon: createPresetIcon(),
      });
      marker.on('click', () => {
        handlePresetClick(preset);
      });
      marker.bindTooltip(`<strong>${preset.name}</strong><br/>${preset.description}`, {
        direction: 'top',
        className: 'preset-tooltip',
      });
      group.addLayer(marker);
    });

    group.addTo(map);
    presetMarkersGroupRef.current = group;
  }, []);

  const handlePresetClick = (preset) => {
    setSelectedLocation(preset.name);
    setCoordinates({ lat: preset.lat, lng: preset.lng });
    setIntent(preset.intent);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([preset.lat, preset.lng], 14, { duration: 1.2 });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top Search & Intent Radar HUD Bar */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '680px',
        }}
      >
        {/* Main Search Panel */}
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Location Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <MapPin size={18} color="#06b6d4" />
              <input
                type="text"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                placeholder="Search target locality or landmark..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: '14px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Coordinates Badge */}
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: '#94a3b8',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                whiteSpace: 'nowrap',
              }}
            >
              {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
            </div>

            {/* Scan Trigger Button */}
            <button
              onClick={onScan}
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: isLoading
                  ? 'var(--bg-card-alt)'
                  : 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: isLoading ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.4)',
              }}
            >
              <Radar size={16} className={isLoading ? 'pulse-radar' : ''} />
              <span>{isLoading ? 'Scanning...' : 'Scan Radar'}</span>
            </button>
          </div>

          {/* Intent Selector Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '10px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              Intent:
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {intents.map((item) => {
                const IconComponent = item.icon;
                const active = intent === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setIntent(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: active ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${active ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)'}`,
                      color: active ? '#38bdf8' : '#94a3b8',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <IconComponent size={14} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Demo Presets Quick Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px',
              color: '#94a3b8',
              fontWeight: 600,
              background: 'rgba(17, 24, 39, 0.8)',
              backdropFilter: 'blur(8px)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Sparkles size={12} color="#f59e0b" />
            Presets:
          </span>
          {SAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              style={{
                background:
                  selectedLocation === preset.name
                    ? 'rgba(6, 182, 212, 0.25)'
                    : 'rgba(17, 24, 39, 0.85)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${
                  selectedLocation === preset.name ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)'
                }`,
                color: selectedLocation === preset.name ? '#38bdf8' : '#e2e8f0',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {preset.name.split(',')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Leaflet Map Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Bottom Map Status Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          zIndex: 1000,
          background: 'rgba(10, 14, 23, 0.85)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
        <span>OpenStreetMap Live Tiles</span>
        <span>•</span>
        <span>Click anywhere on map to reposition radar target</span>
      </div>
    </div>
  );
}
