"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_REPOSITORY_URL,
  APP_TAGLINE,
} from "@/lib/constants";

const FEATURES = [
  {
    title: "Repository Intelligence",
    desc: "AtlasOps maps repository context, build signals, and failure traces before suggesting a remediation path.",
  },
  {
    title: "Controlled Verification",
    desc: "Every candidate fix is validated inside an isolated execution flow designed for repeatable CI recovery.",
  },
  {
    title: "Safe Remediation Workflow",
    desc: "Changes are generated for review, validated against the failure, and promoted through a reviewable branch strategy.",
  },
  {
    title: "Operator Visibility",
    desc: "Follow each recovery run with a clear control-room dashboard built around outcomes, not noisy logs.",
  },
];

const STEPS = [
  { num: "01", label: "Inspect", accent: "from-brand-400 to-brand-600" },
  { num: "02", label: "Reproduce", accent: "from-brand-500 to-accent-400" },
  { num: "03", label: "Diagnose", accent: "from-accent-400 to-accent-500" },
  { num: "04", label: "Remediate", accent: "from-brand-600 to-accent-500" },
  { num: "05", label: "Validate", accent: "from-accent-500 to-brand-400" },
  { num: "06", label: "Promote", accent: "from-brand-400 to-accent-400" },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[620px] w-[920px] -translate-x-1/2 rounded-full bg-brand-500/[0.1] blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-sky-500/[0.06] blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
        <Logo size="md" />
        <Link
          href="/dashboard"
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:border-brand-500/20 hover:bg-white/[0.08]"
        >
          Open Workspace
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-12 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-28 lg:pt-20">
        <div className="pt-10">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/[0.08] px-4 py-1.5 text-sm font-medium text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
          {APP_TAGLINE}
          </div>

          <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-[4.5rem]">
            A cleaner developer space for
            <span className="bg-gradient-to-r from-brand-300 via-brand-500 to-sky-400 bg-clip-text text-transparent">
              {" "}diagnosing, patching, and reviewing failing repos
            </span>
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-300 sm:text-xl">
            {APP_NAME} is a review-first remediation workspace. Reproduce the failure, inspect exact diagnostics, generate a corrected workspace, and download the patched project before choosing whether to write anything back to GitHub.
          </p>

          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row">
            <Link
              href="/dashboard"
              className="group rounded-2xl bg-brand-500 px-8 py-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(46,158,135,0.28)] transition-all hover:-translate-y-0.5 hover:bg-brand-400"
            >
              Open Developer Workspace
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
            <a
              href={APP_REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-surface-border px-6 py-4 text-base font-medium text-ink-200 transition-colors hover:border-brand-500/30 hover:text-white"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              View Source
            </a>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Diagnostics", value: "exact failing command + error excerpt" },
              { label: "Patch Review", value: "changed files + downloadable zip artifacts" },
              { label: "Writeback", value: "optional GitHub writeback after review" },
            ].map((item) => (
              <div key={item.label} className="console-panel px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-500">
                  {item.label}
                </p>
                <p className="mt-2 font-mono text-xs text-ink-200">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="console-panel p-5 lg:mt-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <span className="font-mono text-[11px] text-ink-500">workspace-preview.ts</span>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
          </div>
          <pre className="mt-4 overflow-x-auto font-mono text-xs leading-7 text-ink-300">
{`run {
  source: "repo url | local path"
  mode: "review-first"
  classify: true
  patch: true
  artifact: "zip + workspace"
  writeback: "optional"
}

diagnostics {
  failingCommand: "python3 -m pytest tests"
  category: "TEST | SETUP | PROVIDER | PERMISSION"
  changedFiles: ["src/calculator.py"]
}`}
          </pre>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-5xl px-6 py-16 lg:px-8">
        <h2 className="mb-12 text-center text-sm font-semibold uppercase tracking-[0.2em] text-ink-400">
          Developer Workflow
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {STEPS.map(({ num, label, accent }) => (
            <div
              key={num}
              className="group flex flex-col items-center rounded-[24px] border border-surface-border bg-surface-raised/60 p-5 text-center transition-all hover:border-brand-500/30 hover:bg-surface-overlay/70"
            >
              <span
                className={`mb-3 bg-gradient-to-r ${accent} bg-clip-text text-2xl font-black text-transparent`}
              >
                {num}
              </span>
              <span className="text-sm font-semibold text-white">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Built for{" "}
            <span className="bg-gradient-to-r from-brand-400 to-sky-400 bg-clip-text text-transparent">
              engineers who want control
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-ink-400">
            The product is structured around trust: exact diagnostics, reviewable output, and optional GitHub writeback only after inspection.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ title, desc }) => (
            <div
              key={title}
              className="group rounded-[28px] border border-surface-border bg-surface-raised/50 p-6 transition-all hover:border-brand-500/20 hover:bg-surface-overlay/60"
            >
              <div className="mb-4 h-1.5 w-14 rounded-full bg-gradient-to-r from-brand-400 to-accent-400" />
              
              <h3 className="mb-2 text-base font-semibold text-white">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-ink-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-6 py-20 text-center lg:px-8">
        <div className="rounded-[32px] border border-surface-border bg-gradient-to-b from-surface-raised to-surface p-12 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Turn repo recovery into a reviewable engineering flow
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-ink-400">
            {APP_DESCRIPTION}
          </p>
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="inline-block rounded-2xl bg-brand-500 px-8 py-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(46,158,135,0.28)] transition-all hover:-translate-y-0.5 hover:bg-brand-400"
            >
              Explore the Dashboard
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-surface-border py-8 text-center text-xs text-ink-500">
        <p>
          © {new Date().getFullYear()} {APP_NAME}. Built for engineering teams
          that care about delivery confidence.
        </p>
      </footer>
    </div>
  );
}
