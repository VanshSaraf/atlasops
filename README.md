<div align="center">

```
 █████╗ ████████╗██╗      █████╗ ███████╗ ██████╗ ██████╗ ███████╗
██╔══██╗╚══██╔══╝██║     ██╔══██╗██╔════╝██╔═══██╗██╔══██╗██╔════╝
███████║   ██║   ██║     ███████║███████╗██║   ██║██████╔╝███████╗
██╔══██║   ██║   ██║     ██╔══██║╚════██║██║   ██║██╔═══╝ ╚════██║
██║  ██║   ██║   ███████╗██║  ██║███████║╚██████╔╝██║     ███████║
╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝     ╚══════╝
```

**AI-powered CI/CD remediation — from failing repo to validated fix, automatically.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)

</div>

---

## What Is AtlasOps?

AtlasOps is a **developer-first CI/CD remediation workspace**. Feed it a failing repository — via GitHub URL or local path — and it reproduces the problem, classifies the root cause, generates recovery changes, validates the patch, and hands you a reviewable artifact bundle. No more digging through noisy logs. No more manual patch-and-rerun cycles.

> **Review-first by default.** AtlasOps never mutates your source without your say-so. Every run produces inspectable diagnostics and a downloadable patched workspace you control.

---

## The Problem It Solves

CI failures are expensive for two reasons:

- The root cause is **buried in noisy, unstructured logs**
- The path from failure to validated fix is **manual and repetitive**

AtlasOps closes that loop:

| Without AtlasOps | With AtlasOps |
|---|---|
| Scroll through 800 lines of CI output | Structured failure classification, instantly |
| Manually edit, commit, push, wait | Multi-pass remediation loop with retry control |
| Hope the fix worked | Reruns validation before surfacing anything |
| Nothing preserved for review | Downloadable patched bundle + full run timeline |

---

## Core Capabilities

```
┌─────────────────────────────────────────────────────────┐
│                   ATLASOPS PIPELINE                     │
│                                                         │
│  INGEST → DETECT → CLASSIFY → FIX → VALIDATE → EXPORT   │
│                                                         │
│  ▸ GitHub URL or local path input                       │
│  ▸ Auto-detects Python, Node.js / TypeScript            │
│  ▸ Multi-pass remediation with retry control            │
│  ▸ Deterministic parsing + model-assisted fallback      │
│  ▸ Review-first artifact bundle output                  │
│  ▸ Optional GitHub branch / PR writeback                │
└─────────────────────────────────────────────────────────┘
```

---

## How It Works

```
  1. Receive repo (URL or local path)
       │
       ▼
  2. Create isolated working copy
       │
       ▼
  3. Detect language, install command, validation command
       │
       ▼
  4. Install dependencies → Run checks
       │
       ├── PASS ──────────────────────────────────┐
       │                                          │
       ▼                                          │
  5. Classify failure                             │
       │                                          │
       ▼                                          │
  6. Generate code fix(es)                        │
       │                                          │
       ▼                                          │
  7. Apply fix → Rerun validation                 │
       │                                          │
       ├── PASS ────────────────────────────────► │
       │                                          │
       └── FAIL → retry until limit reached       │
                                                  ▼
                                         8. Store artifacts
                                            Expose download bundle
```

---

## Project Structure

```
atlasops/
│
├── src/                          # Express backend
│   ├── agents/
│   │   ├── repo-analyzer.agent.ts       # Language detection, command selection
│   │   ├── failure-classifier.agent.ts  # Parsing + classification
│   │   └── fix-generator.agent.ts       # Deterministic + model-assisted fixes
│   ├── routes/
│   │   ├── agent.route.ts               # Run creation, download endpoints
│   │   └── health.route.ts              # Runtime health
│   ├── services/                        # Docker, diagnostics, runtime helpers
│   ├── utils/                           # Config, logging, validation
│   └── orchestrator.ts                  # Recovery loop, artifacts, writeback
│
├── frontend/                     # Next.js 14 dashboard
│   ├── app/
│   │   ├── page.tsx                     # Landing page
│   │   ├── dashboard/page.tsx           # Dashboard workspace
│   │   └── dashboard/runs/[id]/page.tsx # Run detail + diagnostics
│   └── components/
│       ├── RunTriggerForm.tsx           # Launch flow + writeback toggle
│       ├── CICDTimeline.tsx             # Recovery timeline UI
│       └── FixesTable.tsx              # Applied fixes table
│
├── docker/                       # Optional execution images
├── artifacts/runs/               # Preserved run artifacts + patched outputs
├── test-repos/                   # Bundled sample repos
├── .env.example                  # Backend environment template
└── frontend/.env.example         # Frontend environment template
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | TypeScript · Express · simple-git · axios |
| Frontend | Next.js 14 · React 18 · Tailwind CSS · Zustand |
| Execution | Docker (optional) · host fallback |
| AI | Configurable model provider (NVIDIA NIM or compatible) |

---

## Local Setup

### 1 — Install dependencies

```bash
# From repo root
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 2 — Create environment files

```bash
# Backend
cp .env.example .env

# Frontend
cp frontend/.env.example frontend/.env.local
```

### 3 — Configure environment variables

**Backend — `.env`**

| Variable | Description |
|---|---|
| `PORT` | Local backend port — usually `3001` |
| `NODE_ENV` | `development` or `production` |
| `FRONTEND_URL` | Allowed frontend origin for CORS, for example `http://localhost:3000` |
| `ARTIFACTS_DIR` | Run artifact directory, defaults to `artifacts` |
| `GITHUB_TOKEN` | GitHub token with repo access |
| `GITHUB_OWNER` | Your org or username |
| `GITHUB_REPO` | Target repository name |
| `RETRY_LIMIT` | Max automated remediation attempts |
| `AGENT_TIMEOUT_MS` | Agent timeout in milliseconds |
| `TEAM_NAME` | Run metadata — team or org name |
| `LEADER_NAME` | Run metadata — operator or owner name |
| `ALLOW_HOST_FALLBACK` | Keep `false` on hosted deployments; use `true` only for trusted local/demo repos without Docker |
| `NVIDIA_API_URL` | Model provider chat-completions endpoint |
| `NVIDIA_API_KEY` | Model provider API key |
| `WEBHOOK_URL` | Optional notifications webhook (or leave blank) |

**Frontend — `frontend/.env.local`**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Usually `http://localhost:3001` |

---

## Running Locally

**Terminal 1 — Backend**

```bash
npm run build
npm start
```

Health check → [http://localhost:3001/health](http://localhost:3001/health)

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

Dashboard → [http://localhost:3000](http://localhost:3000)

---

## Testing AtlasOps

### Recommended order

```
1. Start backend           →   npm run build && npm start
2. Start frontend          →   cd frontend && npm run dev
3. Open dashboard          →   http://localhost:3000/dashboard
4. Verify backend in Settings
5. Launch a sample repo run
6. Review timeline, diagnostics, patched output
```

### Bundled sample repositories

Paste any of these directly into the run form:

```
/path/to/atlasops/test-repos/repo1-python-unused-import
/path/to/atlasops/test-repos/repo2-python-syntax-error
/path/to/atlasops/test-repos/repo3-node-missing-import
```

---

## Workflows

### Review-first (default)

No GitHub mutations. Inspect everything before integrating.

```
Run analysis → Inspect diagnostics → Review generated changes
    → Download patched zip → Manually compare / integrate
```

### GitHub writeback (optional)

Enable the writeback toggle in the run form. AtlasOps will attempt branch or push operations. If permissions are insufficient, the run still preserves local artifacts.

```
Run analysis → Apply fixes → Commit → Branch / Push
                                  ↓ (on permission failure)
                          Preserve local artifact bundle
```

---

## Artifacts & Outputs

All run outputs are preserved under `ARTIFACTS_DIR`, which defaults to `artifacts/`. Each run typically contains:

```
artifacts/runs/<run-id>/
  ├── result.json            # Run parameters, status, timestamps
  ├── workspace/             # Isolated working copy with applied fixes
  └── <run-id>.zip           # Downloadable corrected workspace
```

A latest-run summary is also written to `artifacts/results.json` after each run.

---

## Key Source Files

### Backend

| File | Responsibility |
|---|---|
| `src/orchestrator.ts` | Recovery loop, artifact handling, writeback logic |
| `src/agents/repo-analyzer.agent.ts` | Repo inspection, language detection, command selection |
| `src/agents/failure-classifier.agent.ts` | Parsing and failure classification |
| `src/agents/fix-generator.agent.ts` | Deterministic and provider-assisted fix generation |
| `src/routes/agent.route.ts` | Run creation and download endpoints |
| `src/routes/health.route.ts` | Runtime health endpoint |

### Frontend

| File | Responsibility |
|---|---|
| `frontend/app/page.tsx` | Landing page |
| `frontend/app/dashboard/page.tsx` | Dashboard workspace |
| `frontend/app/dashboard/runs/[id]/page.tsx` | Run detail and diagnostics |
| `frontend/components/RunTriggerForm.tsx` | Launch flow and writeback toggle |
| `frontend/components/CICDTimeline.tsx` | Recovery timeline UI |
| `frontend/components/FixesTable.tsx` | Applied fixes table |

---

## Troubleshooting

**`localhost:3001` shows `Cannot GET /`**
> Expected — the backend is API-only. Use `http://localhost:3001/health` to verify it's running.

**Run fails immediately**
> Verify the backend is running, `NEXT_PUBLIC_API_URL` points to `http://localhost:3001`, the local path exists, and required runtimes (`node`, `python`) are installed.

**GitHub push fails with `403`**
> Your token lacks write access to the target repo. AtlasOps will still preserve a local artifact bundle for review.

**Provider errors like `HTTP unknown`**
> Check `NVIDIA_API_URL`, `NVIDIA_API_KEY`, provider quota, and network availability.

**Docker warnings**
> AtlasOps uses Docker when available. If Docker is unavailable, host fallback is disabled unless `ALLOW_HOST_FALLBACK=true`. Keep it disabled on hosted deployments unless every input repository is trusted.

---

## Deployment

Deployment guidance lives in [`docs/deployment.md`](docs/deployment.md).

Recommended split:

| Component | Platform | Notes |
|---|---|---|
| Backend | Render Docker Web Service | Uses `Dockerfile` and `render.yaml`; `/health` is the health check. |
| Frontend | Vercel | Set root directory to `frontend` and `NEXT_PUBLIC_API_URL` to the backend URL. |

Free hosted filesystems are ephemeral, so run artifacts are best-effort unless you add durable object storage later.

---

## Deployment Checklist

```
□  Set all backend environment variables
□  Set NEXT_PUBLIC_API_URL for frontend
□  Keep secrets in deployment platform — never in source
□  Keep ALLOW_HOST_FALLBACK=false on shared/free hosting
□  Verify GitHub token permissions before enabling writeback
□  Verify model-provider access and quota
□  Confirm artifact storage is available for preserved run bundles
```

---

## Available Scripts

**Backend**

```bash
npm run build   # Compile TypeScript
npm start       # Start compiled backend
npm run dev     # Watch mode
```

**Frontend**

```bash
npm run dev     # Next.js dev server
npm run build   # Production build
npm run start   # Serve built frontend
```

---

<div align="center">

**AtlasOps** · AI-powered CI/CD remediation · Built for developers who ship fast

*Reproduce · Classify · Fix · Validate · Preserve*

</div>
