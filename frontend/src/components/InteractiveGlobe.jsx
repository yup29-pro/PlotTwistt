import React, { useEffect, useRef } from 'react';
import { geoBounds, geoContains, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import land110m from 'world-atlas/land-110m.json';

/**
 * Dotted-continent globe: land sampled on an even ~2° grid, drawn on an orthographic
 * projection. Drag (or arrow keys) to rotate; inertia on release; slow auto-spin when idle.
 */

const INK = '30, 31, 27'; // #1E1F1B
const LINE = 'rgba(168, 168, 166, 0.45)'; // #A8A8A6
const ACCENT = '#FBB54E';
const BENGALURU = [77.59, 12.97]; // [lng, lat]
const STEP = 2; // degrees between dots
const DEG = Math.PI / 180;

// Computed once per page load, then shared by every mount.
let landDotsCache = null;

function boundsContain([[w, s], [e, n]], lng, lat) {
  if (lat < s || lat > n) return false;
  return w <= e ? lng >= w && lng <= e : lng >= w || lng <= e; // e < w: crosses the antimeridian
}

function getLandDots() {
  if (landDotsCache) return landDotsCache;
  const land = feature(land110m, land110m.objects.land);
  // Split into single polygons with their bounds so most ocean points skip the costly test.
  const polygons = [];
  for (const f of land.features) {
    const g = f.geometry;
    const parts = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    for (const coordinates of parts) {
      const poly = { type: 'Polygon', coordinates };
      polygons.push({ poly, bounds: geoBounds(poly) });
    }
  }
  const dots = [];
  for (let lat = -88; lat <= 88; lat += STEP) {
    // Widen the longitude step towards the poles so dots stay evenly spaced on the sphere.
    const lngStep = STEP / Math.max(Math.cos(lat * DEG), 0.05);
    for (let lng = -180; lng < 180; lng += lngStep) {
      const hit = polygons.some((p) => boundsContain(p.bounds, lng, lat) && geoContains(p.poly, [lng, lat]));
      if (hit) {
        const phi = lat * DEG;
        const lam = lng * DEG;
        dots.push(Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi));
      }
    }
  }
  landDotsCache = new Float32Array(dots);
  return landDotsCache;
}

export default function InteractiveGlobe({ style = {} }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const dots = getLandDots();
    const graticule = geoGraticule10();
    const projection = geoOrthographic().clipAngle(90).precision(0.5);
    const path = geoPath(projection, ctx);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    const onMotionChange = (e) => {
      reducedMotion = e.matches;
    };
    motionQuery.addEventListener('change', onMotionChange);

    let width = 0;
    let height = 0;
    let radius = 0;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth || 500;
      height = parent.clientHeight || 500;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      radius = Math.min(width, height) * 0.42;
    };
    resize();
    window.addEventListener('resize', resize);

    // View centre (degrees). Start over India.
    let lambda = 80;
    let phi = 18;
    let velLambda = 0;
    let velPhi = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastInteraction = -Infinity;
    const SPIN = 0.06; // degrees per frame when idle (~3.6°/s)
    const IDLE_MS = 2000;
    const clampPhi = (v) => Math.max(-80, Math.min(80, v));

    const degPerPx = () => 90 / Math.max(radius, 1);
    const onPointerDown = (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      velLambda = velPhi = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      const k = degPerPx();
      velLambda = -(e.clientX - lastX) * k;
      velPhi = (e.clientY - lastY) * k;
      lambda += velLambda;
      phi = clampPhi(phi + velPhi);
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteraction = performance.now();
    };
    const onPointerUp = (e) => {
      if (!dragging) return;
      dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = 'grab';
      lastInteraction = performance.now();
      if (reducedMotion) velLambda = velPhi = 0;
    };
    const onKeyDown = (e) => {
      const moves = { ArrowLeft: [10, 0], ArrowRight: [-10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
      const m = moves[e.key];
      if (!m) return;
      e.preventDefault();
      lambda -= m[0];
      phi = clampPhi(phi - m[1]);
      velLambda = velPhi = 0;
      lastInteraction = performance.now();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('keydown', onKeyDown);

    let frame = 0;
    const render = (now) => {
      if (!dragging) {
        if (Math.abs(velLambda) > 0.01 || Math.abs(velPhi) > 0.01) {
          lambda += velLambda;
          phi = clampPhi(phi + velPhi);
          velLambda *= 0.94;
          velPhi *= 0.94;
        } else if (!reducedMotion && now - lastInteraction > IDLE_MS) {
          lambda -= SPIN; // drift east-to-west like the real rotation as seen from above
        }
      }

      const cx = width / 2;
      const cy = height / 2;
      ctx.clearRect(0, 0, width, height);

      // Soft atmosphere
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.25);
      halo.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      halo.addColorStop(0.7, 'rgba(255, 255, 255, 0.12)');
      halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Graticule and outline
      projection.scale(radius).translate([cx, cy]).rotate([-lambda, -phi]);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = LINE;
      ctx.beginPath();
      path(graticule);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.stroke();

      // Dots: orthographic projection by hand (one batched path per hemisphere).
      const l0 = lambda * DEG;
      const p0 = phi * DEG;
      const cl = Math.cos(l0);
      const sl = Math.sin(l0);
      const cp = Math.cos(p0);
      const sp = Math.sin(p0);
      const back = new Path2D();
      const front = new Path2D();
      const size = Math.max(1, radius / 160);
      for (let i = 0; i < dots.length; i += 3) {
        const x = dots[i];
        const y = dots[i + 1];
        const z = dots[i + 2];
        // Rotate longitude so the view centre sits on +x, then tilt by phi.
        const xr = x * cl + y * sl;
        const yr = y * cl - x * sl;
        const depth = xr * cp + z * sp; // cos of the angle from the view centre
        const sx = cx + yr * radius;
        const sy = cy - (z * cp - xr * sp) * radius;
        const target = depth >= 0 ? front : back;
        target.moveTo(sx + size, sy);
        target.arc(sx, sy, size, 0, Math.PI * 2);
      }
      ctx.fillStyle = `rgba(${INK}, 0.08)`;
      ctx.fill(back);
      ctx.fillStyle = `rgba(${INK}, 0.85)`;
      ctx.fill(front);

      // Bengaluru pin (only when facing the viewer)
      const pin = projection(BENGALURU);
      const pinLam = BENGALURU[0] * DEG;
      const pinPhi = BENGALURU[1] * DEG;
      const facing =
        Math.cos(pinPhi) * Math.cos(pinLam - l0) * cp + Math.sin(pinPhi) * sp > 0;
      if (pin && facing) {
        const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.004);
        ctx.strokeStyle = `rgba(251, 181, 78, ${0.35 + 0.5 * (1 - pulse)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pin[0], pin[1], 7 + 7 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        ctx.arc(pin[0], pin[1], 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgb(${INK})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      motionQuery.removeEventListener('change', onMotionChange);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', ...style }}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="Globe centred on India with Bengaluru marked. Drag or use the arrow keys to rotate."
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', touchAction: 'none', borderRadius: '24px' }}
      />
    </div>
  );
}
