"use client";

import React, { useState } from "react";
import {
  Layers3,
  CheckCircle2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";

interface BatchItemResult {
  raw: string;
  cleanPostcode: string;
  valid: boolean;
  stateCode?: string;
  stateName?: string;
  lgaName?: string;
  districtName?: string;
  coordinates?: { lat: number; lng: number };
  zoneCategory?: string;
  roadAccessibility?: string;
  error?: string;
}

interface BatchResponse {
  total: number;
  validCount: number;
  invalidCount: number;
  processedAt: string;
  results: BatchItemResult[];
}

export function BatchTab() {
  const [inputText, setInputText] = useState("");
  const [busy, setBusy] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResponse | null>(null);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const sampleBatch = [
    "LA010010101",
    "LA020030205",
    "AB010020110",
    "RV010010304",
    "KN010010102",
    "INVALID12", // intentional error test
    "OY010020108",
  ].join("\n");

  function loadSample() {
    setInputText(sampleBatch);
    setError("");
  }

  async function handleProcessBatch() {
    const lines = inputText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setError("Please paste or type at least one digital postcode.");
      return;
    }

    if (lines.length > 100) {
      setError("Batch size is capped at 100 items per request.");
      return;
    }

    setBusy(true);
    setError("");
    setBatchResult(null);

    try {
      const response = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Batch processing failed.");
      }
      setBatchResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error processing batch.");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!batchResult) return;
    const headers = ["Original Input", "Clean Postcode", "Status", "State", "LGA", "District", "Coordinates", "Zone Category"];
    const rows = batchResult.results.map((r) => [
      `"${r.raw}"`,
      `"${r.cleanPostcode}"`,
      r.valid ? "VALID" : "INVALID_FORMAT",
      `"${r.stateName || ""}"`,
      `"${r.lgaName || ""}"`,
      `"${r.districtName || ""}"`,
      r.coordinates ? `"${r.coordinates.lat},${r.coordinates.lng}"` : '""',
      `"${r.zoneCategory || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reachng-batch-validation-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleCopy(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Batch Header Card */}
      <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[0_8px_32px_rgba(29,65,47,0.04)]">
        <div className="border-b border-[var(--line)] bg-[#fafcf9] px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                <Layers3 size={18} className="text-[var(--green)]" />
                <span>Multi-Postcode Batch Cleanser & Normalizer</span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Verify bulk Nigerian postcodes, cleanse customer lists, and extract state/LGA topology in seconds.
              </p>
            </div>
            <button
              onClick={loadSample}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--green)] hover:border-[var(--green)] hover:bg-[var(--green-soft)]"
            >
              <Sparkles size={14} />
              <span>Load Sample Batch</span>
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--subtle)]">
            Paste Postcodes (One per line or comma-separated, max 100)
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={5}
            placeholder="LA010010101&#10;LA020030205&#10;AB010020110&#10;RV010010304"
            className="w-full rounded-2xl border border-[#d6dfd8] bg-[#fbfdfb] p-4 font-mono text-sm leading-6 outline-none transition focus:border-[var(--green)] focus:ring-4 focus:ring-[rgba(23,107,72,0.1)]"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[var(--muted)]">
              {inputText.split(/[\n,;]+/).filter(Boolean).length} items detected
            </span>
            <button
              onClick={handleProcessBatch}
              disabled={busy || !inputText.trim()}
              className="flex items-center gap-2 rounded-xl bg-[var(--green)] px-6 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--green-hover)] disabled:opacity-50"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                  <span>Processing Batch…</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  <span>Process Batch</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Batch Results View */}
      {batchResult && (
        <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-sm">
          {/* Metrics bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] bg-[#fafcf9] px-6 py-4">
            <div className="flex flex-wrap items-center gap-6 text-xs">
              <div>
                <span className="text-[var(--muted)]">Total Tested: </span>
                <span className="font-bold text-[var(--ink)]">{batchResult.total}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[var(--muted)]">Valid Format: </span>
                <span className="font-bold text-emerald-700">{batchResult.validCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-[var(--muted)]">Format Errors: </span>
                <span className="font-bold text-red-700">{batchResult.invalidCount}</span>
              </div>
            </div>

            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--green)] bg-[var(--green-soft)] px-4 py-2 text-xs font-bold text-[var(--green)] hover:bg-[var(--green)] hover:text-white transition"
            >
              <Download size={15} />
              <span>Export Clean CSV</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--line)] bg-[#f7f9f6] text-[10px] font-bold uppercase tracking-wider text-[var(--subtle)]">
                <tr>
                  <th className="px-6 py-3">Postcode</th>
                  <th className="px-4 py-3">Format Status</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">LGA & District</th>
                  <th className="px-4 py-3">Corridor</th>
                  <th className="px-4 py-3">Coordinates</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {batchResult.results.map((row, index) => (
                  <tr key={index} className="transition hover:bg-[#fafcf9]">
                    <td className="px-6 py-3.5 font-mono font-bold text-[var(--ink)]">
                      {row.cleanPostcode || row.raw}
                    </td>
                    <td className="px-4 py-3.5">
                      {row.valid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 size={12} /> Valid Format
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                          <AlertCircle size={12} /> Format Error
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[var(--ink)]">
                      {row.stateName || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--muted)]">
                      {row.lgaName ? `${row.lgaName} (${row.districtName})` : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--muted)]">
                      {row.zoneCategory || "—"}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[var(--muted)]">
                      {row.coordinates ? `${row.coordinates.lat}°N, ${row.coordinates.lng}°E` : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {row.valid && (
                        <button
                          onClick={() => handleCopy(row.cleanPostcode, index)}
                          className="rounded p-1.5 text-[var(--muted)] hover:bg-[#ebf2ed] hover:text-[var(--ink)]"
                          title="Copy postcode"
                        >
                          {copiedIndex === index ? (
                            <Check size={14} className="text-emerald-600" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
