import confetti from 'canvas-confetti';

// Ensure HTMLCanvasElement prototype has getBoundingClientRect in any browser environment
if (typeof window !== 'undefined') {
  try {
    if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getBoundingClientRect) {
      HTMLCanvasElement.prototype.getBoundingClientRect = function(): DOMRect {
        const w = (this as HTMLCanvasElement).width || window.innerWidth || 0;
        const h = (this as HTMLCanvasElement).height || window.innerHeight || 0;
        return {
          top: 0,
          left: 0,
          right: w,
          bottom: h,
          width: w,
          height: h,
          x: 0,
          y: 0,
          toJSON: () => {},
        } as DOMRect;
      };
    }
  } catch (e) {
    // Ignore harmless prototype guard errors
  }
}

// Singleton safe confetti cannon using useWorker: false
// This prevents Web Worker blob URL issues in iframes and avoids the buggy
// resize event handler calling canvas.getBoundingClientRect
let safeConfettiCannon: any = null;

function getConfettiCannon() {
  if (typeof window === 'undefined') return null;
  if (!safeConfettiCannon) {
    try {
      if (typeof confetti?.create === 'function') {
        // useWorker: false explicitly keeps animation on the main thread
        // and avoids unhandled getBoundingClientRect errors during resize
        safeConfettiCannon = confetti.create(undefined, {
          resize: true,
          useWorker: false,
          disableForReducedMotion: true,
        });
      } else if (typeof confetti === 'function') {
        safeConfettiCannon = confetti;
      }
    } catch (err) {
      console.warn('[ConfettiHelper] Failed to create confetti instance:', err);
      safeConfettiCannon = typeof confetti === 'function' ? confetti : null;
    }
  }
  return safeConfettiCannon;
}

export interface ConfettiOptions {
  particleCount?: number;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
  origin?: { x?: number; y?: number };
  colors?: string[];
  shapes?: string[];
  scalar?: number;
  zIndex?: number;
  disableForReducedMotion?: boolean;
}

/**
 * Robust wrapper around canvas-confetti that guarantees no uncaught exceptions
 * like 'canvas.getBoundingClientRect is not a function' even inside iframe sandboxes.
 */
export function safeConfetti(options?: ConfettiOptions): void {
  if (typeof window === 'undefined') return;

  try {
    const fire = getConfettiCannon();
    if (typeof fire === 'function') {
      const mergedOpts: ConfettiOptions = {
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        disableForReducedMotion: true,
        ...options,
      };

      const result = fire(mergedOpts);
      if (result && typeof result.then === 'function') {
        result.catch((error: unknown) => {
          console.warn('[ConfettiHelper] Suppressed confetti promise rejection:', error);
        });
      }
    }
  } catch (error) {
    console.warn('[ConfettiHelper] Suppressed confetti synchronous error:', error);
  }
}

export default safeConfetti;
