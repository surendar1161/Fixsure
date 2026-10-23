"use client";

import { MoveHorizontal } from "lucide-react";
import { useState } from "react";

/** Drag to wipe between the before and after photos. */
export function CompareSlider({ before, after, start = 50 }: { before: string; after: string; start?: number }) {
  const [position, setPosition] = useState(start);
  return (
    <div className="compare">
      {/* eslint-disable-next-line @next/next/no-img-element -- job photos are private, keyed URLs */}
      <img src={before} alt="Before the repair" />
      <div className="after-layer" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- job photos are private, keyed URLs */}
        <img src={after} alt="After the repair" />
      </div>
      <span className="tag left">Before</span>
      <span className="tag right">After</span>
      <div className="handle" style={{ left: `${position}%` }}>
        <span className="knob">
          <MoveHorizontal size={18} />
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        aria-label="Compare before and after"
        onChange={(event) => setPosition(Number(event.target.value))}
      />
    </div>
  );
}

export function SinglePhoto({ src, label }: { src: string; label: string }) {
  return (
    <div className="photo-single">
      {/* eslint-disable-next-line @next/next/no-img-element -- job photos are private, keyed URLs */}
      <img src={src} alt={label} />
      <span className="tag">{label}</span>
    </div>
  );
}
