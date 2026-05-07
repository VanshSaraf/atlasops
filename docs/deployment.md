# AtlasOps Deployment

## Recommended Architecture

Use Render for the Express backend and Vercel for the Next.js frontend.

The backend Dockerfile installs Node.js runtime dependencies plus `git`, Python, pip, and `zip`, which are needed for cloning repositories and producing artifacts. Render's Docker web service is therefore the most predictable free/low-cost backend option for this repo.

Important limitation: AtlasOps validates repository code. Render web services do not provide a Docker daemon for running nested validation containers. With the default `ALLOW_HOST_FALLBACK=false`, hosted runs fail safely when Docker is unavailable instead of executing arbitrary repository commands on the Render host. Only enable host fallback for trusted demo repositories.

## Backend: Render

Create a Render Blueprint from `render.yaml`, or create a Web Service manually:

| Setting | Value |
|---|---|
| Runtime | Docker |
| Dockerfile path | `./Dockerfile` |
| Health check path | `/health` |
| Start command | Dockerfile default: `node dist/index.js` |
| Plan | Free or lowest suitable paid plan |

Render deploy flow:

```bash
git push origin main
```

Then in Render:

1. New Web Service or Blueprint.
2. Select this repository.
3. Use Docker runtime and `./Dockerfile`.
4. Add the environment variables below.
5. Deploy and open `https://<render-service>.onrender.com/health`.

### Backend Environment Variables

| Variable | Required | Notes |
|---|---:|---|
| `PORT` | Yes | Render supplies a port automatically. `3001` is fine for local/default examples. |
| `NODE_ENV` | Yes | Use `production`. |
| `FRONTEND_URL` | Yes | Deployed frontend origin, for example `https://atlasops.vercel.app`. Comma-separated origins are supported. |
| `NVIDIA_API_URL` | Yes | Defaults to NVIDIA chat completions endpoint. |
| `NVIDIA_API_KEY` | Yes for fixes | Keep secret in Render. Do not commit. |
| `GITHUB_TOKEN` | Optional | Required only for private repos or writeback. |
| `GITHUB_OWNER` | Optional | Used by GitHub integration. |
| `GITHUB_REPO` | Optional | Used by GitHub integration. |
| `ALLOW_HOST_FALLBACK` | Yes | Keep `false` for hosted deployments unless testing only trusted repos. |
| `ARTIFACTS_DIR` | Optional | Defaults to `artifacts`. |
| `RETRY_LIMIT` | Optional | Defaults to `5`. |
| `AGENT_TIMEOUT_MS` | Optional | Defaults to `30000`. |
| `WEBHOOK_URL` | Optional | Notification endpoint. |

## Frontend: Vercel

The frontend is a Next.js app in `frontend/`.

Vercel settings:

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output | Next.js default |

Set:

```text
NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com
```

After changing `NEXT_PUBLIC_API_URL`, redeploy the frontend because Next.js inlines public environment variables at build time.

## Frontend: Netlify Alternative

Use Netlify if preferred:

| Setting | Value |
|---|---|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `.next` |

Install Netlify's Next.js support if the UI prompts for it. Set the same `NEXT_PUBLIC_API_URL`.

## Docker-Preferred Alternatives

Fly.io and Koyeb can run the same backend Dockerfile.

Fly.io outline:

```bash
fly launch --dockerfile Dockerfile --name atlasops-backend
fly secrets set FRONTEND_URL=https://<frontend-host> NVIDIA_API_KEY=<secret> ALLOW_HOST_FALLBACK=false
fly deploy
```

Koyeb outline:

1. Create a Web Service from the Git repository.
2. Select Dockerfile deployment with `Dockerfile`.
3. Set `/health` as the health check path.
4. Add the same backend environment variables.

These platforms also generally should not be treated as safe Docker-in-Docker sandboxes. Leave `ALLOW_HOST_FALLBACK=false` unless all input repositories are trusted.

## Artifacts and Storage

AtlasOps writes run data under `ARTIFACTS_DIR`, defaulting to `artifacts/`:

```text
artifacts/
  results.json
  runs/<run-id>/
    result.json
    workspace/
    <run-id>.zip
```

Free hosted filesystems are usually ephemeral. Artifacts may disappear after redeploys, restarts, or instance replacement. For durable artifacts, add object storage later.

## Security Warning

AtlasOps can clone repositories, install dependencies, run tests, generate patches, and commit changes. Running untrusted repositories on shared/free hosting is risky. The safest hosted default is:

```text
ALLOW_HOST_FALLBACK=false
```

With that setting, hosted validation is intentionally limited when Docker is unavailable. Enable host fallback only for repositories you control and trust.

## Test a Deployment

1. Open `https://<backend-host>/health` and confirm `status` is `ok`.
2. Confirm `checks.dockerAvailable` in the health JSON. On Render it will usually be `false`.
3. Set `NEXT_PUBLIC_API_URL` on Vercel or Netlify to the backend URL and redeploy.
4. Open the frontend dashboard and run a small trusted demo repository.
5. If `ALLOW_HOST_FALLBACK=false` and Docker is unavailable, expect a safe setup failure instead of host execution.
6. Check artifact downloads immediately after a run. Do not rely on free hosting for long-term artifact retention.

