"use client";

import React, { useState } from "react";
import { X, User, LogIn, LogOut, CheckCircle2, AlertCircle, Info, ShieldAlert } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string | null;
  onLogin: (email: string) => void;
  onLogout: () => void;
  supabaseConnected: boolean;
}

export function AuthModal({
  isOpen,
  onClose,
  userEmail,
  onLogin,
  onLogout,
  supabaseConnected,
}: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setSubmitting(true);
    setErrorMessage("");
    setInfoMessage("");

    if (supabaseConnected) {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setErrorMessage("Supabase client could not be initialized from environment variables.");
        setSubmitting(false);
        return;
      }

      try {
        if (isSignUp) {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                company_name: "ReachNG Enterprise Workspace",
              },
            },
          });
          if (error) {
            setErrorMessage(error.message);
          } else if (data.session) {
            onLogin(data.user?.email || email.trim());
            onClose();
          } else {
            setInfoMessage("Registration successful! Check your email inbox to confirm your account before signing in.");
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) {
            setErrorMessage(error.message);
          } else if (data.user?.email) {
            onLogin(data.user.email);
            onClose();
          }
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Authentication request failed.");
      } finally {
        setSubmitting(false);
      }
    } else {
      // Local Demo Mode only when Supabase is not configured
      setTimeout(() => {
        onLogin(email.trim());
        setSubmitting(false);
        onClose();
      }, 300);
    }
  }

  async function handleSignOut() {
    if (supabaseConnected) {
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }
    onLogout();
    onClose();
  }

  function handleDemoLogin(demoName: string) {
    onLogin(demoName);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">
                {userEmail ? "Account & Session" : isSignUp ? "Create Workspace Account" : "Operator Sign In"}
              </h2>
              <p className="text-xs text-[var(--muted)]">
                {supabaseConnected ? "Supabase Cloud Authentication (PostgreSQL RLS)" : "Local Sandbox Mode (Unconnected Demo)"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--subtle)] hover:bg-[#f0f4f1] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status indicator banner */}
        {!supabaseConnected && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-700" />
              <div>
                <span className="font-bold">Sandbox Demo Mode:</span> Supabase cloud database credentials are not configured in your environment. Operator sessions and locations are stored locally in the browser and will not persist to a PostgreSQL backend.
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {infoMessage && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex items-start gap-2">
            <Info size={15} className="mt-0.5 shrink-0 text-blue-600" />
            <span>{infoMessage}</span>
          </div>
        )}

        {userEmail ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs">
              <div className="flex items-center gap-2 text-emerald-900 font-bold">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>
                  {supabaseConnected ? "Authenticated Supabase Session" : "Local Sandbox Profile"}
                </span>
              </div>
              <div className="mt-1 font-mono text-sm font-semibold text-emerald-950">{userEmail}</div>
              <div className="mt-2 text-[11px] text-emerald-800">
                {supabaseConnected
                  ? "Row Level Security Active: Location CRUD is scoped to your organization membership."
                  : "Local storage fallback: Records remain in your browser session only."}
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Quick Demo Operator Buttons (Only in local demo mode) */}
            {!supabaseConnected && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--subtle)]">
                  Local Sandbox Profiles (Preview Only)
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleDemoLogin("ops-manager@reachng.com")}
                    className="rounded-xl border border-[var(--line)] bg-[#fafcf9] p-2.5 text-left font-medium text-[var(--ink)] hover:border-[var(--green)] hover:bg-[var(--green-soft)] transition"
                  >
                    <div className="font-bold text-[var(--green)]">Logistics Lead</div>
                    <div className="text-[10px] text-[var(--muted)] truncate">ops-manager@reachng.com</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoLogin("developer@merchant.ng")}
                    className="rounded-xl border border-[var(--line)] bg-[#fafcf9] p-2.5 text-left font-medium text-[var(--ink)] hover:border-[var(--green)] hover:bg-[var(--green-soft)] transition"
                  >
                    <div className="font-bold text-[var(--orange)]">API Engineer</div>
                    <div className="text-[10px] text-[var(--muted)] truncate">developer@merchant.ng</div>
                  </button>
                </div>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--line)]" />
                  </div>
                  <span className="relative bg-white px-2 text-[10px] font-bold uppercase text-[var(--subtle)]">
                    Or Enter Email
                  </span>
                </div>
              </div>
            )}

            {/* Email form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-10 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3 text-xs outline-none focus:border-[var(--green)] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3 text-xs outline-none focus:border-[var(--green)] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--green)] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--green-hover)] disabled:opacity-50"
              >
                <LogIn size={15} />
                <span>
                  {submitting
                    ? "Processing..."
                    : isSignUp
                    ? "Register Workspace Account"
                    : "Sign In to Workspace"}
                </span>
              </button>
            </form>

            {supabaseConnected && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMessage("");
                    setInfoMessage("");
                  }}
                  className="text-xs text-[var(--green)] font-semibold hover:underline"
                >
                  {isSignUp ? "Already have an account? Sign in" : "Need a workspace account? Sign up"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
