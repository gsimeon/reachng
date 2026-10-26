"use client";

import React, { useRef } from "react";
import { X, Printer, QrCode } from "lucide-react";
import { parseNdapsPostcode, type DefaultLocationItem } from "@/lib/nigeria-data";

interface DispatchLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: DefaultLocationItem | null;
  originHubName?: string;
}

export function DispatchLabelModal({
  isOpen,
  onClose,
  location,
  originHubName = "Lagos Mainland Sorting Facility",
}: DispatchLabelModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !location) return null;

  const anatomy = parseNdapsPostcode(location.postcode);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">NDAPS Dispatch & Package Label</h2>
              <p className="text-xs text-[var(--muted)]">Standard thermal / courier routing slip</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--subtle)] hover:bg-[#f0f4f1] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable Label Container */}
        <div
          ref={printAreaRef}
          className="my-5 rounded-2xl border-2 border-dashed border-gray-400 bg-white p-5 text-black font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div>
              <div className="text-lg font-black tracking-tighter uppercase">ReachNG Express</div>
              <div className="text-[10px] font-bold tracking-widest text-gray-600">NIGERIA DIGITAL ROUTING</div>
            </div>
            <div className="rounded bg-black px-2 py-1 text-[11px] font-black text-white">
              PRIORITY NDAPS
            </div>
          </div>

          {/* Large Postcode Box */}
          <div className="my-3 rounded-xl bg-gray-100 p-3 text-center border border-gray-300">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Destination Digital Postcode</div>
            <div className="font-mono text-3xl font-black tracking-widest text-black mt-0.5">
              {location.postcode}
            </div>
            <div className="text-[11px] font-bold text-gray-700 mt-1">
              {anatomy.stateName} · {anatomy.lgaName} · {anatomy.districtName}
            </div>
          </div>

          {/* Delivery & Routing Details */}
          <div className="grid grid-cols-2 gap-3 border-t-2 border-b-2 border-black py-3 text-xs">
            <div>
              <div className="text-[9px] font-bold uppercase text-gray-500">Consignee Facility / Label:</div>
              <div className="font-bold text-sm">{location.label}</div>
              <div className="text-[11px] text-gray-700 mt-0.5">{location.address || "Direct Postcode Delivery"}</div>
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase text-gray-500">Origin Gateway:</div>
              <div className="font-bold">{originHubName}</div>
              <div className="text-[11px] text-gray-700 mt-0.5">Last-Mile Tier: {anatomy.roadAccessibility}</div>
            </div>
          </div>

          {/* Barcode & Simulated QR Code */}
          <div className="mt-3 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                {Array.from({ length: 34 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-black"
                    style={{
                      width: i % 3 === 0 ? "3px" : i % 2 === 0 ? "2px" : "1px",
                      marginRight: i % 4 === 0 ? "2px" : "1px",
                    }}
                  />
                ))}
              </div>
              <div className="font-mono text-[9px] tracking-widest text-gray-500">
                *{location.postcode}-{anatomy.zoneCode}*
              </div>
            </div>

            {/* Stylized QR representation */}
            <div className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 border-black p-1">
              <QrCode size={44} className="text-black" />
            </div>
          </div>

          {/* Footer Coordinates */}
          <div className="mt-3 flex justify-between border-t border-gray-200 pt-2 text-[9px] text-gray-500">
            <span>GPS: {anatomy.coordinates.lat}°N, {anatomy.coordinates.lng}°E</span>
            <span>Ref: {location.id.slice(0, 14)}</span>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-xs font-semibold text-[var(--muted)] hover:bg-[#fafcf9]"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--green)] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--green-hover)]"
          >
            <Printer size={15} />
            <span>Print Dispatch Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
}
