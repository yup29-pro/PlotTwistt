import React, { useEffect, useRef } from 'react';

/**
 * Interactive 3D Dotted Rotating Earth Globe (Canvas based, zero heavy dependencies)
 * Matching the exact dark-blue futuristic aesthetic in the inspiration screenshot.
 */
export default function InteractiveGlobe({ style = {} }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = canvas.parentElement.clientWidth || 500);
    let height = (canvas.height = canvas.parentElement.clientHeight || 500);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate dotted sphere points
    const points = [];
    const count = 750;
    const radius = Math.min(width, height) * 0.42;

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      points.push({
        x: radius * Math.cos(theta) * Math.sin(phi),
        y: radius * Math.sin(theta) * Math.sin(phi),
        z: radius * Math.cos(phi),
        baseX: radius * Math.cos(theta) * Math.sin(phi),
        baseY: radius * Math.sin(theta) * Math.sin(phi),
        baseZ: radius * Math.cos(phi),
      });
    }

    let angleX = 0.25; // slight isometric tilt
    let angleY = 0;
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      angleY += deltaX * 0.005;
      angleX += deltaY * 0.005;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Render loop
    const render = () => {
      if (!isDragging) {
        angleY += 0.0035; // gentle continuous rotation
      }

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Outer atmosphere halo
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.25);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.12)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Latitude grid rings
      const rings = [-0.5, -0.25, 0, 0.25, 0.5];
      rings.forEach((rFactor) => {
        const ringRadius = radius * Math.cos(rFactor * Math.PI * 0.5);
        const ringY = radius * Math.sin(rFactor * Math.PI * 0.5);

        ctx.strokeStyle = 'rgba(30, 31, 27, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy + ringY * Math.cos(angleX), ringRadius, ringRadius * 0.3 * Math.sin(angleX + 1), 0, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Project and draw 3D points
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      // Sort points from back to front for proper depth
      const projected = points.map((p) => {
        // Y-axis rotation
        let x1 = p.baseX * cosY - p.baseZ * sinY;
        let z1 = p.baseZ * cosY + p.baseX * sinY;

        // X-axis rotation (tilt)
        let y2 = p.baseY * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.baseY * sinX;

        return {
          x: cx + x1,
          y: cy + y2,
          z: z2,
          depth: (z2 + radius) / (2 * radius),
        };
      });

      projected.sort((a, b) => a.z - b.z);

      projected.forEach((p) => {
        // Depth-based size and opacity (closer = brighter cyan, farther = faint slate)
        const alpha = Math.max(0.12, Math.min(0.95, p.depth * 1.1));
        const size = Math.max(1.2, p.depth * 3.2);

        ctx.fillStyle = `rgba(30, 31, 27, ${alpha})`;
        ctx.shadowColor = 'rgba(30, 31, 27, 0)';
        ctx.shadowBlur = p.depth > 0.6 ? 6 : 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Reset shadow
      ctx.shadowBlur = 0;

      // Pulsing radar target ping on Bangalore coordinates
      const pingAlpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
      ctx.strokeStyle = `rgba(251, 181, 78, ${pingAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + radius * 0.35, cy - radius * 0.15, 8 + 6 * (1 - pingAlpha), 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FBB54E';
      ctx.beginPath();
      ctx.arc(cx + radius * 0.35, cy - radius * 0.15, 4, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', ...style }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
