import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

/** Counts up to `value`. Shows the final value immediately for reduced-motion users. */
export default function AnimatedNumber({ value, decimals = 1, duration = 1 }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return undefined;
    }
    const controls = animate(0, value, { duration, ease: 'easeOut', onUpdate: setDisplay });
    return () => controls.stop();
  }, [value, reduce, duration]);

  return <>{display.toFixed(decimals)}</>;
}
