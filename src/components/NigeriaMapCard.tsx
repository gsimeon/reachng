"use client";

import React from "react";
import { MapPin, Navigation, ExternalLink, Compass } from "lucide-react";
import type { PostcodeAnatomy } from "@/lib/nigeria-data";

interface NigeriaMapCardProps {
  anatomy: PostcodeAnatomy;
  postcode: string;
}

export function NigeriaMapCard({ anatomy, postcode }: NigeriaMapCardProps) {
  const { coordinates, stateName, lgaName, zoneCategory, roadAccessibility } = anatomy;

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
      {/* Map Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[#fafcf9] px-4 py-3">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-[var(--green)]" />
          <span className="text-xs font-bold text-[var(--ink)]">Geo-Coordinates & Visual Positioning</span>
        </div>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--green)] hover:underline"
        >
          <span>Open Google Maps</span>
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Visual Map Representation */}
      <div className="relative h-[180px] w-full overflow-hidden bg-[#e8f1ec]">
        {/* Subtle Map Grid Lines */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(#176b48 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Nigeria SVG outline stylized representation */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
          <svg viewBox="0 0 400 300" className="h-full w-full max-w-[340px] text-[#2c7757] fill-current">
            <path d="M 60,140 Q 80,100 120,70 Q 180,50 250,55 Q 330,70 350,120 Q 370,160 340,210 Q 300,250 230,260 Q 150,270 90,230 Q 50,190 60,140 Z" />
          </svg>
        </div>

        {/* Central Pin Pulse */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-16 w-16 animate-ping rounded-full bg-[var(--green)] opacity-20" />
            <div className="absolute h-10 w-10 rounded-full bg-[var(--green)] opacity-30" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--green)] text-white shadow-lg">
              <MapPin size={18} className="fill-white stroke-[2]" />
            </div>
          </div>
          <div className="mt-2 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-[var(--ink)] shadow-md backdrop-blur-sm border border-[#d6e3da]">
            {lgaName}, {stateName}
          </div>
        </div>

        {/* Bottom Coordinates Overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <Navigation size={12} className="text-emerald-400" />
            <span>
              {coordinates.lat.toFixed(4)}° N, {coordinates.lng.toFixed(4)}° E
            </span>
          </div>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-mono">
            {postcode}
          </span>
        </div>
      </div>

      {/* Corridor Attributes */}
      <div className="grid grid-cols-2 divide-x divide-[var(--line)] border-t border-[var(--line)] bg-white text-xs">
        <div className="p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--subtle)]">Area Classification</div>
          <div className="mt-0.5 font-bold text-[var(--ink)] truncate">{zoneCategory}</div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--subtle)]">Road Access Tier</div>
          <div className="mt-0.5 font-bold text-[var(--ink)] truncate">{roadAccessibility}</div>
        </div>
      </div>
    </div>
  );
}
