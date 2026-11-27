# Deployment preparation

This repository is prepared for the existing React/Vite frontend on Vercel and the existing Express/Python backend on Render. The Atlas backup and restore are complete and verified. Application deployment and production cutover have not yet occurred. This guide records the database migration and the remaining deployment preparation; it does not perform a deployment.

## Confirmed project settings

| Component | Setting |
| --- | --- |
| Backend deployment root | Repository root (`.`), because the Dockerfile copies both `backend/` and `scraper/` |
| Backend runtime | Render Docker Web Service using the existing root `Dockerfile` |
| Backend start | The Dockerfile runs `bun run start`, which invokes the existing `backend/package.json` `start` script |
| Frontend deployment root | `frontend/` |
| Frontend build | `npm run build` |
| Frontend output | `dist/` |
| MongoDB database | `news-pulse` |
| Initial RSS scheduler | Disabled (`AUTO_RSS_POLLING=false`) |

## Render configuration

The root `render.yaml` declares the Docker service and uses the repository root as its Docker build context. The Dockerfile installs the backend Node dependencies and the Python scraper dependencies, and sets `PYTHON_BIN` and `SCRAPER_ENTRYPOINT` for the existing ingestion child process. Do not set a custom Render start command; use the Dockerfile `CMD`.

Render supplies `PORT`; `backend/server.ts` listens on that value and binds to `0.0.0.0`. `GET /` returns the existing JSON health response. Render's Free web service has an ephemeral filesystem and can spin down while idle, so local files must not be treated as persistent storage. The application data remains in MongoDB. [Render web service port requirements](https://render.com/docs/web-services), [Render Free plan limits](https://render.com/docs/free)

Set these service environment variables in Render:

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Atlas connection URI; enter as a secret in Render, never commit it |
| `MONGO_DB` | `news-pulse` |
| `CORS_ORIGIN` | The exact deployed Vercel origin, such as `https://<your-vercel-project>.vercel.app` (no trailing slash) |
| `AUTO_RSS_POLLING` | `false` initially |

The existing database connector and Python worker support `MONGODB_URI` and `MONGO_DB`. The Dockerfile supplies the Python executable and scraper entrypoint; no additional Python settings are needed for the standard image. Render sets `PORT` automatically. Do not add MongoDB credentials to `CORS_ORIGIN`, build arguments, or frontend variables.

Atlas must permit connections from the Render service. Render documents outbound IP ranges for each service/region; use the ranges shown for the deployed service in Atlas's IP access list where practical. [Render outbound IP addresses](https://render.com/docs/outbound-ip-addresses)

## Vercel configuration

Create the Vercel project from the existing GitHub repository and set **Root Directory** to `frontend`. The included `frontend/vercel.json` declares the Vite build and `dist` output and routes SPA deep links to `index.html`. [Vercel Vite deployment](https://vercel.com/docs/frameworks/frontend/vite)

Set this Vercel environment variable for Production (and Preview only if desired):

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | The public Render service origin, e.g. `https://<render-service>.onrender.com`, without a trailing slash |

This value is public frontend configuration, not a secret. Never put `MONGODB_URI` or other backend credentials in Vercel. The existing localhost fallback remains available during local development; production must define `VITE_API_BASE_URL` before building.

After the first Vercel deployment, copy its exact HTTPS origin into Render's `CORS_ORIGIN`. After saving the Render value, redeploy/restart the backend. If the Vercel project uses a custom domain, include that origin too as a comma-separated `CORS_ORIGIN` value.

## Atlas backup and restore — completed

The MongoDB migration from the local `news-pulse` database to the Atlas `news-pulse` database is complete. The backup and restore used MongoDB Database Tools **100.20.1**.

| Item | Verified record |
| --- | --- |
| Backup archive | `D:\MongoBackups\news-pulse-2026-11-24-153204-UTC.archive.gz` |
| Backup manifest | `D:\MongoBackups\news-pulse-2026-11-24-153204-UTC.manifest.json` |
| Restore result | Completed successfully |
| Collections | All 14 restored and verified |
| Documents | 16,961 total; collection counts matched the backup manifest |
| Indexes | Definitions matched the backup manifest |
| Local data and backup | Preserved unchanged |

The migration verification confirmed that the Atlas collection counts and index definitions match the backup manifest. The backup archive was verified before restoration. No credentials, passwords, or database connection URIs are stored in this document.

Previous preflight and restore instructions are historical and superseded by this completed status. **Do not repeat the restore or use the old empty-target preflight as an active migration step.** Keep the local database and verified backup available as recovery copies.

## Application deployment and production cutover — pending

The database is migrated, but the application has not yet been deployed and production traffic has not been cut over. Before deployment:

- Configure Render with `MONGODB_URI` as a private secret, `MONGO_DB=news-pulse`, the exact Vercel production origin in `CORS_ORIGIN`, and `AUTO_RSS_POLLING=false` for the initial deployment.
- Configure Vercel with `VITE_API_BASE_URL` set to the public Render service origin. Set the Vercel Root Directory to `frontend`.
- Ensure Atlas network access permits the Render service to connect.
- Validate the deployed backend and frontend before directing production use to them.

Do not put database credentials or connection URIs in this repository, frontend configuration, or logs. The Render Free service has an ephemeral filesystem; persistent application data belongs in MongoDB. The initial RSS scheduler remains disabled until explicitly enabled in Render configuration.

The local database remains preserved and has not been removed or rewritten by the migration. Any future application rollback or Atlas data operation should be planned and reviewed separately; this document does not authorize database changes.

## Validation commands

Run from the repository root:

```powershell
Push-Location backend
npm test
npx tsc --noEmit
Pop-Location

Push-Location frontend
npm run build
Pop-Location

git diff --check
```

The TypeScript project does not currently define a dedicated typecheck script; `npx tsc --noEmit` uses `backend/tsconfig.json`.
