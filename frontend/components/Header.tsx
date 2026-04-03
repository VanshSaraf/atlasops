"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSettingsStore } from "@/store/useSettingsStore";
import { checkHealth } from "@/lib/api";
import Logo from "@/components/Logo";
import { APP_NAME } from "@/lib/constants";

type BackendStatus = "checking" | "online" | "offline";

export default function Header() {
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [uptime, setUptime] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await checkHealth();
        if (!active) return;
        if (res.status === "ok") {
          setStatus("online");
          setUptime(Math.round(res.uptime));
        } else {
          setStatus("offline");
          setUptime(null);
        }
      } catch {
        if (!active) return;
        setStatus("offline");
        setUptime(null);
      }
    }

    poll();
    const interval = setInterval(poll, 10_000); // check every 10s
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const statusColor =
    status === "online"
      ? "bg-emerald-500"
      : status === "offline"
        ? "bg-red-500"
        : "bg-yellow-500";

  const statusText =
    status === "online"
      ? `Backend Online${uptime !== null ? ` · ${uptime}s` : ""}`
      : status === "offline"
        ? "Backend Offline"
        : "Checking…";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-white/6 bg-[#081117]/95 px-4 backdrop-blur-xl lg:px-6">
      <button
        onClick={toggleSidebar}
        className="rounded-2xl border border-white/8 bg-white/[0.03] p-2.5 text-ink-400 transition-colors hover:border-white/12 hover:bg-white/[0.06] hover:text-white lg:hidden"
        aria-label="Toggle sidebar"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <Link href="/" className="flex items-center gap-3 rounded-2xl border border-transparent px-2 py-1.5 transition-colors hover:border-white/8 hover:bg-white/[0.03]">
        <Logo size="sm" />
      </Link>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 lg:flex">
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-500">
            {APP_NAME}
          </span>
          <span className="h-1 w-1 rounded-full bg-ink-600" />
          <span className="font-mono text-[11px] text-ink-400">
            developer remediation workspace
          </span>
        </div>
        <div
          className={`hidden items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-medium sm:flex ${
            status === "online"
              ? "border-emerald-500/18 bg-emerald-500/10 text-emerald-300"
              : status === "offline"
                ? "border-red-500/18 bg-red-500/10 text-red-300"
                : "border-yellow-500/18 bg-yellow-500/10 text-yellow-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${statusColor} ${status === "online" ? "animate-pulse-slow" : status === "checking" ? "animate-pulse" : ""}`}
          />
          {statusText}
        </div>

        <Link
          href="/dashboard"
          className="hidden rounded-full border border-white/8 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] text-ink-300 transition-colors hover:border-brand-500/20 hover:text-white md:inline-flex"
        >
          Open Workspace
        </Link>

        {/* Auth placeholder */}
      </div>
    </header>
  );
}
