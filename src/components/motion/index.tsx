import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { useHasFinePointer, useInView, usePrefersReducedMotion } from "@/hooks/use-motion";

/* -------------------------------------------------------------------------- */
/* Reveal — the choreography primitive                                        */
/* -------------------------------------------------------------------------- */

type RevealDirection = "up" | "down" | "left" | "right" | "scale" | "blur" | "mask";

type RevealProps = {
  children: ReactNode;
  /** Stagger index; each step adds 70ms. */
  delay?: number;
  direction?: RevealDirection;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Fraction of the element that must be visible before it animates. */
  threshold?: number;
};

const DIRECTION_CLASS: Record<RevealDirection, string> = {
  up: "motion-reveal-up",
  down: "motion-reveal-down",
  left: "motion-reveal-left",
  right: "motion-reveal-right",
  scale: "motion-reveal-scale",
  blur: "motion-reveal-blur",
  mask: "motion-reveal-mask",
};

/**
 * Scroll-triggered entrance.
 *
 * The hidden state lives in CSS so server-rendered HTML is identical to the
 * hydrated output (no flash, no layout shift). `prefers-reduced-motion` and
 * script-less browsing both fall back to the final state — see styles.css.
 */
export function Reveal({
  children,
  delay = 0,
  direction = "up",
  as: Tag = "div",
  className = "",
  style,
  threshold = 0.15,
}: RevealProps) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold, once: true });
  const delayMs = delay * 70;

  return (
    <Tag
      ref={ref}
      className={`motion-reveal ${DIRECTION_CLASS[direction]} ${inView ? "is-revealed" : ""} ${className}`}
      style={{ ...style, transitionDelay: `${delayMs}ms`, animationDelay: `${delayMs}ms` }}
    >
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* TextReveal — line-masked headline entrance                                 */
/* -------------------------------------------------------------------------- */

export function TextReveal({
  children,
  as: Tag = "span",
  className = "",
  delay = 0,
}: {
  /** Plain text is split into masked words; nodes are revealed as a single unit. */
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0.2, once: true });
  const words = useMemo(
    () => (typeof children === "string" ? children.split(" ") : null),
    [children],
  );

  if (reduced) {
    return <Tag className={className}>{children}</Tag>;
  }

  // Rich children (gradient spans, emphasis) cannot be word-split without breaking
  // the markup, so they reveal as one block instead.
  if (!words) {
    return (
      <Tag ref={ref} className={`text-reveal is-revealed ${className}`}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag ref={ref} className={`text-reveal ${inView ? "is-revealed" : ""} ${className}`}>
      {words!.map((word, index) => (
        <span className="text-reveal__word" key={`${word}-${index}`}>
          <span
            className="text-reveal__inner"
            style={{ transitionDelay: `${delay + index * 45}ms` }}
          >
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* Parallax — scroll-linked depth                                             */
/* -------------------------------------------------------------------------- */

export function Parallax({
  children,
  distance = 60,
  className = "",
  axis = "y",
}: {
  children: ReactNode;
  /** Peak translation in pixels across the element's viewport traverse. */
  distance?: number;
  className?: string;
  axis?: "x" | "y";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element || reduced) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      // -1 (below the fold) … 0 (centred) … 1 (above the fold)
      const progress = (rect.top + rect.height / 2 - viewport / 2) / viewport;
      const offset = Math.max(-1, Math.min(1, progress)) * distance;
      element.style.transform = `translate3d(${axis === "x" ? offset : 0}px, ${
        axis === "y" ? offset : 0
      }px, 0)`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [distance, axis, reduced]);

  return (
    <div ref={ref} className={className} style={{ willChange: reduced ? undefined : "transform" }}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tilt — pointer-responsive 3D surface                                       */
/* -------------------------------------------------------------------------- */

export function Tilt({
  children,
  className = "",
  max = 7,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fine = useHasFinePointer();
  const reduced = usePrefersReducedMotion();
  const enabled = fine && !reduced;

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const element = ref.current;
      if (!element || !enabled) return;
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      element.style.setProperty("--tilt-x", `${(0.5 - y) * max * 2}deg`);
      element.style.setProperty("--tilt-y", `${(x - 0.5) * max * 2}deg`);
      element.style.setProperty("--glare-x", `${x * 100}%`);
      element.style.setProperty("--glare-y", `${y * 100}%`);
    },
    [enabled, max],
  );

  const reset = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty("--tilt-x", "0deg");
    element.style.setProperty("--tilt-y", "0deg");
  }, []);

  return (
    <div
      ref={ref}
      className={`tilt-surface ${enabled ? "is-enabled" : ""} ${glare ? "has-glare" : ""} ${className}`}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
    >
      {children}
      {glare && enabled ? <span className="tilt-glare" aria-hidden="true" /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Spotlight — pointer-following radial glow                                  */
/* -------------------------------------------------------------------------- */

export function Spotlight({
  children,
  className = "",
  color = "var(--color-primary)",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fine = useHasFinePointer();
  const reduced = usePrefersReducedMotion();
  const enabled = fine && !reduced;

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const element = ref.current;
      if (!element || !enabled) return;
      const rect = element.getBoundingClientRect();
      element.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      element.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    },
    [enabled],
  );

  return (
    <div
      ref={ref}
      className={`spotlight ${enabled ? "is-enabled" : ""} ${className}`}
      style={{ ["--spot-color" as string]: color }}
      onPointerMove={onPointerMove}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Magnetic — subtle pointer attraction for primary actions                   */
/* -------------------------------------------------------------------------- */

export function Magnetic({
  children,
  className = "",
  strength = 0.28,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fine = useHasFinePointer();
  const reduced = usePrefersReducedMotion();
  const enabled = fine && !reduced;

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const element = ref.current;
      if (!element || !enabled) return;
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - (rect.left + rect.width / 2)) * strength;
      const y = (event.clientY - (rect.top + rect.height / 2)) * strength;
      element.style.setProperty("--mag-x", `${x}px`);
      element.style.setProperty("--mag-y", `${y}px`);
    },
    [enabled, strength],
  );

  const reset = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty("--mag-x", "0px");
    element.style.setProperty("--mag-y", "0px");
  }, []);

  return (
    <div
      ref={ref}
      className={`magnetic ${enabled ? "is-enabled" : ""} ${className}`}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CountUp — numbers that arrive                                              */
/* -------------------------------------------------------------------------- */

export function CountUp({
  value,
  duration = 1_400,
  decimals = 0,
  className = "",
  prefix = "",
  suffix = "",
}: {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0.4, once: true });
  // The server (and any script-less visitor) renders the true figure. Only a
  // motion-capable client rewinds to zero to play the count-up, so a statistic
  // is never shown as "0" to a crawler or to someone without JavaScript.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    let frame = 0;
    const start = performance.now();
    setDisplay(0);
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutExpo — fast departure, calm arrival.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration, reduced]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {display.toLocaleString("en-NG", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Marquee — seamless looping rail                                            */
/* -------------------------------------------------------------------------- */

export function Marquee({
  children,
  speed = 40,
  className = "",
  reverse = false,
}: {
  children: ReactNode;
  /** Seconds for one full cycle. */
  speed?: number;
  className?: string;
  reverse?: boolean;
}) {
  return (
    <div className={`marquee ${className}`} aria-hidden="true">
      <div
        className={`marquee__track ${reverse ? "is-reverse" : ""}`}
        style={{ animationDuration: `${speed}s` }}
      >
        <div className="marquee__group">{children}</div>
        <div className="marquee__group">{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ScrollProgress                                                             */
/* -------------------------------------------------------------------------- */

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? window.scrollY / scrollable : 0);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="scroll-progress" aria-hidden="true">
      <span className="scroll-progress__bar" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Route transition                                                           */
/* -------------------------------------------------------------------------- */

const TransitionContext = createContext<string>("");

export function RouteTransition({ children }: { children: ReactNode }) {
  const key = useContext(TransitionContext);
  return (
    <div key={key} className="route-transition">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Custom cursor                                                              */
/* -------------------------------------------------------------------------- */

export function CustomCursor() {
  const fine = useHasFinePointer();
  const reduced = usePrefersReducedMotion();
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const enabled = fine && !reduced;

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let ringX = targetX;
    let ringY = targetY;

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }
      const interactive = (event.target as Element | null)?.closest?.(
        'a, button, input, select, textarea, summary, [role="button"], [data-cursor="hover"]',
      );
      setActive(Boolean(interactive));
    };

    // The ring trails the dot: two different easing rates read as physical weight.
    const loop = () => {
      ringX += (targetX - ringX) * 0.16;
      ringY += (targetY - ringY) * 0.16;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={ringRef}
        className={`cursor-ring ${active ? "is-active" : ""}`}
        aria-hidden="true"
      />
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
