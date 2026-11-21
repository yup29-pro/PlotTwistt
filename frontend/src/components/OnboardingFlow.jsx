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
import AuthCard from './AuthCard';
import useAutoHideBar from '../hooks/useAutoHideBar';

export default function OnboardingFlow({ onComplete }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navBar = useAutoHideBar(7);

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


  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-panel)',
        color: 'var(--text-main)',
        display: 'flex',
        overflowX: 'hidden',
        overflowY: 'auto',
        position: 'relative',
      }}
      onScroll={navBar.onScroll}
    >
      {/* Top Navbar */}
      <nav
        {...navBar.barProps}
        style={{
          position: 'fixed',
          transform: navBar.hidden ? 'translateY(-100%)' : 'translateY(0)',
          transition: 'transform 250ms ease',
          background: 'rgba(218, 219, 214, 0.85)',
          top: 0,
          left: 0,
          right: 0,
          height: '64px',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
          borderBottom: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
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
          <span style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em' }}>
            PlotTwistt
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--accent)',
              color: 'var(--text-main)',
              border: '1px solid var(--accent)',
              padding: '2px 8px',
              borderRadius: '999px',
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
                borderRadius: '999px',
                background: currentSlide === idx ? 'var(--accent)' : 'rgba(30, 31, 27, 0.18)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentSlide(3)}
          style={{
            background: 'var(--chip)',
            border: '1px solid var(--chip)',
            color: 'var(--text-main)',
            padding: '6px 16px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {currentSlide === 3 ? 'Account' : 'Skip intro'}
        </button>
      </nav>

      {/* Left Content Column */}
      <div
        style={{
          flex: '1 1 52%',
          minHeight: '100%',
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
                fontWeight: 500,
                letterSpacing: '0.08em',
                color: 'var(--text-main)',
                background: '#FFFFFF',
                border: '1px solid #FFFFFF',
                padding: '4px 12px',
                borderRadius: '999px',
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
                fontWeight: 600,
                lineHeight: 1.18,
                letterSpacing: '-0.03em',
                color: 'var(--text-main)',
              }}
            >
              {slides[currentSlide].title}
            </h1>

            {/* Description */}
            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.6,
                color: 'var(--text-muted)',
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
                      background: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircle size={13} color="var(--text-main)" />
                  </div>
                  <span style={{ fontSize: '13.5px', color: 'var(--text-main)', fontWeight: 400 }}>
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
                  background: 'var(--accent)',
                  border: 'none',
                  color: 'var(--text-main)',
                  padding: '12px 24px',
                  borderRadius: '999px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: 'var(--shadow-soft)',
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
                    background: 'var(--dark-card)',
                    border: '1px solid var(--dark-border)',
                    color: '#FFFFFF',
                    padding: '12px 18px',
                    borderRadius: '999px',
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
          // Slide 4: Sign in, create an account, or continue as a guest
          <AuthCard onComplete={onComplete} />
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
              'radial-gradient(circle at center, transparent 40%, rgba(218, 219, 214, 0.7) 80%, #DADBD6 100%)',
          }}
        />

      </div>
    </div>
  );
}
