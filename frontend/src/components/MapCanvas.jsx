import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Crosshair,
  Search,
  Building2,
  Store,
  Compass,
  Home,
  Radar,
  Sparkles,
  Link2,
  ExternalLink,
  Loader2,
  X,
  AlertCircle
} from 'lucide-react';
import { SAMPLE_PRESETS } from '../data/sampleData';
import {
  parseCoordinates,
  parseGoogleMapsUrl,
  classifyInput,
  searchNominatim,
  reverseGeocodeNominatim,
} from '../utils/locationParser';

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
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: ${color}; opacity: 0.25; animation: radar-pulse 1.8s infinite ease-out;"></div>
        <div style="position: absolute; width: 20px; height: 20px; border-radius: 50%; background: ${color}; opacity: 0.6;"></div>
        <div style="position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #ffffff; border: 2px solid ${color};"></div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
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
  overallRisk,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const activeMarkerRef = useRef(null);
  const presetMarkersGroupRef = useRef(null);

  // Search & parser states
  const [searchInput, setSearchInput] = useState(selectedLocation || '');
  const [detectedMode, setDetectedMode] = useState('place');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unresolvedNotice, setUnresolvedNotice] = useState(null);

  const searchAbortRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Intent configurations
  const intents = [
    { id: 'flat_rent', label: 'Flat / Rent', icon: Home, queryContext: 'flat apartment rent' },
    { id: 'warehouse', label: 'Warehouse / Logistics', icon: Building2, queryContext: 'warehouse logistics' },
    { id: 'retail', label: 'Commercial Retail', icon: Store, queryContext: 'retail commercial showroom' },
    { id: 'plot', label: 'Land Plot / Layout', icon: Compass, queryContext: 'plot land layout' },
  ];

  // Sync search input when selectedLocation changes externally
  useEffect(() => {
    if (selectedLocation && selectedLocation !== searchInput) {
      setSearchInput(selectedLocation);
      setDetectedMode(classifyInput(selectedLocation));
    }
  }, [selectedLocation]);

  // Handle Input Changes with Instant Parsing & Debounced Geocoding
  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    setUnresolvedNotice(null);

    // 1. Check for Raw Coordinates
    const coords = parseCoordinates(val);
    if (coords) {
      setDetectedMode('coords');
      setCoordinates({ lat: coords.lat, lng: coords.lng });
      setSelectedLocation(coords.label);
      setSuggestions([]);
      setShowDropdown(false);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([coords.lat, coords.lng], 15, { duration: 1.0 });
      }
      return;
    }

    // 2. Check for Google Maps URLs
    const maps = parseGoogleMapsUrl(val);
    if (maps) {
      setDetectedMode(maps.mode);
      if (maps.lat && maps.lng) {
        setCoordinates({ lat: maps.lat, lng: maps.lng });
        setSelectedLocation(maps.label);
        setSuggestions([]);
        setShowDropdown(false);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([maps.lat, maps.lng], 15, { duration: 1.0 });
        }
      } else {
        // Unresolved shortlink
        setSelectedLocation(maps.label || val);
        setUnresolvedNotice(
          'Google Maps shortlink detected: Map remains centered while backend radar scans location signals from link.'
        );
      }
      return;
    }

    // 3. Fallback: Place / Apartment / Locality Text Query
    setDetectedMode('place');
    setSelectedLocation(val);

    // Auto-detect rental or flat keywords to auto-set intent
    const valLower = val.toLowerCase();
    if (
      valLower.includes('flat') ||
      valLower.includes('rent') ||
      valLower.includes('apartment') ||
      valLower.includes('sunrise park')
    ) {
      if (intent !== 'flat_rent') {
        setIntent('flat_rent');
      }
    }

    // Debounced Nominatim autocomplete search
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length >= 3) {
      debounceTimerRef.current = setTimeout(async () => {
        if (searchAbortRef.current) {
          searchAbortRef.current.abort();
        }
        searchAbortRef.current = new AbortController();
        setIsSearchingPlaces(true);

        const results = await searchNominatim(val, searchAbortRef.current.signal);
        setIsSearchingPlaces(false);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      }, 400);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
      setIsSearchingPlaces(false);
    }
  };

  // Handle Suggestion Selection
  const handleSelectSuggestion = (item) => {
    setSearchInput(item.name || item.display_name.split(',')[0]);
    setSelectedLocation(item.display_name);
    setCoordinates({ lat: item.lat, lng: item.lng });
    setSuggestions([]);
    setShowDropdown(false);
    setDetectedMode('place');

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([item.lat, item.lng], 15, { duration: 1.2 });
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = coordinates.lat || 12.8456;
    const initialLng = coordinates.lng || 77.6489;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
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

    // Map Click: drop pin and reverse geocode location name
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      const cleanLat = Number(lat.toFixed(5));
      const cleanLng = Number(lng.toFixed(5));

      setCoordinates({ lat: cleanLat, lng: cleanLng });
      setDetectedMode('coords');

      // Immediate coordinate placeholder
      const tempLabel = `Pinned Point (${cleanLat.toFixed(4)}, ${cleanLng.toFixed(4)})`;
      setSelectedLocation(tempLabel);
      setSearchInput(tempLabel);

      // Smooth reverse geocoding to retrieve human-readable address
      const geoResult = await reverseGeocodeNominatim(cleanLat, cleanLng);
      if (geoResult && geoResult.short_label) {
        setSelectedLocation(geoResult.short_label);
        setSearchInput(geoResult.short_label);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update active radar marker when coordinates or risk changes
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
        <span style="color: #38bdf8; font-weight: 600; text-transform: uppercase; font-size: 10px; margin-top: 4px; display: inline-block;">Target Intent: ${intent.replace(/_/g, ' ')}</span>
      </div>
    `);

    activeMarkerRef.current = marker;
  }, [coordinates, overallRisk, selectedLocation, intent]);

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
    setSearchInput(preset.name);
    setSelectedLocation(preset.name);
    setCoordinates({ lat: preset.lat, lng: preset.lng });
    setIntent(preset.intent || 'warehouse');
    setDetectedMode('place');
    setSuggestions([]);
    setShowDropdown(false);
    setUnresolvedNotice(null);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([preset.lat, preset.lng], 14, { duration: 1.2 });
    }
  };

  // Clear search input
  const handleClear = () => {
    setSearchInput('');
    setSuggestions([]);
    setShowDropdown(false);
    setUnresolvedNotice(null);
  };

  // Render mode indicator badge
  const renderModeBadge = () => {
    switch (detectedMode) {
      case 'coords':
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '2px 7px',
              borderRadius: '5px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            <Crosshair size={12} />
            <span>Coords</span>
          </span>
        );
      case 'maps_link':
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '2px 7px',
              borderRadius: '5px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            <Link2 size={12} />
            <span>Maps Link</span>
          </span>
        );
      case 'maps_link_unresolved':
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: '#f59e0b',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '2px 7px',
              borderRadius: '5px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            <ExternalLink size={12} />
            <span>Shortlink</span>
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: '#94a3b8',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '2px 7px',
              borderRadius: '5px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            <MapPin size={12} />
            <span>Place / Flat</span>
          </span>
        );
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
          maxWidth: '720px',
        }}
      >
        {/* Main Search Panel */}
        <div
          style={{
            background: 'rgba(17, 24, 39, 0.94)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            position: 'relative',
          }}
        >
          {/* Location / Coords / Maps Link Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              {isSearchingPlaces ? (
                <Loader2 size={18} color="#06b6d4" className="pulse-radar" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Search size={18} color="#06b6d4" />
              )}
              
              <input
                type="text"
                value={searchInput}
                onChange={handleInputChange}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                placeholder="Search flat/apartment (e.g. Prestige Sunrise Park, Neeladri Nagar), coordinates, or paste Google Maps link..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  textOverflow: 'ellipsis',
                }}
              />

              {searchInput && (
                <button
                  onClick={handleClear}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Clear input"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Live Detected Mode Badge */}
            {renderModeBadge()}

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
                whiteSpace: 'nowrap',
              }}
            >
              <Radar size={16} className={isLoading ? 'pulse-radar' : ''} />
              <span>{isLoading ? 'Scanning...' : 'Scan Radar'}</span>
            </button>
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '56px',
                left: '16px',
                right: '16px',
                background: '#0d131f',
                border: '1px solid var(--border-active)',
                borderRadius: '8px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.75)',
                maxHeight: '240px',
                overflowY: 'auto',
                zIndex: 1500,
              }}
            >
              <div
                style={{
                  padding: '6px 12px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                OpenStreetMap Matching Locations
              </div>
              {suggestions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectSuggestion(item)}
                  className="autocomplete-item"
                  style={{
                    padding: '9px 12px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={13} color="#38bdf8" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: '#64748b',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                      }}
                    >
                      {item.type || 'place'}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#94a3b8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.display_name}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unresolved Maps Link Notice */}
          {unresolvedNotice && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11.5px',
                color: '#fef08a',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                padding: '6px 10px',
                borderRadius: '6px',
              }}
            >
              <AlertCircle size={14} color="#eab308" />
              <span>{unresolvedNotice}</span>
            </div>
          )}

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
              background: 'rgba(17, 24, 39, 0.85)',
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
            Quick Presets:
          </span>
          {SAMPLE_PRESETS.map((preset) => {
            const isSelected = selectedLocation === preset.name || searchInput === preset.name;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                style={{
                  background: isSelected
                    ? 'rgba(6, 182, 212, 0.25)'
                    : 'rgba(17, 24, 39, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: `1px solid ${
                    isSelected ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)'
                  }`,
                  color: isSelected ? '#38bdf8' : '#e2e8f0',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{preset.name.split(',')[0]}</span>
                {preset.id === 'neeladri-flat-rent' && (
                  <span
                    style={{
                      fontSize: '9px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      padding: '1px 4px',
                      borderRadius: '3px',
                    }}
                  >
                    HOT
                  </span>
                )}
              </button>
            );
          })}
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
        <span>Click anywhere on map to pin & reverse-geocode location</span>
      </div>
    </div>
  );
}
