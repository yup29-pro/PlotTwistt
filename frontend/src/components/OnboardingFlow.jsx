import React, { useState } from 'react';
import {
  Radar,
  ArrowRight,
  ShieldAlert,
  Search,
  FileCheck2,
  Lock,
  ChevronRight,
  Compass,
  CheckCircle,
  Sparkles,
  Users
} from 'lucide-react';
import InteractiveGlobe from './InteractiveGlobe';

export default function OnboardingFlow({ onComplete }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [name, setName] = useState('');

  const slides = [
    {
      badge: 'BEYOND 9TO5 BUILDATHON • RADAR v1.0',
      title: 'Uncover Real-World Land & Civic Friction Before You Buy',
      description:
        'Real-estate listings hide catastrophic site roadblocks. PlotTwistt scans monsoon waterlogging channels, statutory lake buffers, illegal layout notices, and heavy vehicle curfews in real time.',
      highlights: [
        'Instant pin-drop site radar anywhere in Bengaluru',
        'Zoning, drainage, road access, and legal conflict detection',
        'Multi-angle live search powered by SerpApi & You.com',
      ],
      cta: 'Explore How It Works',
    },
    {
      badge: 'MULTI-DIMENSIONAL RADAR',
      title: 'How PlotTwistt Investigates Any Local Site',
      description:
        'Select your intent—Warehouse, Commercial Retail, or Land Plot. Our engine probes hyper-local police logs, municipal gazettes, NGT buffer maps, and local road accidents within your exact radial sector.',
      highlights: [
        'Hierarchical Address Resolution: Locality ❯ Corridor ❯ City',
        'Radial Distance Tagging: Events indexed by exact proximity (~0.4 km)',
        'Noise, traffic towing, power shutdowns, & BDA dispute surveillance',
      ],
      cta: 'See Receipt Trail Proof',
    },
    {
      badge: 'VERIFIABLE CITATION ENGINE',
      title: 'Every Warning Backed by an Indisputable Receipt Trail',
      description:
        'No hallucinated risks. Every friction flag quotes exact verbatim excerpts from verified news publications, High Court rulings, and BBMP municipal notifications with one-click direct links.',
      highlights: [
        'Verbatim quotes cited with source publisher & timestamp',
        'Direct clickable receipts from The Hindu, Deccan Herald, Times of India',
        'Smart caching: repeat scans of the same site are served from disk',
      ],
      cta: 'Continue to Access Radar',
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setCurrentSlide(3); // Go to login/signup slide
    }
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    // Demo profile only: no account, no password, stored in this browser.
    const userProfile = { name: name.trim() || 'Investigator' };
    localStorage.setItem('plottwistt_user', JSON.stringify(userProfile));
    onComplete(userProfile);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(circle at 70% 30%, #0f1c30 0%, #070b14 100%)',
        color: '#f8fafc',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top Navbar */}
      <nav
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '64px',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 18px rgba(37, 99, 235, 0.45)',
            }}
          >
            <Radar size={20} color="#ffffff" />
          </div>
          <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            PlotTwistt
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '2px 8px',
              borderRadius: '12px',
            }}
          >
            RADAR v1.0
          </span>
        </div>

        {/* Slide Indicator Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              style={{
                width: currentSlide === idx ? '28px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: currentSlide === idx ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentSlide(3)}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#f8fafc',
            padding: '6px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {currentSlide === 3 ? 'Demo profile' : 'Skip intro'}
        </button>
      </nav>

      {/* Left Content Column */}
      <div
        style={{
          flex: '1 1 52%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 48px 40px 64px',
          zIndex: 10,
          maxWidth: '660px',
        }}
      >
        {currentSlide < 3 ? (
          // Slides 1, 2, and 3
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Category / Badge */}
            <div
              style={{
                alignSelf: 'flex-start',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '4px 12px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={13} />
              <span>{slides[currentSlide].badge}</span>
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: '36px',
                fontWeight: 800,
                lineHeight: 1.18,
                letterSpacing: '-0.03em',
                color: '#ffffff',
              }}
            >
              {slides[currentSlide].title}
            </h1>

            {/* Description */}
            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.6,
                color: '#94a3b8',
              }}
            >
              {slides[currentSlide].description}
            </p>

            {/* Feature Bullets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
              {slides[currentSlide].highlights.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircle size={13} color="#38bdf8" />
                  </div>
                  <span style={{ fontSize: '13.5px', color: '#e2e8f0', fontWeight: 500 }}>
                    {h}
                  </span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
              <button
                onClick={handleNext}
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 0 24px rgba(37, 99, 235, 0.45)',
                  transition: 'all 0.18s ease',
                }}
              >
                <span>{slides[currentSlide].cta}</span>
                <ArrowRight size={16} />
              </button>

              {currentSlide > 0 && (
                <button
                  onClick={() => setCurrentSlide(currentSlide - 1)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#94a3b8',
                    padding: '12px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Previous
                </button>
              )}
            </div>
          </div>
        ) : (
          // Slide 4: Demo profile (no account)
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '36px',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: '#7dd3fc',
                  fontWeight: 600,
                  marginBottom: 'var(--space-1)',
                }}
              >
                Demo profile
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff' }}>
                Start the radar demo
              </h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                No account needed. Your name is only kept in this browser to label the console.
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px', display: 'block' }}>
                  Your name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Site analyst"
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: 'var(--text-base)',
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '6px',
                  boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)',
                }}
              >
                Continue with demo profile (no account needed)
              </button>
            </form>

          </div>
        )}
      </div>

      {/* Right Column: 3D Dotted Interactive Globe */}
      <div
        style={{
          flex: '1 1 48%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <InteractiveGlobe />

        {/* Ambient Overlay Vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at center, transparent 30%, rgba(7, 11, 20, 0.7) 80%, #070b14 100%)',
          }}
        />

        {/* Floating live radar indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '48px',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '10px',
            padding: '12px 18px',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 10px #10b981',
            }}
          />
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Interactive globe
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
              Drag globe to rotate 3D view
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
