"use client";

import React from "react";
import {
  MapPin,
  Search,
  Compass,
  Route,
  Layers3,
  Terminal,
  ShieldCheck,
  ChevronDown,
  Building2,
  Plus,
} from "lucide-react";

interface SidebarProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  workspaceName: string;
  setWorkspaceName: (name: string) => void;
  onOpenWorkspaceModal: () => void;
  onOpenAuthModal: () => void;
  userEmail: string | null;
  supabaseConnected: boolean;
  onNewLocationClick: () => void;
}

export function Sidebar({
  activeNav,
  setActiveNav,
  workspaceName,
  onOpenWorkspaceModal,
  onOpenAuthModal,
  userEmail,
  supabaseConnected,
  onNewLocationClick,
}: SidebarProps) {
  const navItems = [
    { id: "Explorer", label: "Postcode Explorer", icon: Search },
    { id: "Directory", label: "State & LGA Directory", icon: Compass, badge: "36+1" },
    { id: "Batch", label: "Batch Validator", icon: Layers3, badge: "Bulk" },
    { id: "Corridor", label: "Transit Corridors", icon: Route },
    { id: "Location book", label: "Location Book", icon: MapPin },
    { id: "API & integrations", label: "API & Integrations", icon: Terminal, badge: "SDK" },
  ];

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-[var(--line)] bg-white px-5 py-6 lg:flex">
      {/* Brand Header */}
      <div className="mb-6 flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--green)] text-white shadow-[0_4px_16px_rgba(23,107,72,0.25)]">
            <MapPin size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1 text-[20px] font-extrabold tracking-tight text-[var(--ink)]">
              ReachNG<span className="text-[var(--orange)]">.</span>
            </div>
            <div className="text-[11px] font-semibold text-[var(--subtle)]">Nigeria Location Intel</div>
          </div>
        </div>
      </div>

      {/* Quick Action Button */}
      <button
        onClick={onNewLocationClick}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--green)] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--green-hover)]"
      >
        <Plus size={15} /> Add Hub or Location
      </button>

      {/* Workspace Selector */}
      <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--subtle)]">
        Active Workspace
      </div>
      <button
        onClick={onOpenWorkspaceModal}
        className="mb-6 flex w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[#fafcf9] px-3 py-2 text-left transition hover:border-[var(--green)]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--green-soft)] text-[var(--green)]">
            <Building2 size={14} />
          </div>
          <div className="min-w-0 flex-1 truncate">
            <div className="truncate text-xs font-bold text-[var(--ink)]">{workspaceName}</div>
            <div className="text-[10px] text-[var(--muted)]">
              {supabaseConnected ? "Supabase Cloud Sync" : "Local Workspace"}
            </div>
          </div>
        </div>
        <ChevronDown size={14} className="text-[var(--muted)]" />
      </button>

      {/* Nav Section */}
      <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--subtle)]">
        Modules
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                isActive
                  ? "bg-[var(--green-soft)] text-[var(--green)] shadow-sm font-bold"
                  : "text-[var(--muted)] hover:bg-[#f6f8f5] hover:text-[var(--ink)]"
              }`}
            >
              <Icon size={17} className={isActive ? "text-[var(--green)]" : "text-[#7a8e84]"} />
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                    isActive
                      ? "bg-[var(--green)] text-white"
                      : "bg-[#fff0e4] text-[var(--orange)]"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Trust & Compliance Badge */}
      <div className="mt-8 rounded-2xl border border-[var(--green-soft-border)] bg-[var(--green-soft)] p-3.5">
        <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-[var(--green-deep)]">
          <ShieldCheck size={16} className="text-[var(--green)]" />
          <span>NDAPS Verified Layer</span>
        </div>
        <p className="text-[11px] leading-4 text-[var(--muted)]">
          Server-side provider isolation. Sensitive government API credentials are never exposed in browser bundles.
        </p>
      </div>

      {/* User / Auth Footer */}
      <div className="mt-auto border-t border-[var(--line)] pt-4">
        <button
          onClick={onOpenAuthModal}
          className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-[#f5f8f5]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--green)] text-xs font-bold text-white shadow-sm">
            {userEmail ? userEmail.slice(0, 2).toUpperCase() : "OP"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-[var(--ink)]">
              {userEmail || "Guest Operator"}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
              {supabaseConnected ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Authenticated</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>Demo Mode</span>
                </>
              )}
            </div>
          </div>
          <ChevronDown size={14} className="text-[var(--muted)]" />
        </button>
      </div>
    </aside>
  );
}
