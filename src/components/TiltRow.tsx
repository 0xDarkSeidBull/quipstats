import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * Subtle tilt effect for list rows / small widgets.
 * Lighter than TiltCard — small angle, no scale jump, no spotlight by default.
 */
interface TiltRowProps {
  className?: string;
  children: React.ReactNode;
  tilt?: number;       // max degrees
  scale?: number;      // hover scale
  spotlight?: boolean; // optional sheen
  as?: "div" | "button";
  onClick?: () => void;
  title?: string;
}

export function TiltRow({
  className,
  children,
  tilt = 6,
  scale = 1.015,
  spotlight = false,
  as = "div",
  onClick,
  title,
}: TiltRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState("perspective(1000px) rotateX(0) rotateY(0) scale3d(1,1,1)");
  const [sp, setSp] = useState({ x: 50, y: 50, on: false });

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (py - 0.5) * tilt * 2 * -1;
    const ry = (px - 0.5) * tilt * 2;
    setT(`perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(${scale},${scale},${scale})`);
    if (spotlight) setSp({ x: px * 100, y: py * 100, on: true });
  }, [tilt, scale, spotlight]);

  const onLeave = useCallback(() => {
    setT("perspective(1000px) rotateX(0) rotateY(0) scale3d(1,1,1)");
    setSp((s) => ({ ...s, on: false }));
  }, []);

  const Tag = as as any;
  return (
    <Tag
      ref={ref as any}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      title={title}
      className={cn("relative will-change-transform", className)}
      style={{
        transform: t,
        transition: "transform 0.18s ease-out",
        transformStyle: "preserve-3d",
      }}
    >
      {children}
      {spotlight && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
          style={{ opacity: sp.on ? 1 : 0, transition: "opacity .25s" }}
        >
          <div
            className="absolute h-[180%] w-[180%] rounded-full"
            style={{
              left: `${sp.x}%`, top: `${sp.y}%`, transform: "translate(-50%,-50%)",
              background: "radial-gradient(circle, hsl(var(--foreground) / 0.08) 0%, transparent 45%)",
            }}
          />
        </div>
      )}
    </Tag>
  );
}
