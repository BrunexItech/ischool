"use client";

import { useEffect, useRef } from "react";

const BLOBS = [
  { x: 0.16, y: 0.22, r: 240, color: "#0d9488", vx: 0.00028, vy: 0.00021, phase: 0 },
  { x: 0.82, y: 0.18, r: 280, color: "#4f7aff", vx: -0.00022, vy: 0.00026, phase: 2.1 },
  { x: 0.72, y: 0.78, r: 260, color: "#00d4ff", vx: 0.00025, vy: -0.0002, phase: 4.2 },
  { x: 0.22, y: 0.82, r: 220, color: "#00e676", vx: -0.0003, vy: -0.00018, phase: 6.1 },
];

export function LoginCanvasBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;

    function resize() {
      const parent = canvas!.parentElement;
      w = parent ? parent.clientWidth : window.innerWidth;
      h = parent ? parent.clientHeight : window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      ctx!.fillStyle = "#f7f8fc";
      ctx!.fillRect(0, 0, w, h);

      for (const b of BLOBS) {
        const bx = (b.x + Math.sin(t * 0.6 + b.phase) * 0.07) * w;
        const by = (b.y + Math.cos(t * 0.5 + b.phase) * 0.07) * h;
        const grad = ctx!.createRadialGradient(bx, by, 0, bx, by, b.r);
        grad.addColorStop(0, `${b.color}4d`);
        grad.addColorStop(1, `${b.color}00`);
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(bx, by, b.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      t += 0.01;
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
