"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettingsStore } from "@/store/useSettingsStore";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    meta: "overview",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    label: "Runs",
    href: "/dashboard/runs",
    meta: "history",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    meta: "config",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useSettingsStore();

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 mt-16 flex w-64 flex-col border-r border-white/6 bg-[#071015] transition-transform duration-200 lg:static lg:mt-0 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link
          href="/"
          onClick={() => setSidebarOpen(false)}
          className="border-b border-white/6 px-4 py-5 transition-colors hover:bg-white/[0.02]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-ink-500">
            AtlasOps
          </p>
          <p className="mt-2 text-sm font-semibold text-white">Home</p>
          <p className="mt-1 font-mono text-[11px] text-ink-400">
            landing page and product overview
          </p>
        </Link>

        <div className="border-b border-white/6 px-4 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-ink-500">
            Workspace
          </p>
          <p className="mt-2 text-sm font-semibold text-white">Remediation Workspace</p>
          <p className="mt-1 font-mono text-[11px] text-ink-400">
            inspect runs, review fixes, export patched workspaces
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm transition-colors",
                  isActive
                    ? "border-brand-500/20 bg-brand-500/12 text-brand-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    : "border-transparent text-ink-400 hover:border-white/8 hover:bg-white/[0.03] hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border",
                    isActive
                      ? "border-brand-500/20 bg-brand-500/10"
                      : "border-white/8 bg-white/[0.02]",
                  )}
                >
                  {item.icon}
                </span>
                <div className="flex flex-col">
                  <span className="font-medium">{item.label}</span>
                  <span className="font-mono text-[11px] text-ink-500">
                    {item.meta}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/6 p-3">
          <div className="console-panel p-4 text-xs text-ink-400">
            <p className="eyebrow">Console State</p>
            <p className="font-medium text-white">{APP_NAME} v1.0</p>
            <p className="mt-1 font-mono text-[11px] text-ink-400">review-first remediation workspace</p>
          </div>
        </div>
      </aside>
    </>
  );
}
