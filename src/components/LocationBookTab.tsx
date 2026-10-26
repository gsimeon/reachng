"use client";

import React, { useState } from "react";
import {
  MapPin,
  Building2,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  Download,
  ExternalLink,
  Printer,
  Sparkles,
} from "lucide-react";
import type { DefaultLocationItem } from "@/lib/nigeria-data";

interface LocationBookTabProps {
  locations: DefaultLocationItem[];
  onDeleteLocation: (id: string) => Promise<void>;
  onOpenAddModal: () => void;
  onRefresh: () => Promise<void>;
  supabaseConnected: boolean;
  onSeedDemoLocations: () => void;
  onPrintLabel?: (location: DefaultLocationItem) => void;
}

export function LocationBookTab({
  locations,
  onDeleteLocation,
  onOpenAddModal,
  onRefresh,
  supabaseConnected,
  onSeedDemoLocations,
  onPrintLabel,
}: LocationBookTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categories = ["All", "Fulfilment Hub", "Retail Store", "Pickup Station", "Dispatch Office"];

  const filteredLocations = locations.filter((loc) => {
    const matchesCategory = selectedCategory === "All" || loc.category === selectedCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      loc.label.toLowerCase().includes(query) ||
      loc.postcode.toLowerCase().includes(query) ||
      loc.address.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  function handleCopy(postcode: string, id: string) {
    navigator.clipboard.writeText(postcode);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this location from your book?")) return;
    setDeletingId(id);
    try {
      await onDeleteLocation(id);
    } finally {
      setDeletingId(null);
    }
  }

  function exportLocations() {
    if (locations.length === 0) return;
    const headers = ["ID", "Label", "Postcode", "Category", "Address", "Created At"];
    const rows = locations.map((l) => [
      `"${l.id}"`,
      `"${l.label}"`,
      `"${l.postcode}"`,
      `"${l.category || "General"}"`,
      `"${l.address || ""}"`,
      `"${l.created_at}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reachng-locations-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
                <MapPin size={18} />
              </div>
              <h2 className="text-lg font-bold text-[var(--ink)]">Organization Location Book</h2>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Manage your verified enterprise warehouses, logistics hubs, retail branches, and pickup points across Nigeria.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportLocations}
              disabled={locations.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--muted)] hover:border-[var(--green)] hover:text-[var(--ink)] disabled:opacity-40"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-2 rounded-xl bg-[var(--green)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--green-hover)]"
            >
              <Plus size={15} />
              <span>Add Location</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-[var(--line)] pt-5">
          <div className="relative min-w-[240px] flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by label, postcode, or address…"
              className="h-10 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] pl-10 pr-4 text-xs outline-none transition focus:border-[var(--green)] focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? "bg-[var(--green)] text-white"
                    : "bg-[#f5f8f5] text-[var(--muted)] hover:bg-[#eef3ef]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[#fafcf9] px-5 py-3 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              supabaseConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="font-semibold text-[var(--ink)]">
            {supabaseConnected
              ? "Connected to Supabase (Row-Level Security & Org Isolation active)"
              : "Local Storage Mode (Saved on this device. Connect Supabase for multi-user team sync)"}
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs font-semibold text-[var(--green)] hover:underline"
        >
          Refresh Book
        </button>
      </div>

      {/* Locations List */}
      {filteredLocations.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredLocations.map((loc) => (
            <div
              key={loc.id}
              className="group flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:border-[#b8cfc0] hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--ink)]">{loc.label}</h3>
                      <span className="inline-block rounded-full bg-[#f0f4f1] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                        {loc.category || "Facility"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(loc.id)}
                    disabled={deletingId === loc.id}
                    className="opacity-0 group-hover:opacity-100 rounded p-1.5 text-[var(--subtle)] transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Remove location"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mt-4 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--subtle)]">Postcode:</span>
                    <span className="font-mono font-bold text-[var(--green)]">{loc.postcode}</span>
                    <button
                      onClick={() => handleCopy(loc.postcode, loc.id)}
                      className="rounded p-1 text-[var(--subtle)] hover:text-[var(--ink)]"
                      title="Copy postcode"
                    >
                      {copiedId === loc.id ? (
                        <Check size={12} className="text-emerald-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                  {loc.address && (
                    <p className="text-[var(--muted)] leading-relaxed">{loc.address}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-[11px] text-[var(--subtle)]">
                <span>Added {new Date(loc.created_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-3">
                  {onPrintLabel && (
                    <button
                      onClick={() => onPrintLabel(loc)}
                      className="flex items-center gap-1 font-semibold text-[var(--ink)] hover:text-[var(--green)] transition"
                    >
                      <Printer size={12} />
                      <span>Print Slip</span>
                    </button>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      loc.address || loc.label + " Nigeria"
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-semibold text-[var(--green)] hover:underline"
                  >
                    <span>Locate</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-[var(--line)] bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--green-soft)] text-[var(--green)]">
            <MapPin size={22} />
          </div>
          <h3 className="text-sm font-bold text-[var(--ink)]">No Locations Found</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--muted)]">
            {searchQuery
              ? `No saved locations match "${searchQuery}". Try adjusting your search or category filter.`
              : "Your organization location book is currently empty. Run a postcode lookup or add your hubs to build your network."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--green)] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--green-hover)]"
            >
              <Plus size={15} /> Add Custom Hub
            </button>
            <button
              onClick={onSeedDemoLocations}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[#fafcf9] px-4 py-2 text-xs font-bold text-[var(--green)] hover:bg-[var(--green-soft)]"
            >
              <Sparkles size={14} /> Seed Nigerian Hubs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
