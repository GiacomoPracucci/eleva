# Docker Deployment Guide

This document explains how Docker is used inside the repository and how a new contributor can launch the entire stack on a fresh machine.

## Overview

The project is split into three containers orchestrated with Docker Compose:

- **db** – PostgreSQL 16 with the [`pgvector`](https://github.com/pgvector/pgvector) extension for semantic search support (`ankane/pgvector:latest`). Data is persisted in the named volume `eleva-db-data`.
- **backend** – Python 3.12 + FastAPI application packaged with Poetry. The container waits until PostgreSQL is reachable, applies Alembic migrations, and then starts Uvicorn.
- **frontend** – React/Vite single-page application built with Node 20 and served through Nginx. Nginx also proxies `/api/` requests to the backend so the browser never hits cross-origin issues.

All configuration lives in `docker-compose.yml` at the repository root. Building happens from the repository root as well, so the backend and frontend Dockerfiles pull code relative to `.`.

## Prerequisites

1. Docker Engine or Docker Desktop (version 25 or newer recommended).
2. Docker Compose v2 (bundled with current Docker Desktop releases).
3. No local copies of Postgres/Node/Python are required—the containers ship everything needed.

Verify the setup once installed:

```bash
docker --version
docker compose version
```

## Environment configuration

### Backend

1. Copy the sample file and adjust the secrets:
   ```bash
   cp backend/.env.docker.example backend/.env.docker
   ```
2. Mandatory values:
   - `SECRET_KEY` – generate a long random string.
   - `DATABASE_URL` – leave as provided unless you change Postgres credentials in `docker-compose.yml`.
3. Optional integrations (not required for a local Docker run):
   - **OpenAI** – `OPENAI_API_KEY`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`. Needed only if you want embeddings/AI helpers.
   - **AWS S3** – `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME`, `AWS_REGION`. Used for profile picture storage; skip to default to local-only behaviour.
   - **Email (SMTP)** – `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`. Only needed if password-reset emails must work.

Any variable left blank simply disables the corresponding feature.

### Frontend

The Docker build reads Vite variables during the image build. Either rely on defaults (`/api/v1`, `Eleva`, etc.) or create an override file:

```bash
cp frontend/.env.docker.example frontend/.env.docker
```

When present, Docker Compose forwards those values as build arguments so the SPA bundle points at the correct API host.

### Compose-level overrides

An optional `.env` file at the repository root can override values referenced in `docker-compose.yml` (e.g., `POSTGRES_USER`, `POSTGRES_PASSWORD`, `VITE_API_URL`). This is useful if you run multiple instances on one machine or need custom ports.

## Building and running locally

From the repository root:

```bash
docker compose build          # Build backend + frontend images
docker compose up -d          # Start database, backend, frontend
```

The first startup pulls the base images, installs dependencies, and runs Alembic migrations. Subsequent restarts reuse cached layers and the persistent `eleva-db-data` volume.

### Service endpoints

- Frontend (SPA): <http://localhost:8080>
- Backend API docs (Swagger UI): <http://localhost:8000/docs>
- PostgreSQL database: `localhost:5432` (user/pass default to `eleva`)

## Common tasks

- **Check logs** – `docker compose logs -f backend` (replace `backend` with any service).
- **Run initial super-admin script** –
  ```bash
  docker compose exec backend python create_super_admin.py
  ```
- **Stop services but keep data** – `docker compose down`
- **Reset everything (including database data)** – `docker compose down -v`

## How the containers work

### Backend entrypoint

`backend/docker/entrypoint.sh` is the container entry script. It:

1. Waits for the database to accept connections (using `asyncpg`).
2. Applies database migrations via `alembic upgrade head` unless `RUN_MIGRATIONS=false` is provided.
3. Starts Uvicorn with `app.main:app` on port 8000.

You can override the final command by passing your own `CMD` to the container or by running e.g. `docker compose run backend bash` for debugging.

### Frontend build & runtime

- `frontend/Dockerfile` builds the production bundle using Node 20 (`npm ci` → `npm run build`).
- A second stage copies the compiled `dist/` into an Nginx image and applies `frontend/docker/nginx.conf` which proxies API traffic to `backend:8000` under the same origin.

If you need to point to a remote API, adjust `VITE_API_URL` at build time or use a `.env.docker` file.

### Database persistence

`eleva-db-data` is a named volume defined in `docker-compose.yml`. Removing it (`docker compose down -v`) will wipe all Postgres data. The volume path on your host depends on the Docker runtime in use.

## Deploying on a new machine

1. Install Docker + Compose.
2. Clone the repository:
   ```bash
   git clone https://github.com/<your-org>/eleva.git
   cd eleva
   ```
3. Copy the environment templates (backend required, frontend optional) and supply the minimal secrets.
4. Run `docker compose build` followed by `docker compose up -d`.
5. Create a super admin user via `docker compose exec backend python create_super_admin.py`.
6. Navigate to <http://localhost:8080> and sign in using the admin credentials.

At this point the entire stack is running locally. No extra tooling is needed beyond Docker.

## Security notes

- Never commit real secrets to version control. The `.env.docker.example` files exist so you can keep the true `.env` files out of git.
- Rotate any credentials that were previously stored in plain text (e.g., keys already present in `backend/.env`) before you share a Docker image.
- For production deployments add TLS termination (e.g., Traefik, Caddy, or managed load balancers) and configure backups for the Postgres volume.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Backend container exits immediately | Missing/invalid `DATABASE_URL` or Postgres not ready | Check `backend/.env.docker`; ensure database service is healthy (`docker compose ps`). |
| Frontend cannot reach API | `VITE_API_URL` built with wrong value | Rebuild frontend with correct `VITE_API_URL` or adjust Nginx proxy target. |
| Migration failures | Schema drift or incompatible DB credentials | Inspect `docker compose logs backend`; rerun with clean volume if necessary. |

If you get stuck, inspect container status with `docker compose ps` and open an interactive shell (`docker compose exec backend bash`) to debug from inside the container.

---

With this setup any teammate can spin up the full environment—including database and AI-ready backend—without installing project dependencies locally. Customize the `.env` values as needed and rebuild to target new environments.
