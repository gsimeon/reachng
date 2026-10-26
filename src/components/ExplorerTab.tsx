"use client";

import React, { useState } from "react";
import {
  Search,
  MapPin,
  ArrowRight,
  BadgeCheck,
  Building2,
  Plus,
  X,
  Copy,
  Check,
  Code2,
  Info,
  AlertCircle,
} from "lucide-react";
import type { LookupStatus } from "@/lib/postcode";
import { CURATED_EXAMPLES, type CuratedExample, type PostcodeAnatomy } from "@/lib/nigeria-data";
import { NigeriaMapCard } from "./NigeriaMapCard";

export interface LookupData {
  postcode: string;
  status: LookupStatus;
  message: string;
  isAuthoritative?: boolean;
  isSimulated?: boolean;
  anatomy?: PostcodeAnatomy;
  providerData?: unknown;
  disclaimer?: string;
}

interface ExplorerTabProps {
  onSaveLocation: (loc: { label: string; postcode: string; address: string; category: string }) => Promise<void>;
  onNavigateToLocationBook: () => void;
  initialPostcode?: string;
}

export function ExplorerTab({
  onSaveLocation,
  onNavigateToLocationBook,
  initialPostcode,
}: ExplorerTabProps) {
  const [postcode, setPostcode] = useState(initialPostcode || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState<LookupData | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  // Save location form state
  const [saveLabel, setSaveLabel] = useState("");
  const [saveAddress, setSaveAddress] = useState("");
  const [saveCategory, setSaveCategory] = useState("Fulfilment Hub");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleLookup = React.useCallback(async (targetPostcode?: string) => {
    const code = (targetPostcode || postcode).trim().toUpperCase();
    if (!code) return;

    setBusy(true);
    setError("");
    setLookup(null);
    setShowRaw(false);
    setSaveStatus(null);

    try {
      const response = await fetch("/api/postcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcode: code }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Postcode lookup failed.");
      }
      setLookup(data);
      // Auto-prefill save form
      if (data.anatomy) {
        setSaveLabel(`${data.anatomy.lgaName} Facility`);
        setSaveAddress(`${data.anatomy.districtName}, ${data.anatomy.stateName}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed. Please verify format.");
    } finally {
      setBusy(false);
    }
  }, [postcode]);

  React.useEffect(() => {
    if (initialPostcode) {
      setPostcode(initialPostcode);
      void handleLookup(initialPostcode);
    }
  }, [initialPostcode, handleLookup]);

  function handleSelectExample(item: CuratedExample) {
    setPostcode(item.postcode);
    void handleLookup(item.postcode);
  }

  function copyPostcode() {
    if (!lookup) return;
    navigator.clipboard.writeText(lookup.postcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!lookup || !saveLabel.trim()) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      await onSaveLocation({
        label: saveLabel.trim(),
        postcode: lookup.postcode,
        address: saveAddress.trim(),
        category: saveCategory,
      });
      setSaveStatus("Location successfully saved to your location book!");
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : "Failed to save location.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search & Explorer Hero Box */}
      <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_8px_32px_rgba(29,65,47,0.04)]">
        <div className="border-b border-[var(--line)] bg-[#fafcf9] px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <Search size={18} className="text-[var(--green)]" />
                <span>Nigeria Digital Postcode Explorer</span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Query 11-character alphanumeric codes according to official NDAPS standards.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--green-soft)] px-3 py-1 text-[11px] font-bold text-[var(--green)]">
                NDAPS 11-Char Standard
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {/* Postcode Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleLookup();
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#87958e]" />
                <input
                  id="postcode-input"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                  maxLength={11}
                  placeholder="e.g. LA010010101"
                  className="h-[54px] w-full rounded-2xl border border-[#d6dfd8] bg-[#fbfdfb] pl-12 pr-16 text-base font-bold tracking-wider text-[var(--ink)] outline-none transition focus:border-[var(--green)] focus:ring-4 focus:ring-[rgba(23,107,72,0.1)] placeholder:text-[#a1b0a8] placeholder:font-normal placeholder:tracking-normal"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--subtle)]">
                  {postcode.length}/11
                </span>
              </div>
              <button
                type="submit"
                disabled={busy || !postcode.trim()}
                className="flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-[var(--green)] px-7 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--green-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    <span>Resolving…</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Resolve</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Curated Sample Chips */}
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--subtle)]">
              Quick test samples:
            </div>
            <div className="flex flex-wrap gap-2">
              {CURATED_EXAMPLES.map((item) => (
                <button
                  key={item.postcode}
                  type="button"
                  onClick={() => handleSelectExample(item)}
                  className="group flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[#fafcf9] px-3 py-1.5 text-left text-xs transition hover:border-[var(--green)] hover:bg-[var(--green-soft)]"
                >
                  <span className="font-mono font-bold text-[var(--green)]">{item.postcode}</span>
                  <span className="text-[var(--muted)]">· {item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Validation Error Message */}
          {error && (
            <div role="alert" className="mt-6 rounded-2xl border border-[#f5c6cb] bg-[#fff5f5] p-4 text-xs">
              <div className="flex items-start gap-3">
                <X size={18} className="mt-0.5 text-red-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-red-900">Format Verification Notice</div>
                  <p className="mt-1 leading-5 text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Resolved Lookup Result */}
          {lookup && (
            <div className="mt-8 space-y-6">
              {/* Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[#f8fbf9] p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
                    <BadgeCheck size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-extrabold tracking-wide text-[var(--ink)]">
                        {lookup.postcode}
                      </span>
                      <button
                        onClick={copyPostcode}
                        className="rounded p-1 text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]"
                        title="Copy postcode"
                      >
                        {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="text-xs text-[var(--muted)]">{lookup.message}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      lookup.status === "provider_confirmed" || (lookup.status as string) === "verified-by-provider"
                        ? "bg-emerald-100 text-emerald-800"
                        : lookup.status === "format_checked"
                        ? "bg-blue-100 text-blue-800"
                        : lookup.status === "unconfirmed_provider_response" || (lookup.status as string) === "unconfirmed-provider-response"
                        ? "bg-amber-100 text-amber-900"
                        : lookup.status === "provider_unavailable"
                        ? "bg-red-100 text-red-900"
                        : "bg-[#fff0e4] text-[#a85b24]"
                    }`}
                  >
                    {lookup.status === "provider_confirmed" || (lookup.status as string) === "verified-by-provider"
                      ? "Official Provider Confirmed (NDAPS Active)"
                      : lookup.status === "format_checked"
                      ? "11-Char Syntax Valid (Registry Query Pending)"
                      : lookup.status === "unconfirmed_provider_response" || (lookup.status as string) === "unconfirmed-provider-response"
                      ? "Provider Schema / Postcode Unconfirmed"
                      : lookup.status === "provider_unavailable"
                      ? "Provider Offline / Degraded"
                      : "Illustrative Simulation · Unconnected Upstream"}
                  </span>
                </div>
              </div>

              {/* Simulation Notice Banner if not verified by authoritative provider */}
              {lookup.status !== "provider_confirmed" && (lookup.status as string) !== "verified-by-provider" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <div className="space-y-1">
                      <div className="font-bold text-amber-950">
                        Prototyping Notice — Synthetic Spatial Topology
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        This lookup was derived algorithmically from 11-character postal structural rules.
                        Ground coordinates, LGA boundaries, and facility classifications are illustrative simulations and have not been certified by an authoritative NDAPS server.
                      </p>
                      {lookup.disclaimer && (
                        <p className="text-[10px] text-amber-700 italic border-t border-amber-200/80 pt-1">
                          {lookup.disclaimer}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Anatomy Visual Breakdown */}
              {lookup.anatomy && (
                <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--ink)]">
                      NDAPS Digital Postcode Anatomical Breakdown
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">11-Character NDAPS Structural Model (Illustrative Breakdown)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        State (Chars 1-2)
                      </div>
                      <div className="mt-1 font-mono text-lg font-black text-emerald-900">
                        {lookup.anatomy.stateCode}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-emerald-800 truncate">
                        {lookup.anatomy.stateName}
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        LGA Zone (Chars 3-5)
                      </div>
                      <div className="mt-1 font-mono text-lg font-black text-blue-900">
                        {lookup.anatomy.zoneCode}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-blue-800 truncate">
                        {lookup.anatomy.lgaName}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        Sector / District (6-9)
                      </div>
                      <div className="mt-1 font-mono text-lg font-black text-amber-900">
                        {lookup.anatomy.districtCode}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-amber-800 truncate">
                        {lookup.anatomy.districtName}
                      </div>
                    </div>

                    <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                        Unit Code (10-11)
                      </div>
                      <div className="mt-1 font-mono text-lg font-black text-purple-900">
                        {lookup.anatomy.unitCode}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-purple-800 truncate">
                        Delivery Point
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid: Map + Dispatch Attributes */}
              {lookup.anatomy && (
                <div className="grid gap-5 lg:grid-cols-2">
                  <NigeriaMapCard anatomy={lookup.anatomy} postcode={lookup.postcode} />

                  <div className="flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--ink)]">
                        <Building2 size={16} className="text-[var(--green)]" />
                        <span>Logistics & Dispatch Attributes</span>
                      </div>

                      <div className="mt-4 space-y-3 text-xs">
                        <div className="flex justify-between border-b border-[var(--line)] pb-2">
                          <span className="text-[var(--muted)]">Jurisdiction State:</span>
                          <span className="font-bold text-[var(--ink)]">{lookup.anatomy.stateName}</span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--line)] pb-2">
                          <span className="text-[var(--muted)]">Local Government Area:</span>
                          <span className="font-bold text-[var(--ink)]">{lookup.anatomy.lgaName}</span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--line)] pb-2">
                          <span className="text-[var(--muted)]">Central Regional Hub:</span>
                          <span className="font-bold text-[var(--ink)] truncate max-w-[200px]">
                            {lookup.anatomy.dispatchHub}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--line)] pb-2">
                          <span className="text-[var(--muted)]">Dispatch Corridor:</span>
                          <span className="font-bold text-emerald-700">{lookup.anatomy.zoneCategory}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--muted)]">Last-Mile Access:</span>
                          <span className="font-bold text-[var(--ink)]">{lookup.anatomy.roadAccessibility}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-dashed border-[#ccd9d0] bg-[#fbfdfb] p-3 text-[11px] text-[var(--muted)]">
                      <div className="flex items-start gap-2">
                        <Info size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
                        <span>
                          Postcode resolution provides anatomical zoning. Identity, ownership, and door-to-door access
                          must be verified via customer consent.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Save to Location Book Drawer */}
              <div className="rounded-2xl border border-[var(--line)] bg-[#fafcf9] p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={17} className="text-[var(--green)]" />
                    <span className="text-sm font-bold text-[var(--ink)]">Save to Organization Location Book</span>
                  </div>
                  <button
                    onClick={onNavigateToLocationBook}
                    className="text-xs font-semibold text-[var(--green)] hover:underline"
                  >
                    View existing locations →
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Location Label</label>
                    <input
                      value={saveLabel}
                      onChange={(e) => setSaveLabel(e.target.value)}
                      placeholder="e.g. Lagos West Fulfilment Hub"
                      className="h-10 w-full rounded-xl border border-[#d6dfd8] bg-white px-3 text-xs outline-none focus:border-[var(--green)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Facility Category</label>
                    <select
                      value={saveCategory}
                      onChange={(e) => setSaveCategory(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[#d6dfd8] bg-white px-3 text-xs outline-none focus:border-[var(--green)]"
                    >
                      <option value="Fulfilment Hub">Fulfilment Hub</option>
                      <option value="Retail Store">Retail Store</option>
                      <option value="Pickup Station">Pickup Station</option>
                      <option value="Dispatch Office">Dispatch Office</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Address Notes</label>
                    <input
                      value={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.value)}
                      placeholder="e.g. Plot 14 Allen Avenue, Ikeja"
                      className="h-10 w-full rounded-xl border border-[#d6dfd8] bg-white px-3 text-xs outline-none focus:border-[var(--green)]"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={isSaving || !saveLabel.trim()}
                    onClick={handleSave}
                    className="flex items-center gap-2 rounded-xl bg-[var(--green)] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--green-hover)] disabled:opacity-40"
                  >
                    {isSaving ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/50 border-t-white" /> : <Plus size={15} />}
                    <span>Save Location</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRaw(!showRaw)}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    <Code2 size={14} />
                    <span>{showRaw ? "Hide JSON" : "Inspect Raw Payload"}</span>
                  </button>

                  {saveStatus && (
                    <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                      {saveStatus}
                    </span>
                  )}
                </div>

                {showRaw && (
                  <pre className="mt-4 max-h-56 overflow-auto rounded-xl bg-[var(--code-bg)] p-4 font-mono text-xs text-emerald-300">
                    {JSON.stringify(lookup, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
