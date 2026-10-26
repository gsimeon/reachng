"use client";

import React, { useState } from "react";
import { X, Building2, Plus, Check } from "lucide-react";

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWorkspace: string;
  onSelectWorkspace: (name: string) => void;
  supabaseConnected: boolean;
}

export function WorkspaceModal({
  isOpen,
  onClose,
  currentWorkspace,
  onSelectWorkspace,
  supabaseConnected,
}: WorkspaceModalProps) {
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const defaultWorkspaces = [
    "Lagos Logistics Operations",
    "Abuja Regional Dispatch",
    "Port Harcourt Hub",
    "Kano Distribution Gateway",
  ];

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setCreating(true);
    setTimeout(() => {
      onSelectWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName("");
      setCreating(false);
      onClose();
    }, 300);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">Switch or Create Workspace</h2>
              <p className="text-xs text-[var(--muted)]">Manage tenant and location isolation.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--subtle)] hover:bg-[#f0f4f1] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Existing workspaces list */}
        <div className="mt-5 space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--subtle)]">
            Available Workspaces
          </label>
          {defaultWorkspaces.map((ws) => (
            <button
              key={ws}
              onClick={() => {
                onSelectWorkspace(ws);
                onClose();
              }}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs transition ${
                currentWorkspace === ws
                  ? "border-[var(--green)] bg-[var(--green-soft)] font-bold text-[var(--green)]"
                  : "border-[var(--line)] bg-[#fafcf9] text-[var(--ink)] hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 size={15} />
                <span>{ws}</span>
              </div>
              {currentWorkspace === ws && <Check size={16} />}
            </button>
          ))}
        </div>

        {/* Create new workspace form */}
        <form onSubmit={handleCreate} className="mt-6 border-t border-[var(--line)] pt-5">
          <label className="mb-1 block text-xs font-bold text-[var(--ink)]">
            Create New Business Workspace
          </label>
          <div className="flex gap-2">
            <input
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="e.g. Paystack Merchant Ops"
              className="h-10 flex-1 rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3 text-xs outline-none focus:border-[var(--green)] focus:bg-white"
            />
            <button
              type="submit"
              disabled={creating || !newWorkspaceName.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--green)] px-4 text-xs font-bold text-white transition hover:bg-[var(--green-hover)] disabled:opacity-40"
            >
              <Plus size={14} />
              <span>Create</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            {supabaseConnected
              ? "Will register tenant row and trigger create_workspace RPC on Supabase."
              : "Isolated to this browser profile in local development mode."}
          </p>
        </form>
      </div>
    </div>
  );
}
