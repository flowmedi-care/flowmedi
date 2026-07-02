"use client";

import { useRef, useEffect, useState } from "react";

type FlowCurve = {
  start: { x: number; y: number };
  control1: { x: number; y: number };
  control2: { x: number; y: number };
  end: { x: number; y: number };
  delay: number;
  color: string;
};

const FLOW_COLOR = "#22C55E";

function cubicBezierPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
}

function buildCurves(width: number, height: number): FlowCurve[] {
  const w = width;
  const h = height;
  return [
    {
      start: { x: w * 0.08, y: h * 0.55 },
      control1: { x: w * 0.25, y: h * 0.35 },
      control2: { x: w * 0.45, y: h * 0.65 },
      end: { x: w * 0.62, y: h * 0.45 },
      delay: 0,
      color: FLOW_COLOR,
    },
    {
      start: { x: w * 0.62, y: h * 0.45 },
      control1: { x: w * 0.72, y: h * 0.3 },
      control2: { x: w * 0.82, y: h * 0.55 },
      end: { x: w * 0.92, y: h * 0.4 },
      delay: 1.5,
      color: FLOW_COLOR,
    },
    {
      start: { x: w * 0.15, y: h * 0.75 },
      control1: { x: w * 0.35, y: h * 0.55 },
      control2: { x: w * 0.55, y: h * 0.85 },
      end: { x: w * 0.78, y: h * 0.7 },
      delay: 0.8,
      color: FLOW_COLOR,
    },
    {
      start: { x: w * 0.05, y: h * 0.35 },
      control1: { x: w * 0.2, y: h * 0.15 },
      control2: { x: w * 0.4, y: h * 0.25 },
      end: { x: w * 0.55, y: h * 0.2 },
      delay: 2.2,
      color: FLOW_COLOR,
    },
  ];
}

function generateDots(width: number, height: number) {
  const dots: { x: number; y: number; opacity: number }[] = [];
  const gap = 14;

  for (let x = 0; x < width; x += gap) {
    for (let y = 0; y < height; y += gap) {
      const nx = x / width;
      const ny = y / height;
      const inWaveBand =
        ny > 0.35 &&
        ny < 0.75 &&
        Math.sin(nx * Math.PI * 3.5 + ny * 2) * 0.12 + 0.52 > ny - 0.1;

      if (inWaveBand && Math.random() > 0.45) {
        dots.push({
          x,
          y,
          opacity: Math.random() * 0.35 + 0.1,
        });
      }
    }
  }
  return dots;
}

export function FlowCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
      canvas.width = width;
      canvas.height = height;
    });

    resizeObserver.observe(canvas.parentElement);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const curves = buildCurves(dimensions.width, dimensions.height);
    const dots = generateDots(dimensions.width, dimensions.height);
    let animationFrameId: number;
    const startTime = Date.now();
    const introFadeDuration = 1.4;

    function drawDots(alpha: number) {
      dots.forEach((dot) => {
        ctx!.beginPath();
        ctx!.arc(dot.x, dot.y, 1, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(34, 197, 94, ${dot.opacity * alpha})`;
        ctx!.fill();
      });
    }

    function drawFlows(alpha: number) {
      const currentTime = (Date.now() - startTime) / 1000;

      curves.forEach((curve) => {
        const elapsed = currentTime - curve.delay;
        if (elapsed <= 0) return;

        const duration = 3.5;
        const progress = Math.min(elapsed / duration, 1);

        ctx!.beginPath();
        ctx!.moveTo(curve.start.x, curve.start.y);
        ctx!.bezierCurveTo(
          curve.control1.x,
          curve.control1.y,
          curve.control2.x,
          curve.control2.y,
          curve.end.x,
          curve.end.y
        );
        ctx!.strokeStyle = `rgba(34, 197, 94, ${0.35 * alpha})`;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        const partialEnd = cubicBezierPoint(
          progress,
          curve.start,
          curve.control1,
          curve.control2,
          curve.end
        );

        ctx!.beginPath();
        ctx!.moveTo(curve.start.x, curve.start.y);
        ctx!.bezierCurveTo(
          curve.control1.x,
          curve.control1.y,
          curve.control2.x,
          curve.control2.y,
          partialEnd.x,
          partialEnd.y
        );
        ctx!.strokeStyle = `rgba(34, 197, 94, ${alpha})`;
        ctx!.lineWidth = 2;
        ctx!.stroke();

        ctx!.beginPath();
        ctx!.arc(curve.start.x, curve.start.y, 3, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(34, 197, 94, ${alpha})`;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(partialEnd.x, partialEnd.y, 4, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(34, 197, 94, ${alpha})`;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(partialEnd.x, partialEnd.y, 8, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(34, 197, 94, ${0.3 * alpha})`;
        ctx!.fill();

        if (progress === 1) {
          ctx!.beginPath();
          ctx!.arc(curve.end.x, curve.end.y, 3, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(34, 197, 94, ${alpha})`;
          ctx!.fill();
        }
      });
    }

    function animate() {
      ctx!.clearRect(0, 0, dimensions.width, dimensions.height);
      const currentTime = (Date.now() - startTime) / 1000;
      const alpha = Math.min(currentTime / introFadeDuration, 1);
      drawDots(alpha);
      drawFlows(alpha);

      animationFrameId = requestAnimationFrame(animate);
    }

    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions]);

  return (
    <div className="relative z-0 w-full h-full overflow-hidden pointer-events-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 w-full h-full pointer-events-none"
      />
    </div>
  );
}
