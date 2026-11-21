import React, { useEffect, useRef, useState } from 'react';
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
const SUGGEST_MIN_CHARS = 2;
const SUGGEST_DEBOUNCE_MS = 250;

// Bold the part of `text` that matches `query` (case-insensitive); fuzzy hits stay plain.
function HighlightMatch({ text, query }) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <span>{text}</span>;
  const end = i + q.length;
  return (
    <span>
      {text.slice(0, i)}
      <strong style={{ fontWeight: 700 }}>{text.slice(i, end)}</strong>
      {text.slice(end)}
    </span>
  );
}

// Selected pin: dark-glass badge, white icon, accent ring and a small accent badge with the risk letter (H / M / L).
function createRadarIcon(label = '') {
  return L.divIcon({
    className: 'custom-radar-pin',
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(30,31,27,0.55); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 2px solid #FBB54E; box-shadow: 0 8px 24px rgba(0,0,0,0.25);"></div>
        <svg style="position: relative;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        ${label ? `<span style="position: absolute; top: -5px; right: -6px; min-width: 15px; height: 15px; padding: 0 4px; border-radius: 999px; background: #FBB54E; color: #1E1F1B; font: 600 9px/15px Urbanist, sans-serif; text-align: center;">${label}</span>` : ''}
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
      <div style="width: 22px; height: 22px; border-radius: 50%; background: rgba(30,31,27,0.55); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(0,0,0,0.08);">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #FFFFFF;"></div>
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
  overallRisk,
  lakeBufferBreach = false
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const activeMarkerRef = useRef(null);
  const bufferCircleRef = useRef(null);
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

    // Esri World Imagery (satellite) tiles
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
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

    // Keep tiles filling the container when the layout around it changes (e.g. the header hides).
    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeFrame);
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
    if (bufferCircleRef.current) {
      map.removeLayer(bufferCircleRef.current);
      bufferCircleRef.current = null;
    }
    // Typed place without a picked suggestion: no pin until the backend looks it up.
    if (coordinates.lat == null || coordinates.lng == null) {
      activeMarkerRef.current = null;
      return;
    }
    // Red 75 m NGT buffer ring when OpenStreetMap puts a lake inside it.
    if (lakeBufferBreach) {
      bufferCircleRef.current = L.circle([coordinates.lat, coordinates.lng], {
        radius: 75,
        color: '#FBB54E',
        weight: 3,
        dashArray: '6 4',
        fillColor: '#FBB54E',
        fillOpacity: 0.12,
      })
        .bindTooltip('Inside 75 m lake buffer', {
          permanent: true,
          direction: 'top',
          offset: [0, -8],
          className: 'buffer-tooltip',
        })
        .addTo(map);
    }

    const pinLabel =
      overallRisk === 'high'
        ? 'H'
        : overallRisk === 'medium'
        ? 'M'
        : overallRisk === 'low'
        ? 'L'
        : '';

    const marker = L.marker([coordinates.lat, coordinates.lng], {
      icon: createRadarIcon(pinLabel),
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
        <strong style="color: #1E1F1B; font-size: 14px; font-weight: 600; letter-spacing: -0.01em;">${selectedLocation}</strong><br/>
        <span style="color: #5E5F5A; font-size: 11px;">${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}</span><br/>
        <span style="color: #1E1F1B; background: #FBB54E; border-radius: 999px; padding: 0 6px; font-weight: 500; text-transform: uppercase; font-size: 10px; margin-top: 4px; display: inline-block;">Target: ${intent}</span>
      </div>
    `);

    activeMarkerRef.current = marker;
    map.setView([coordinates.lat, coordinates.lng], map.getZoom(), { animate: true });
  }, [coordinates, overallRisk, lakeBufferBreach]);

  // Render Preset pins on map (DISABLED: clean map display per option 2)
  useEffect(() => {
    // Keep presets hidden to prevent cluttering custom address scans
  }, []);

  const handlePresetClick = (preset) => {
    setSelectedLocation(preset.name);
    setCoordinates({ lat: preset.lat, lng: preset.lng });
    setIntent(preset.intent);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([preset.lat, preset.lng], 14, { duration: 1.2 });
    }
  };

  // ---- Search suggestions (ARIA combobox) ----
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [typedQuery, setTypedQuery] = useState('');
  const searchBoxRef = useRef(null);

  // Debounced fetch, only for text the user typed (not presets, map clicks or picks).
  useEffect(() => {
    const q = typedQuery.trim();
    if (q.length < SUGGEST_MIN_CHARS) {
      setSuggestions([]);
      setSuggestOpen(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const items = await res.json();
        const list = Array.isArray(items) ? items : [];
        setSuggestions(list);
        setActiveIndex(-1);
        setSuggestOpen(list.length > 0);
      } catch {
        // Aborted or offline: the box still works without suggestions.
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typedQuery]);

  // Clicking outside closes the list.
  useEffect(() => {
    if (!suggestOpen) return undefined;
    const onPointerDown = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) setSuggestOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [suggestOpen]);

  const closeSuggestions = () => {
    setSuggestOpen(false);
    setActiveIndex(-1);
  };

  // Esc or a scan also cancels a lookup still in flight, so a late reply can't reopen the list.
  const dismissSuggestions = () => {
    closeSuggestions();
    setTypedQuery('');
  };

  const handleSearchInput = (value) => {
    setSelectedLocation(value);
    // Typed without picking: clear the pin so the backend geocodes the text.
    setCoordinates({ lat: null, lng: null });
    setTypedQuery(value);
  };

  const pickSuggestion = (item) => {
    closeSuggestions();
    setTypedQuery('');
    setSelectedLocation(item.name);
    setCoordinates({ lat: item.lat, lng: item.lng });
    if (mapInstanceRef.current) mapInstanceRef.current.flyTo([item.lat, item.lng], 14, { duration: 1 });
    onScan({ name: item.name, lat: item.lat, lng: item.lng });
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!suggestions.length) return;
      setSuggestOpen(true);
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!suggestions.length) return;
      setSuggestOpen(true);
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (suggestOpen && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        pickSuggestion(suggestions[activeIndex]);
      } else {
        closeSuggestions();
      }
    } else if (e.key === 'Escape') {
      if (suggestOpen) e.preventDefault();
      dismissSuggestions();
    }
  };

  const hasCoords = coordinates.lat != null && coordinates.lng != null;
  const listboxId = 'site-suggestions';
  const optionId = (i) => `site-suggestion-${i}`;

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
            background: 'var(--glass)',
            backdropFilter: 'var(--glass-filter)',
            WebkitBackdropFilter: 'var(--glass-filter)',
            border: '1px solid var(--glass-border)',
            borderRadius: '24px',
            padding: '12px 16px',
            boxShadow: 'var(--shadow-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            position: 'relative',
            zIndex: 2, // keeps the suggestion list above the preset row
          }}
        >
          {/* Location Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div ref={searchBoxRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, position: 'relative' }}>
              <MapPin size={18} color="#FFFFFF" aria-hidden="true" />
              <input
                type="text"
                role="combobox"
                aria-expanded={suggestOpen}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={suggestOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                autoComplete="off"
                spellCheck={false}
                value={selectedLocation}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search a locality or landmark"
                aria-label="Site to scan"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  textShadow: 'var(--glass-text-shadow)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                }}
              />
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Suggested places"
                hidden={!suggestOpen}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 16px)',
                  left: '-8px',
                  right: '-8px',
                  listStyle: 'none',
                  margin: 0,
                  padding: '6px',
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'var(--glass-filter)',
                  WebkitBackdropFilter: 'var(--glass-filter)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '16px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
                  zIndex: 10,
                }}
              >
                {suggestions.map((item, i) => (
                  <li
                    key={`${item.name}-${item.lat}-${item.lng}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === activeIndex}
                    onPointerDown={(e) => e.preventDefault() /* keep focus in the input */}
                    onClick={() => pickSuggestion(item)}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: i === activeIndex ? 'var(--chip)' : 'transparent',
                      boxShadow: i === activeIndex ? 'inset 0 0 0 1px var(--accent)' : 'none',
                      color: 'var(--text-main)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 400,
                    }}
                  >
                    <HighlightMatch text={item.name} query={typedQuery} />
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {item.area}
                    </span>
                  </li>
                ))}
              </ul>
              <span
                role="status"
                aria-live="polite"
                style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
              >
                {suggestOpen ? `${suggestions.length} suggestions. Use the up and down arrows to choose.` : ''}
              </span>
            </div>

            {/* Coordinates Badge */}
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-main)',
                background: '#FFFFFF',
                padding: '4px 8px',
                borderRadius: '999px',
                border: '1px solid #FFFFFF',
                whiteSpace: 'nowrap',
              }}
            >
              {hasCoords ? `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}` : 'Located on scan'}
            </div>

            {/* Scan Trigger Button */}
            <button
              onClick={() => {
                dismissSuggestions();
                onScan();
              }}
              disabled={isLoading}
              aria-busy={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: isLoading ? 'var(--chip)' : 'var(--accent)',
                color: isLoading ? 'var(--text-muted)' : 'var(--text-main)',
                border: `1px solid ${isLoading ? 'var(--chip)' : 'var(--accent)'}`,
                padding: '10px 18px',
                borderRadius: '999px',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: isLoading ? 'none' : 'var(--shadow-soft)',
              }}
            >
              <Radar size={16} className={isLoading ? 'pulse-radar' : ''} />
              <span>{isLoading ? 'Scanning…' : 'Scan this site'}</span>
            </button>
          </div>

          {/* Intent Selector Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTop: '1px solid var(--glass-border)',
              paddingTop: '10px',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: '#FFFFFF',
                textShadow: 'var(--glass-text-shadow)',
                fontWeight: 400,
              }}
            >
              Evaluating for
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {intents.map((item) => {
                const IconComponent = item.icon;
                const active = intent === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setIntent(item.id)}
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
                      fontSize: 'var(--text-sm)',
                      fontWeight: active ? 600 : 400,
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
              color: '#FFFFFF',
              textShadow: 'var(--glass-text-shadow)',
              fontWeight: 400,
              background: 'var(--glass)',
              backdropFilter: 'var(--glass-filter)',
              WebkitBackdropFilter: 'var(--glass-filter)',
              padding: '4px 8px',
              borderRadius: '999px',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Sparkles size={12} color="var(--accent)" aria-hidden="true" />
            Try a demo site
          </span>
          {SAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              aria-pressed={selectedLocation === preset.name}
              style={{
                background:
                  selectedLocation === preset.name
                    ? 'var(--accent)'
                    : 'var(--glass)',
                backdropFilter: 'var(--glass-filter)',
                WebkitBackdropFilter: 'var(--glass-filter)',
                border: `1px solid ${
                  selectedLocation === preset.name ? 'var(--accent)' : 'var(--glass-border)'
                }`,
                color: selectedLocation === preset.name ? 'var(--text-main)' : '#FFFFFF',
                textShadow: selectedLocation === preset.name ? 'none' : 'var(--glass-text-shadow)',
                padding: '6px 10px',
                borderRadius: '999px',
                fontSize: 'var(--text-xs)',
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
      {/* Fog haze over the imagery (decorative, never intercepts clicks) */}
      <div className="map-fog" aria-hidden="true" />

      {/* Bottom Map Status Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          zIndex: 1000,
          background: '#FFFFFF',
          border: '1px solid #FFFFFF',
          borderRadius: '999px',
          padding: '4px 10px',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-main)',
          boxShadow: 'var(--shadow-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }}></span>
        <span>Imagery © Esri. Click the map to move the pin.</span>
      </div>
    </div>
  );
}
