"use client";

import React, { useState } from "react";
import {
  Route,
  Gauge,
  Sparkles,
} from "lucide-react";
import {
  calculateCorridor,
  type CorridorCalculation,
  type DefaultLocationItem,
} from "@/lib/nigeria-data";
import { looksLikeNdapsPostcode } from "@/lib/postcode";

interface CorridorTabProps {
  locations: DefaultLocationItem[];
}

export function CorridorTab({ locations }: CorridorTabProps) {
  const [originCode, setOriginCode] = useState("LA010010101"); // Ikeja
  const [destCode, setDestCode] = useState("LA020030205"); // Lekki
  const [calculation, setCalculation] = useState<CorridorCalculation | null>(() =>
    calculateCorridor("LA010010101", "LA020030205")
  );
  const [error, setError] = useState("");

  const sampleRoutes = [
    { label: "Intra-Lagos: Ikeja → Lekki", origin: "LA010010101", dest: "LA020030205" },
    { label: "Interstate: Lagos → Abuja CBD", origin: "LA010010101", dest: "AB010020110" },
    { label: "Regional: Port Harcourt → Asaba", origin: "RV010010304", dest: "DE010010101" },
    { label: "Cross-Country: Lagos → Kano", origin: "LA010010101", dest: "KN010010102" },
  ];

  function handleCalculate() {
    const o = originCode.trim().toUpperCase();
    const d = destCode.trim().toUpperCase();

    if (!looksLikeNdapsPostcode(o)) {
      setError("Origin postcode must be a valid 11-character digital postcode.");
      return;
    }
    if (!looksLikeNdapsPostcode(d)) {
      setError("Destination postcode must be a valid 11-character digital postcode.");
      return;
    }

    setError("");
    const calc = calculateCorridor(o, d);
    setCalculation(calc);
  }

  function handleSelectSample(s: (typeof sampleRoutes)[0]) {
    setOriginCode(s.origin);
    setDestCode(s.dest);
    setError("");
    const calc = calculateCorridor(s.origin, s.dest);
    setCalculation(calc);
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
                <Route size={18} />
              </div>
              <h2 className="text-lg font-bold text-[var(--ink)]">
                Digital Postcode Transit & Dispatch Corridor Calculator
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Calculate geographic distance, dispatch tiers, and transit estimates between Nigerian digital postcodes for last-mile and linehaul logistics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#fff0e4] px-3 py-1 text-xs font-bold text-[var(--orange)]">
              Linehaul & Last-Mile
            </span>
          </div>
        </div>

        {/* Quick Route Samples */}
        <div className="mt-6 border-t border-[var(--line)] pt-5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--subtle)]">
            Popular Nigeria Logistics Corridors:
          </div>
          <div className="flex flex-wrap gap-2">
            {sampleRoutes.map((s) => (
              <button
                key={s.label}
                onClick={() => handleSelectSample(s)}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[#fafcf9] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[var(--green)] hover:bg-[var(--green-soft)] transition"
              >
                <Sparkles size={13} className="text-[var(--green)]" />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input Form & Metrics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Origin & Destination Configurator */}
        <div className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--ink)]">Corridor Endpoints</span>
              <span className="text-[11px] text-[var(--muted)]">11-Char NDAPS Codes</span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-bold text-[var(--ink)]">
                  Origin Postcode (Warehouse / Dispatch Gateway)
                </label>
                <div className="flex gap-2">
                  <input
                    value={originCode}
                    onChange={(e) => setOriginCode(e.target.value.toUpperCase())}
                    maxLength={11}
                    placeholder="e.g. LA010010101"
                    className="h-11 flex-1 rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3.5 font-mono text-xs font-bold outline-none focus:border-[var(--green)] focus:bg-white"
                  />
                  {locations.length > 0 && (
                    <select
                      onChange={(e) => e.target.value && setOriginCode(e.target.value)}
                      className="h-11 rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-2 text-xs outline-none focus:border-[var(--green)] max-w-[140px]"
                    >
                      <option value="">Use Hub…</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.postcode}>
                          {loc.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-[var(--ink)]">
                  Destination Postcode (Customer / Delivery Point)
                </label>
                <input
                  value={destCode}
                  onChange={(e) => setDestCode(e.target.value.toUpperCase())}
                  maxLength={11}
                  placeholder="e.g. AB010020110"
                  className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3.5 font-mono text-xs font-bold outline-none focus:border-[var(--green)] focus:bg-white"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                  {error}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleCalculate}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--green)] py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--green-hover)]"
          >
            <Gauge size={15} />
            <span>Calculate Route & Dispatch Tier</span>
          </button>
        </div>

        {/* Calculation Result Card */}
        {calculation && (
          <div className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--subtle)]">
                    Transit Analysis
                  </span>
                  <h3 className="text-base font-bold text-[var(--ink)] mt-0.5">
                    {calculation.recommendedCorridor}
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  {calculation.dispatchTier}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[var(--line)] bg-[#fafcf9] p-4 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--subtle)]">
                    Spatial Distance
                  </div>
                  <div className="mt-1 font-mono text-2xl font-black text-[var(--green)]">
                    {calculation.distanceKm}{" "}
                    <span className="text-xs font-semibold text-[var(--muted)]">KM</span>
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--muted)]">Haversine Great Circle</div>
                </div>

                <div className="rounded-2xl border border-[var(--line)] bg-[#fafcf9] p-4 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--subtle)]">
                    Transit Window
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold text-[var(--ink)]">
                    {calculation.estimatedTransitHours.split("(")[0]}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--muted)]">Simulated Planning Model</div>
                </div>
              </div>

              {/* Waypoints breakdown */}
              <div className="mt-5 space-y-2 text-xs border-t border-[var(--line)] pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Origin Hub:</span>
                  <span className="font-semibold text-[var(--ink)] text-right">
                    {calculation.originAnatomy.lgaName}, {calculation.originAnatomy.stateName}
                    <span className="block text-[10px] text-[var(--muted)]">
                      ~{calculation.originAnatomy.coordinates.lat}°N, ~{calculation.originAnatomy.coordinates.lng}°E (Simulated Anchor)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Destination:</span>
                  <span className="font-semibold text-[var(--ink)] text-right">
                    {calculation.destAnatomy.lgaName}, {calculation.destAnatomy.stateName}
                    <span className="block text-[10px] text-[var(--muted)]">
                      ~{calculation.destAnatomy.coordinates.lat}°N, ~{calculation.destAnatomy.coordinates.lng}°E (Simulated Anchor)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Road Access Tier:</span>
                  <span className="font-semibold text-emerald-700">
                    {calculation.destAnatomy.roadAccessibility}
                  </span>
                </div>
              </div>
            </div>

            {/* Simulation Disclaimer Alert */}
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-[11px] text-amber-900">
              <div className="font-bold text-amber-950 mb-0.5">Planning Estimate Notice</div>
              <p className="text-amber-800 leading-relaxed">
                {calculation.transitDisclaimer} Operational dispatch requires carrier integration, live telematics, and road condition verification.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
