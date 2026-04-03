"use client";

import { useState, useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { checkHealth } from "@/lib/api";
import type { HealthResponse } from "@/types";
import { formatDuration } from "@/lib/utils";

export default function SettingsPage() {
  const { apiUrl, setApiUrl } = useSettingsStore();
  const [url, setUrl] = useState(apiUrl);
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  function handleSave() {
    setApiUrl(url.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleHealthCheck() {
    setChecking(true);
    setHealth(null);
    setHealthError(null);
    try {
      const res = await checkHealth();
      setHealth(res);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    setUrl(apiUrl);
  }, [apiUrl]);

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-ink-400">
          Configure the AtlasOps control plane connection
        </p>
      </div>

      <div className="card max-w-2xl space-y-4">
        <h2 className="section-title">API Connection</h2>

        <div>
          <label
            htmlFor="apiUrl"
            className="block text-sm font-medium text-ink-200"
          >
            Backend API URL
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="apiUrl"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input-field flex-1"
              placeholder="http://localhost:3001"
            />
            <button onClick={handleSave} className="btn-primary">
              {saved ? "Saved!" : "Save"}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink-500">
            The base URL of the AtlasOps backend API
          </p>
        </div>

        <div className="border-t border-surface-border pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Health Check</h3>
            <button
              onClick={handleHealthCheck}
              disabled={checking}
              className="btn-secondary text-xs"
            >
              {checking ? "Checking..." : "Test Connection"}
            </button>
          </div>

          {health && (
            <div className="mt-3 space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-emerald-400">
                  Connected
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-ink-500">Status:</span>{" "}
                  <span className="text-white">{health.status}</span>
                </div>
                <div>
                  <span className="text-ink-500">Version:</span>{" "}
                  <span className="text-white">{health.version}</span>
                </div>
                <div>
                  <span className="text-ink-500">Uptime:</span>{" "}
                  <span className="text-white">
                    {formatDuration(health.uptime)}
                  </span>
                </div>
                <div>
                  <span className="text-ink-500">Timestamp:</span>{" "}
                  <span className="text-white">{health.timestamp}</span>
                </div>
              </div>
            </div>
          )}

          {healthError && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-sm font-medium text-red-400">
                  Connection Failed
                </span>
              </div>
              <p className="mt-1 text-xs text-red-300">{healthError}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card max-w-2xl space-y-3">
        <h2 className="section-title">About</h2>
        <div className="space-y-2 text-sm text-ink-400">
          <p>
            <span className="font-medium text-white">AtlasOps</span> is an AI
            delivery reliability platform for diagnosing failures, proposing
            safe fixes, and keeping release velocity intact.
          </p>
          <p>
            It uses a multi-stage workflow: repository analysis, failure
            classification, fix generation, validation, and branch promotion
            are coordinated through a single operator-facing dashboard.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-surface-border pt-3 text-xs">
          <InfoItem label="Frontend" value="Next.js 14 + TypeScript" />
          <InfoItem label="Backend" value="Node.js 20 + Express" />
          <InfoItem
            label="AI Layer"
            value="Provider-configurable patch generation"
          />
          <InfoItem label="State" value="Zustand" />
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-ink-500">{label}:</span>{" "}
      <span className="text-ink-200">{value}</span>
    </div>
  );
}
