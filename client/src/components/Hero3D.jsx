import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';

const LINES = [92, 78, 100, 64, 88, 55];
const HARD = new Set([2]); // which line is "highlighted"

function Page({ z, shade, children }) {
  return (
    <div
      className="absolute inset-0 rounded-xl border border-stone-200 p-5 shadow-lg"
      style={{ transform: `translateZ(${z}px)`, background: shade, backfaceVisibility: 'hidden' }}
    >
      {children}
    </div>
  );
}

/** Decorative 3D page stack that follows the pointer. Purely visual (aria-hidden). */
export default function Hero3D() {
  const reduce = useReducedMotion();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const sx = useSpring(x, { stiffness: 90, damping: 16 });
  const sy = useSpring(y, { stiffness: 90, damping: 16 });
  const rotateY = useTransform(sx, [0, 1], [-48, 8]);
  const rotateX = useTransform(sy, [0, 1], [22, -12]);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width);
    y.set((e.clientY - r.top) / r.height);
  };

  return (
    <div
      aria-hidden="true"
      onPointerMove={reduce ? undefined : onMove}
      className="relative mx-auto h-56 w-full max-w-sm select-none sm:h-64"
      style={{ perspective: 900 }}
    >
      <motion.div
        className="relative mx-auto h-full w-44 sm:w-52"
        style={{ rotateX: reduce ? 10 : rotateX, rotateY: reduce ? -28 : rotateY, transformStyle: 'preserve-3d' }}
        animate={reduce ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Page z={-80} shade="#e7e5e4" />
        <Page z={-40} shade="#f5f5f4" />
        <Page z={0} shade="#ffffff">
          <div className="mb-3 h-2.5 w-1/2 rounded bg-stone-800" />
          <div className="space-y-2.5">
            {LINES.map((w, i) => (
              <motion.div
                key={i}
                className={`h-2 rounded ${HARD.has(i) ? 'bg-amber-400' : 'bg-stone-300'}`}
                style={{ width: `${w}%`, transformOrigin: 'left' }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.15 * i, duration: 0.5, ease: 'easeOut' }}
              />
            ))}
          </div>
          <div className="absolute bottom-4 right-4 flex size-12 items-center justify-center rounded-full bg-amber-700 text-lg font-bold text-white shadow-md" style={{ transform: 'translateZ(40px)' }}>
            72
          </div>
        </Page>
      </motion.div>
    </div>
  );
}
