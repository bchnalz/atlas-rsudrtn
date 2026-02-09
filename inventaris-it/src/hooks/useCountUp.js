import { useEffect, useState } from 'react';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

/**
 * Hook for count-up animation
 * @param {number} end - Target number
 * @param {number} duration - Animation duration in ms (default: 2000)
 * @param {boolean} startOnView - Start animation when element is in view (default: true)
 */
export function useCountUp(end, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (hasAnimated) return;
    if (startOnView && !isInView) return;
    if (end === 0) return;

    setHasAnimated(true);

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValue + (end - startValue) * easeOut);

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration, isInView, startOnView, hasAnimated]);

  // Reset when end changes significantly
  useEffect(() => {
    if (end !== count && !hasAnimated) {
      setCount(0);
    }
  }, [end]);

  return { count, ref };
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num) {
  return num.toLocaleString('id-ID');
}
