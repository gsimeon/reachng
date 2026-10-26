"use client";

import React, { useEffect, useState } from "react";
import {
  MapPin,
  Search,
  Compass,
  Route,
  Layers3,
  Terminal,
  Sparkles,
  Menu,
  X,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { ExplorerTab } from "@/components/ExplorerTab";
import { DirectoryTab } from "@/components/DirectoryTab";
import { BatchTab } from "@/components/BatchTab";
import { CorridorTab } from "@/components/CorridorTab";
import { LocationBookTab } from "@/components/LocationBookTab";
import { ApiIntegrationsTab } from "@/components/ApiIntegrationsTab";
import { AddLocationModal } from "@/components/AddLocationModal";
import { WorkspaceModal } from "@/components/WorkspaceModal";
import { AuthModal } from "@/components/AuthModal";
import { DispatchLabelModal } from "@/components/DispatchLabelModal";
import { INITIAL_DEMO_LOCATIONS, type DefaultLocationItem } from "@/lib/nigeria-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function Home() {
  const [activeNav, setActiveNav] = useState("Explorer");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Workspace & Auth state
  const [workspaceName, setWorkspaceName] = useState("Lagos Logistics Operations");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [providerConfigured, setProviderConfigured] = useState(false);

  // Location book state
  const [locations, setLocations] = useState<DefaultLocationItem[]>([]);
  const [inspectPostcode, setInspectPostcode] = useState<string | undefined>(undefined);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [printLabelLocation, setPrintLabelLocation] = useState<DefaultLocationItem | null>(null);

  // Initialize and check health
  useEffect(() => {
    // Load local workspace preference
    const savedWs = localStorage.getItem("reachng_workspace");
    if (savedWs) setWorkspaceName(savedWs);

    // Initial local fallback locations
    const savedLocs = localStorage.getItem("reachng_locations");
    if (savedLocs) {
      try {
        setLocations(JSON.parse(savedLocs));
      } catch {
        setLocations(INITIAL_DEMO_LOCATIONS);
      }
    } else {
      setLocations(INITIAL_DEMO_LOCATIONS);
      localStorage.setItem("reachng_locations", JSON.stringify(INITIAL_DEMO_LOCATIONS));
    }

    // Health check
    async function checkHealth() {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setSupabaseConnected(Boolean(data.environment?.supabaseConfigured));
          setProviderConfigured(Boolean(data.environment?.providerConfigured));
        }
      } catch {
        // Fallback to local demo mode
      }
    }
    void checkHealth();

    // Initialize Supabase auth session & real-time auth state listener
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          setUserEmail(session.user.email);
          void loadLocationsFromApi();
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user?.email) {
          setUserEmail(session.user.email);
          void loadLocationsFromApi();
        } else {
          setUserEmail(null);
          const cached = localStorage.getItem("reachng_locations");
          if (cached) {
            try {
              setLocations(JSON.parse(cached));
            } catch {
              setLocations(INITIAL_DEMO_LOCATIONS);
            }
          } else {
            setLocations(INITIAL_DEMO_LOCATIONS);
          }
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  function handleSelectWorkspace(name: string) {
    setWorkspaceName(name);
    localStorage.setItem("reachng_workspace", name);
  }

  function handleLogin(email: string) {
    setUserEmail(email);
  }

  function handleLogout() {
    setUserEmail(null);
  }

  async function handleSaveLocation(loc: {
    label: string;
    postcode: string;
    address: string;
    category: string;
  }) {
    // If Supabase is connected and user is signed in, save strictly to cloud API
    if (supabaseConnected && userEmail) {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loc),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to persist location to Supabase database.");
      }
      if (data.location) {
        setLocations((prev) => [data.location, ...prev]);
      } else {
        await loadLocationsFromApi();
      }
      return;
    }

    // Local Demo Mode (Explicitly unpersisted browser cache)
    const newLocation: DefaultLocationItem = {
      id: `loc-custom-${Date.now()}`,
      label: loc.label,
      postcode: loc.postcode,
      address: loc.address,
      category: loc.category as DefaultLocationItem["category"],
      created_at: new Date().toISOString(),
    };

    const updated = [newLocation, ...locations];
    setLocations(updated);
    localStorage.setItem("reachng_locations", JSON.stringify(updated));
  }

  async function handleDeleteLocation(id: string) {
    if (supabaseConnected && userEmail) {
      const response = await fetch(`/api/locations?id=${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete location from Supabase database.");
      }
      setLocations((prev) => prev.filter((l) => l.id !== id));
      return;
    }

    // Local Demo Mode
    const updated = locations.filter((l) => l.id !== id);
    setLocations(updated);
    localStorage.setItem("reachng_locations", JSON.stringify(updated));
  }

  async function loadLocationsFromApi() {
    try {
      const response = await fetch("/api/locations");
      if (response.ok) {
        const data = await response.json();
        if (data.locations && Array.isArray(data.locations)) {
          setLocations(data.locations);
          localStorage.setItem("reachng_locations", JSON.stringify(data.locations));
        }
      }
    } catch {
      // Keep local state if server unreachable
    }
  }

  function handleSeedDemoLocations() {
    setLocations(INITIAL_DEMO_LOCATIONS);
    localStorage.setItem("reachng_locations", JSON.stringify(INITIAL_DEMO_LOCATIONS));
  }

  function handleInspectFromDirectory(code: string) {
    setInspectPostcode(code);
    setActiveNav("Explorer");
  }

  return (
    <main className="min-h-screen bg-[var(--canvas)]">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <Sidebar
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          workspaceName={workspaceName}
          setWorkspaceName={handleSelectWorkspace}
          onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          userEmail={userEmail}
          supabaseConnected={supabaseConnected}
          onNewLocationClick={() => setIsAddModalOpen(true)}
        />

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex w-[280px] flex-col bg-white p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--green)] text-white">
                    <MapPin size={18} />
                  </div>
                  <div className="text-lg font-bold text-[var(--ink)]">ReachNG.</div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-full p-1 text-[var(--muted)]"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="space-y-1">
                {[
                  { id: "Explorer", label: "Postcode Explorer", icon: Search },
                  { id: "Directory", label: "State & LGA Directory", icon: Compass },
                  { id: "Batch", label: "Batch Validator", icon: Layers3 },
                  { id: "Corridor", label: "Transit Corridors", icon: Route },
                  { id: "Location book", label: "Location Book", icon: MapPin },
                  { id: "API & integrations", label: "API & Integrations", icon: Terminal },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveNav(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                        isActive
                          ? "bg-[var(--green-soft)] text-[var(--green)] font-bold"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      <Icon size={17} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto border-t border-[var(--line)] pt-4">
                <button
                  onClick={() => {
                    setIsAuthModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full rounded-xl bg-[var(--green-soft)] py-2 text-xs font-bold text-[var(--green)]"
                >
                  {userEmail || "Sign In"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <section className="min-w-0 flex-1 flex flex-col">
          {/* Top Header */}
          <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-[var(--line)] bg-white/90 px-5 sm:px-8 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg p-1.5 text-[var(--muted)] lg:hidden hover:bg-[#f6f8f5]"
              >
                <Menu size={22} />
              </button>

              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="font-extrabold text-[var(--green)] lg:hidden">ReachNG.</span>
                <span className="hidden sm:inline">Workspace</span>
                <span className="hidden sm:inline">/</span>
                <span className="font-bold text-[var(--ink)]">{activeNav}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Environment badge */}
              <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[#fafcf9] px-3 py-1.5 text-xs font-semibold">
                <span
                  className={`h-2 w-2 rounded-full ${
                    providerConfigured ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span className="hidden sm:inline text-[var(--ink)]">
                  {providerConfigured ? "NDAPS Live Gateway" : "NDAPS Simulation Engine"}
                </span>
                <span className="sm:hidden text-[var(--ink)]">
                  {providerConfigured ? "Live" : "Demo"}
                </span>
              </div>

              {/* Add Location shortcut button */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-xl bg-[var(--green)] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[var(--green-hover)] transition"
              >
                <Plus size={14} />
                <span>Add Hub</span>
              </button>
            </div>
          </header>

          {/* Page Body Container */}
          <div className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-8 sm:px-8">
            {/* Hero / Page Headline */}
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2.5 inline-flex items-center gap-2 rounded-full bg-[var(--green-soft)] px-3 py-1 text-xs font-bold text-[var(--green)]">
                  <Sparkles size={13} />
                  <span>NIGERIAN DIGITAL POSTCODE & LOCATION LAYER</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                  Every destination, within reach.
                </h1>
                <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                  Verify 11-character alphanumeric NDAPS digital postcodes, normalize merchant delivery points, and manage enterprise facilities across Nigeria&apos;s 36 states and the FCT.
                </p>
              </div>

              {/* Tab Switcher Pills */}
              <div className="flex flex-wrap rounded-2xl border border-[var(--line)] bg-white p-1 shadow-xs">
                {[
                  { id: "Explorer", label: "Explorer" },
                  { id: "Directory", label: "Directory" },
                  { id: "Batch", label: "Batch" },
                  { id: "Corridor", label: "Corridors" },
                  { id: "Location book", label: "Locations" },
                  { id: "API & integrations", label: "API Sandbox" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveNav(t.id)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                      activeNav === t.id
                        ? "bg-[var(--green)] text-white shadow-xs"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Tab View */}
            {activeNav === "Explorer" && (
              <ExplorerTab
                onSaveLocation={handleSaveLocation}
                onNavigateToLocationBook={() => setActiveNav("Location book")}
                initialPostcode={inspectPostcode}
              />
            )}

            {activeNav === "Directory" && (
              <DirectoryTab
                onSaveLocation={handleSaveLocation}
                onInspectPostcode={handleInspectFromDirectory}
              />
            )}

            {activeNav === "Batch" && <BatchTab />}

            {activeNav === "Corridor" && <CorridorTab locations={locations} />}

            {activeNav === "Location book" && (
              <LocationBookTab
                locations={locations}
                onDeleteLocation={handleDeleteLocation}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onRefresh={loadLocationsFromApi}
                supabaseConnected={supabaseConnected}
                userEmail={userEmail}
                onSeedDemoLocations={handleSeedDemoLocations}
                onPrintLabel={(loc) => setPrintLabelLocation(loc)}
              />
            )}

            {activeNav === "API & integrations" && <ApiIntegrationsTab />}

            {/* Footer */}
            <footer className="mt-16 flex flex-col justify-between gap-3 border-t border-[var(--line)] pt-6 text-xs text-[var(--subtle)] sm:flex-row">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--ink)]">ReachNG</span>
                <span>·</span>
                <span>© {new Date().getFullYear()} ReachNG Technologies Limited</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[var(--green)]" />
                  <span>NDAPS Conformance Guard</span>
                </span>
                <span>·</span>
                <span>36 States + FCT Reference Postal Topology</span>
              </div>
            </footer>
          </div>
        </section>
      </div>

      {/* Modals */}
      <AddLocationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveLocation}
      />

      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        currentWorkspace={workspaceName}
        onSelectWorkspace={handleSelectWorkspace}
        supabaseConnected={supabaseConnected}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        userEmail={userEmail}
        onLogin={handleLogin}
        onLogout={handleLogout}
        supabaseConnected={supabaseConnected}
      />

      <DispatchLabelModal
        isOpen={Boolean(printLabelLocation)}
        onClose={() => setPrintLabelLocation(null)}
        location={printLabelLocation}
        originHubName={locations[0]?.label || "Lagos Sorting Facility"}
      />
    </main>
  );
}
