"use client";

import React, { useState } from "react";
import {
  Terminal,
  Code2,
  Copy,
  Check,
  Send,
  Zap,
  ShieldCheck,
  Radio,
} from "lucide-react";

export function ApiIntegrationsTab() {
  const [selectedLanguage, setSelectedLanguage] = useState<"curl" | "javascript" | "python" | "node">("curl");
  const [selectedEndpoint, setSelectedEndpoint] = useState<"/api/postcode" | "/api/batch" | "/api/locations">("/api/postcode");
  const [requestPostcode, setRequestPostcode] = useState("LA010010101");

  // Sandbox state
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveResponse, setLiveResponse] = useState<unknown | null>(null);
  const [liveStatus, setLiveStatus] = useState<number | null>(null);
  const [liveLatency, setLiveLatency] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Webhook Simulator state
  const [webhookEvent, setWebhookEvent] = useState("postcode.verified");
  const [webhookUrl, setWebhookUrl] = useState("https://api.yourbusiness.com/webhooks/reachng");
  const [webhookTriggered, setWebhookTriggered] = useState(false);

  function getCodeSnippet(): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

    if (selectedEndpoint === "/api/postcode") {
      switch (selectedLanguage) {
        case "curl":
          return `curl -X POST "${origin}/api/postcode" \\
  -H "Content-Type: application/json" \\
  -d '{"postcode": "${requestPostcode}"}'`;
        case "javascript":
          return `const response = await fetch("${origin}/api/postcode", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ postcode: "${requestPostcode}" })
});
const data = await response.json();
console.log(data);`;
        case "node":
          return `const axios = require("axios");

const { data } = await axios.post("${origin}/api/postcode", {
  postcode: "${requestPostcode}"
});
console.log(data);`;
        case "python":
          return `import requests

url = "${origin}/api/postcode"
payload = {"postcode": "${requestPostcode}"}
response = requests.post(url, json=payload)
data = response.json()
print(data)`;
      }
    } else if (selectedEndpoint === "/api/batch") {
      switch (selectedLanguage) {
        case "curl":
          return `curl -X POST "${origin}/api/batch" \\
  -H "Content-Type: application/json" \\
  -d '{"items": ["LA010010101", "AB010020110", "RV010010304"]}'`;
        case "javascript":
          return `const response = await fetch("${origin}/api/batch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ items: ["LA010010101", "AB010020110", "RV010010304"] })
});
const data = await response.json();
console.log(data);`;
        case "node":
          return `const axios = require("axios");

const { data } = await axios.post("${origin}/api/batch", {
  items: ["LA010010101", "AB010020110", "RV010010304"]
});
console.log(data);`;
        case "python":
          return `import requests

url = "${origin}/api/batch"
payload = {"items": ["LA010010101", "AB010020110", "RV010010304"]}
response = requests.post(url, json=payload)
data = response.json()
print(data)`;
      }
    } else {
      switch (selectedLanguage) {
        case "curl":
          return `curl -X GET "${origin}/api/locations" \\
  -H "Cookie: sb-access-token=YOUR_SESSION_TOKEN"`;
        case "javascript":
          return `const response = await fetch("${origin}/api/locations");
const data = await response.json();
console.log(data.locations);`;
        case "node":
          return `const axios = require("axios");

const { data } = await axios.get("${origin}/api/locations");
console.log(data.locations);`;
        case "python":
          return `import requests

url = "${origin}/api/locations"
response = requests.get(url)
print(response.json())`;
      }
    }
  }

  async function executeLiveRequest() {
    setLiveLoading(true);
    setLiveResponse(null);
    setLiveStatus(null);
    const start = performance.now();

    try {
      let res: Response;
      if (selectedEndpoint === "/api/postcode") {
        res = await fetch("/api/postcode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postcode: requestPostcode }),
        });
      } else if (selectedEndpoint === "/api/batch") {
        res = await fetch("/api/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [requestPostcode, "AB010020110", "RV010010304"] }),
        });
      } else {
        res = await fetch("/api/locations");
      }

      const elapsed = Math.round(performance.now() - start);
      setLiveLatency(elapsed);
      setLiveStatus(res.status);
      const data = await res.json();
      setLiveResponse(data);
    } catch (err) {
      setLiveStatus(500);
      setLiveResponse({ error: err instanceof Error ? err.message : "Failed to execute request" });
    } finally {
      setLiveLoading(false);
    }
  }

  function copySnippet() {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function triggerWebhookSimulation() {
    setWebhookTriggered(true);
    setTimeout(() => setWebhookTriggered(false), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--green-soft)] text-[var(--green)]">
                <Terminal size={18} />
              </div>
              <h2 className="text-lg font-bold text-[var(--ink)]">Developer API & Integration Sandbox</h2>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Integrate Nigerian digital postcode verification, batch address hygiene, and location records directly into your checkout and ERP.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              v1 API Ready
            </span>
          </div>
        </div>

        {/* Security Alert */}
        <div className="mt-6 rounded-2xl border border-[var(--green-soft-border)] bg-[var(--green-soft)] p-4 text-xs text-[var(--green-deep)]">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--green)]" />
            <div>
              <span className="font-bold">Zero Client-Side Key Exposure:</span> All official NDAPS government API credentials remain strictly confined to secure Node.js server runtimes. Your browser clients and public bundles never receive raw provider keys.
            </div>
          </div>
        </div>
      </div>

      {/* Interactive API Sandbox */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Request Configurator & Code Snippets */}
        <div className="flex flex-col rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div className="flex items-center gap-2">
              <Code2 size={16} className="text-[var(--green)]" />
              <span className="text-xs font-bold text-[var(--ink)]">API Request Builder</span>
            </div>

            {/* Language Selector */}
            <div className="flex rounded-lg bg-[#f0f4f1] p-1 text-[11px] font-semibold">
              {(["curl", "javascript", "python", "node"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`rounded-md px-2.5 py-1 uppercase transition ${
                    selectedLanguage === lang ? "bg-white font-bold text-[var(--green)] shadow-xs" : "text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint Selector */}
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Target Endpoint</label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(
                  [
                    { path: "/api/postcode", label: "POST /postcode" },
                    { path: "/api/batch", label: "POST /batch" },
                    { path: "/api/locations", label: "GET /locations" },
                  ] as const
                ).map((ep) => (
                  <button
                    key={ep.path}
                    onClick={() => setSelectedEndpoint(ep.path)}
                    className={`rounded-xl border p-2.5 text-center font-mono text-[11px] font-bold transition ${
                      selectedEndpoint === ep.path
                        ? "border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]"
                        : "border-[var(--line)] bg-[#fafcf9] text-[var(--muted)] hover:border-gray-300"
                    }`}
                  >
                    {ep.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedEndpoint !== "/api/locations" && (
              <div>
                <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Sample Postcode Param</label>
                <input
                  value={requestPostcode}
                  onChange={(e) => setRequestPostcode(e.target.value.toUpperCase())}
                  maxLength={11}
                  className="h-10 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3 font-mono text-xs font-bold text-[var(--ink)] outline-none focus:border-[var(--green)]"
                />
              </div>
            )}
          </div>

          {/* Code snippet display */}
          <div className="relative mt-4 flex-1">
            <button
              onClick={copySnippet}
              className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-emerald-300 backdrop-blur-sm hover:bg-white/20 transition"
              title="Copy snippet"
            >
              {copiedCode ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedCode ? "Copied" : "Copy"}</span>
            </button>
            <pre className="h-[200px] overflow-auto rounded-2xl bg-[var(--code-bg)] p-4 font-mono text-xs leading-5 text-emerald-300">
              {getCodeSnippet()}
            </pre>
          </div>

          <button
            onClick={executeLiveRequest}
            disabled={liveLoading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--green)] py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--green-hover)] disabled:opacity-50"
          >
            {liveLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
            ) : (
              <Send size={15} />
            )}
            <span>Execute Live Sandbox Call</span>
          </button>
        </div>

        {/* Live Response Bench */}
        <div className="flex flex-col rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-[var(--orange)]" />
              <span className="text-xs font-bold text-[var(--ink)]">Live Response Bench</span>
            </div>

            {liveStatus && (
              <div className="flex items-center gap-3 text-xs font-mono">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    liveStatus < 400 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  HTTP {liveStatus}
                </span>
                {liveLatency !== null && (
                  <span className="text-[var(--muted)]">{liveLatency}ms</span>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex-1">
            {liveResponse ? (
              <pre className="h-[320px] overflow-auto rounded-2xl bg-[var(--code-bg)] p-4 font-mono text-xs leading-5 text-emerald-300">
                {JSON.stringify(liveResponse, null, 2)}
              </pre>
            ) : (
              <div className="flex h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#ccd9d0] bg-[#fafcf9] p-6 text-center text-xs text-[var(--muted)]">
                <Terminal size={32} className="mb-2 text-[#a8b8ae]" />
                <div className="font-bold text-[var(--ink)]">Awaiting Sandbox Execution</div>
                <p className="mt-1 max-w-xs leading-relaxed">
                  Click &quot;Execute Live Sandbox Call&quot; on the left to fire a live test query against the ReachNG endpoint.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Webhook Simulator Section */}
      <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fff0e4] text-[var(--orange)]">
              <Radio size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">Client-Side Webhook Payload Simulator</h3>
              <p className="text-xs text-[var(--muted)]">
                Local preview of webhook callback payloads and HMAC-SHA256 signature formatting. (Prototyping simulator — does not dispatch network HTTP requests).
              </p>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900">
            Local Prototyping Only
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Event Trigger Type</label>
            <select
              value={webhookEvent}
              onChange={(e) => setWebhookEvent(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3 text-xs outline-none focus:border-[var(--green)]"
            >
              <option value="postcode.verified">postcode.verified (NDAPS provider confirmation)</option>
              <option value="location.created">location.created (Location Book sync)</option>
              <option value="address.flagged">address.flagged (Format error alert)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-[var(--ink)]">Target Webhook URL (Documentation Example)</label>
            <input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#d6dfd8] bg-[#fafcf9] px-3 font-mono text-xs outline-none focus:border-[var(--green)]"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
          <button
            onClick={triggerWebhookSimulation}
            className="flex items-center gap-2 rounded-xl bg-[var(--orange)] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#d95d18]"
          >
            <Radio size={14} />
            <span>Generate Mock Webhook Payload</span>
          </button>

          {webhookTriggered && (
            <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 border border-amber-200">
              <Check size={14} /> Simulated payload & HMAC signature generated locally
            </span>
          )}
        </div>

        {webhookTriggered && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 font-mono text-xs text-[var(--ink)]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-2 font-sans">
              Simulated Outbound HTTP Headers & Payload (Demo View):
            </div>
            <div className="text-gray-600 mb-2">
              POST {webhookUrl}
              <br />
              X-ReachNG-Event: {webhookEvent}
              <br />
              X-ReachNG-Signature: sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 (Simulated HMAC)
              <br />
              X-ReachNG-Timestamp: {new Date().toISOString()}
            </div>
            <pre className="overflow-x-auto rounded-xl bg-black p-3 text-[11px] text-emerald-400">
{JSON.stringify(
  {
    event: webhookEvent,
    timestamp: new Date().toISOString(),
    isSimulation: true,
    data: {
      postcode: "LA010010101",
      state: "Lagos",
      lga: "Ikeja",
      verified: true,
      provider: "ndaps-live-gateway",
    },
  },
  null,
  2
)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
