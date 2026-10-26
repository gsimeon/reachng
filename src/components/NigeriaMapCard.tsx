"use client";

import React from "react";
import { Navigation, ExternalLink, Compass, AlertCircle } from "lucide-react";
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
          <span className="text-xs font-bold text-[var(--ink)]">
            Regional Spatial Anchor (Simulated Reference)
          </span>
        </div>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--green)] hover:underline"
        >
          <span>View Area in Maps</span>
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Visual Map Representation */}
      <div className="relative h-[190px] w-full overflow-hidden bg-[#e8f1ec]">
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

        {/* Top Disclaimer Tag */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded bg-[#fff7ed] px-2 py-0.5 text-[10px] font-bold text-[#c2410c] border border-[#ffedd5] shadow-xs">
          <AlertCircle size={10} />
          <span>Approximate Regional Centroid · Not Surveyed GPS</span>
        </div>

        {/* Central Pin Pulse */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-14 w-14 animate-ping rounded-full bg-[var(--green)] opacity-20" />
            <div className="absolute h-9 w-9 rounded-full bg-[var(--green)] opacity-30" />
            <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[var(--green)] text-white shadow-lg">
              <Compass size={15} className="text-white" />
            </div>
          </div>
          <div className="mt-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-[var(--ink)] shadow-md backdrop-blur-sm border border-[#d6e3da]">
            {lgaName}, {stateName}
          </div>
        </div>

        {/* Bottom Coordinates Overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg bg-black/75 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <Navigation size={12} className="text-emerald-400" />
            <span>
              ~{coordinates.lat.toFixed(4)}° N, ~{coordinates.lng.toFixed(4)}° E (Simulated Anchor)
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
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--subtle)]">Simulated Classification</div>
          <div className="mt-0.5 font-bold text-[var(--ink)] truncate">{zoneCategory}</div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--subtle)]">Standard Road Tier</div>
          <div className="mt-0.5 font-bold text-[var(--ink)] truncate">{roadAccessibility}</div>
        </div>
      </div>
    </div>
  );
}
