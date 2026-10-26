"use client";

import React, { useState } from "react";
import {
  Compass,
  Building2,
  Copy,
  Check,
  Plus,
  ArrowRight,
  Filter,
} from "lucide-react";
import {
  NIGERIAN_STATES,
  generatePostcodeForLga,
  parseNdapsPostcode,
} from "@/lib/nigeria-data";
import { NigeriaMapCard } from "./NigeriaMapCard";

interface DirectoryTabProps {
  onSaveLocation: (loc: { label: string; postcode: string; address: string; category: string }) => Promise<void>;
  onInspectPostcode: (postcode: string) => void;
}

export function DirectoryTab({ onSaveLocation, onInspectPostcode }: DirectoryTabProps) {
  const [selectedGeoZone, setSelectedGeoZone] = useState<string>("All");
  const [selectedStateCode, setSelectedStateCode] = useState<string>("LA");
  const [selectedLga, setSelectedLga] = useState<string>("Ikeja");
  const [selectedDistrictNum, setSelectedDistrictNum] = useState<number>(1);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const geoZones = [
    "All",
    "South West",
    "South South",
    "South East",
    "North Central",
    "North West",
    "North East",
  ];

  // List of state keys without duplicate FC/AB
  const uniqueStates = Object.values(NIGERIAN_STATES).filter(
    (s, idx, self) => idx === self.findIndex((t) => t.name === s.name)
  );

  const filteredStates = uniqueStates.filter(
    (s) => selectedGeoZone === "All" || s.geoZone === selectedGeoZone
  );

  const currentState = NIGERIAN_STATES[selectedStateCode] || NIGERIAN_STATES.LA;
  const currentPostcode = generatePostcodeForLga(selectedStateCode, selectedLga, selectedDistrictNum);
  const anatomy = parseNdapsPostcode(currentPostcode);

  function handleStateChange(code: string) {
    setSelectedStateCode(code);
    const targetState = NIGERIAN_STATES[code] || NIGERIAN_STATES.LA;
    if (targetState.sampleLgas.length > 0) {
      setSelectedLga(targetState.sampleLgas[0]);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(currentPostcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveQuick() {
    await onSaveLocation({
      label: `${currentState.name} (${selectedLga}) Hub`,
      postcode: currentPostcode,
      address: `${anatomy.districtName}, ${currentState.name}`,
      category: "Dispatch Office",
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Directory Header Banner */}
      <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
                <Compass size={18} />
              </div>
              <h2 className="text-lg font-bold text-[var(--ink)]">
                National Postcode Directory & Reverse Lookup
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Browse reference postal models for Nigeria&apos;s 36 States and the FCT to test 11-character NDAPS postcode construction. Sample LGA models provide format prototypes; authoritative postal registration requires an active NDAPS provider.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              36 States + FCT Reference Model
            </span>
          </div>
        </div>

        {/* Geopolitical Zone Filter */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-5">
          <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--subtle)]">
            <Filter size={13} />
            <span>Region:</span>
          </span>
          {geoZones.map((zone) => (
            <button
              key={zone}
              onClick={() => setSelectedGeoZone(zone)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedGeoZone === zone
                  ? "bg-[var(--green)] text-white"
                  : "bg-[#f5f8f5] text-[var(--muted)] hover:bg-[#eaf2ec]"
              }`}
            >
              {zone}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Picker & Resolution Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* State & LGA Configurator */}
        <div className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--ink)] mb-4">
              <Building2 size={16} className="text-[var(--green)]" />
              <span>Step 1: Select State & Administrative Zone</span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-bold text-[var(--ink)]">State / Federal Territory</label>
                <select
                  value={selectedStateCode}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3.5 text-xs font-medium text-[var(--ink)] outline-none focus:border-[var(--green)] focus:bg-white"
                >
                  {filteredStates.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code}) · {s.capital} [{s.geoZone}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-[var(--ink)]">
                  Local Government Area (LGA)
                </label>
                <select
                  value={selectedLga}
                  onChange={(e) => setSelectedLga(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3.5 text-xs font-medium text-[var(--ink)] outline-none focus:border-[var(--green)] focus:bg-white"
                >
                  {currentState.sampleLgas.map((lga) => (
                    <option key={lga} value={lga}>
                      {lga}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-[var(--ink)]">Sector / District Corridor</label>
                <select
                  value={selectedDistrictNum}
                  onChange={(e) => setSelectedDistrictNum(Number(e.target.value))}
                  className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3.5 text-xs font-medium text-[var(--ink)] outline-none focus:border-[var(--green)] focus:bg-white"
                >
                  <option value={1}>0101 · Commercial Centre & Main Street</option>
                  <option value={2}>0201 · Central Boulevard & Municipal Axis</option>
                  <option value={3}>0301 · Government Reservation Area (GRA)</option>
                  <option value={4}>0401 · Industrial Logistics Park & Hub</option>
                  <option value={5}>0501 · Port Logistics & Expressway Strip</option>
                </select>
              </div>
            </div>
          </div>

          {/* Generated Postcode Card */}
          <div className="mt-6 rounded-2xl border border-[var(--green-soft-border)] bg-[var(--green-soft)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--green-deep)]">
                Generated Digital Postcode
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[var(--green)]">
                11-Char NDAPS
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-2xl font-black tracking-widest text-[var(--green-deep)]">
                {currentPostcode}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[var(--green)] shadow-xs hover:bg-[#e2f0e6] transition"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--green-soft-border)] pt-3">
              <button
                onClick={() => onInspectPostcode(currentPostcode)}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--green)] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[var(--green-hover)] transition"
              >
                <span>View Full Anatomy</span>
                <ArrowRight size={13} />
              </button>

              <button
                onClick={handleSaveQuick}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--green)] bg-white px-3.5 py-1.5 text-xs font-bold text-[var(--green)] hover:bg-[var(--green-soft)] transition"
              >
                <Plus size={13} />
                <span>Save to Book</span>
              </button>

              {saveSuccess && (
                <span className="text-xs font-bold text-emerald-800">Saved!</span>
              )}
            </div>
          </div>
        </div>

        {/* Positioning Preview Card */}
        <div>
          <NigeriaMapCard anatomy={anatomy} postcode={currentPostcode} />
        </div>
      </div>
    </div>
  );
}
