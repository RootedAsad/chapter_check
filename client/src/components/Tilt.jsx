import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

/**
 * Wraps content in a card that tilts in 3D toward the pointer.
 * Disabled for reduced-motion users and for touch (no hover).
 */
export default function Tilt({ children, max = 4, className = '', as = 'div' }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const Comp = motion[as];

  if (reduce) return <Comp className={className}>{children}</Comp>;

  const onMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width);
    y.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    x.set(0.5);
    y.set(0.5);
  };

  return (
    <div style={{ perspective: 1100 }} className="h-full">
      <Comp
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className={`${className} will-change-transform`}
      >
        {children}
      </Comp>
    </div>
  );
}
