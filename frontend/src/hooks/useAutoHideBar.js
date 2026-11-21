import { useCallback, useRef, useState } from 'react';

/**
 * Website-style header: hide on scroll down, show on scroll up.
 * Attach `onScroll` to the scrolling element and `barProps` to the bar.
 * Always visible at the top, and never hidden while focus is inside the bar.
 */
export default function useAutoHideBar(threshold = 7) {
  const [hidden, setHidden] = useState(false);
  const barRef = useRef(null);
  const lastY = useRef(0);

  const onScroll = useCallback(
    (e) => {
      const y = e.currentTarget.scrollTop;
      if (y <= 0) {
        lastY.current = 0;
        setHidden(false);
        return;
      }
      const delta = y - lastY.current;
      if (Math.abs(delta) < threshold) return;
      lastY.current = y;
      const focusInside = barRef.current?.contains(document.activeElement);
      setHidden(delta > 0 && !focusInside);
    },
    [threshold]
  );

  const barProps = {
    ref: barRef,
    onFocusCapture: () => setHidden(false),
  };

  return { hidden, onScroll, barProps };
}
