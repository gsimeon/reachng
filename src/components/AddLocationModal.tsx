"use client";

import React, { useState } from "react";
import { X, MapPin, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { looksLikeNdapsPostcode } from "@/lib/postcode";
import { parseNdapsPostcode } from "@/lib/nigeria-data";

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (loc: { label: string; postcode: string; address: string; category: string }) => Promise<void>;
}

export function AddLocationModal({ isOpen, onClose, onSave }: AddLocationModalProps) {
  const [label, setLabel] = useState("");
  const [postcode, setPostcode] = useState("");
  const [category, setCategory] = useState("Fulfilment Hub");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const cleanPostcode = postcode.trim().toUpperCase();
  const isValidFormat = looksLikeNdapsPostcode(cleanPostcode);
  const anatomy = isValidFormat ? parseNdapsPostcode(cleanPostcode) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setError("Please provide a name or label for this location.");
      return;
    }
    if (!isValidFormat) {
      setError("Please provide a valid 11-character Nigerian digital postcode.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onSave({
        label: label.trim(),
        postcode: cleanPostcode,
        category,
        address: address.trim() || (anatomy ? `${anatomy.districtName}, ${anatomy.stateName}` : ""),
      });
      onClose();
      setLabel("");
      setPostcode("");
      setAddress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save location.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
              <MapPin size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">Add Organization Location</h2>
              <p className="text-xs text-[var(--muted)]">Register a hub or facility in your location book.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--subtle)] hover:bg-[#f0f4f1] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Location Label *</label>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Lagos Mainland Central Hub"
              className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3.5 text-xs outline-none focus:border-[var(--green)] focus:bg-white"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--ink)]">
                Digital Postcode (11 chars) *
              </label>
              <input
                required
                maxLength={11}
                value={postcode}
                onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                placeholder="e.g. LA010010101"
                className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3.5 font-mono text-xs font-bold outline-none focus:border-[var(--green)] focus:bg-white"
              />
              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className={isValidFormat ? "text-emerald-700 font-bold" : "text-[var(--subtle)]"}>
                  {cleanPostcode.length}/11 chars
                </span>
                {cleanPostcode.length > 0 && (
                  <span>
                    {isValidFormat ? (
                      <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={11} /> Format valid
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-1">
                        <AlertCircle size={11} /> 11 chars required
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3 text-xs outline-none focus:border-[var(--green)] focus:bg-white"
              >
                <option value="Fulfilment Hub">Fulfilment Hub</option>
                <option value="Retail Store">Retail Store</option>
                <option value="Pickup Station">Pickup Station</option>
                <option value="Dispatch Office">Dispatch Office</option>
              </select>
            </div>
          </div>

          {anatomy && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Resolved Topology:
              </span>
              <div className="mt-1 font-semibold text-emerald-950">
                {anatomy.lgaName}, {anatomy.stateName} · {anatomy.districtName}
              </div>
              <div className="text-[11px] text-emerald-800 font-mono">
                Lat: {anatomy.coordinates.lat}°N, Lng: {anatomy.coordinates.lng}°E
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Address Notes</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Plot 14 Allen Avenue, Ikeja, Lagos"
              className="w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] p-3 text-xs outline-none focus:border-[var(--green)] focus:bg-white"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--line)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-xs font-semibold text-[var(--muted)] hover:bg-[#fafcf9]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !label.trim() || !isValidFormat}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--green)] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--green-hover)] disabled:opacity-40"
            >
              {submitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
              ) : (
                <Plus size={15} />
              )}
              <span>Add to Location Book</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
