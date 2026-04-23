# Docker Release Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish `web` and `admin` Docker images from GitHub to Docker Hub and switch 1Panel production deployments to pull those images instead of building local source code.

**Architecture:** Reuse the existing multi-target `Dockerfile` and add one GitHub Actions workflow that validates the repo, builds each target, and pushes tags derived from the triggering ref. Production deployment keeps the current `docker compose` shape, but swaps `build:` for image refs loaded from a `.env` file so updates and rollbacks are just tag changes plus `pull`/`up -d`.

**Tech Stack:** GitHub Actions, Docker Buildx, Docker Hub, Docker Compose, 1Panel

---

### Task 1: GitHub Docker Release Workflow

**Files:**
- Create: `.github/workflows/docker-release.yml`

**Step 1: Create the workflow**

Add a workflow that:
- triggers on pushes to `main`
- triggers on tags matching `v*`
- runs `npm ci`, `npm run build:web`, and `npm run build:admin`
- logs in to Docker Hub with `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`
- pushes `vision-web` and `vision-admin` with `latest`, `sha-<short>`, and `v*` tags as appropriate

**Step 2: Validate workflow YAML**

Run: `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/docker-release.yml'); puts 'ok'"`
Expected: `ok`

### Task 2: Production Compose Conversion

**Files:**
- Create: `deploy/1panel/.env.example`
- Modify: `deploy/1panel/docker-compose.yml`

**Step 1: Replace local builds with published images**

Change the 1Panel compose file so:
- `web` reads `VISION_WEB_IMAGE` from `.env`
- `admin` reads `VISION_ADMIN_IMAGE` from `.env`
- existing `env_file`, `ports`, `restart`, and `networks` stay intact

**Step 2: Validate compose rendering**

Run: `docker compose -f deploy/1panel/docker-compose.yml --env-file deploy/1panel/.env.example config`
Expected: rendered `web` and `admin` services with concrete `image:` values and no `build:` blocks

### Task 3: Deployment Documentation

**Files:**
- Modify: `deploy/1panel/README.md`

**Step 1: Document Docker Hub prerequisites**

Add:
- required GitHub secrets
- required Docker Hub repositories
- expected tag behavior for `main` and `v*`

**Step 2: Document server deployment and rollback**

Add:
- how to copy `docker-compose.yml`, `.env.example`, `web.env`, and `admin.env`
- how to configure the two image refs
- how to update with `docker compose pull && docker compose up -d`
- how to roll back by pinning a previous `sha-*` or `v*` image tag

### Task 4: Verification

**Files:**
- Verify only

**Step 1: Validate the workflow file**

Run: `ruby -e "require 'yaml'; YAML.load_file('.github/workflows/docker-release.yml'); puts 'ok'"`
Expected: `ok`

**Step 2: Validate the 1Panel compose file**

Run: `docker compose -f deploy/1panel/docker-compose.yml --env-file deploy/1panel/.env.example config`
Expected: compose output with `VISION_WEB_IMAGE` and `VISION_ADMIN_IMAGE` resolved

**Step 3: Validate repo formatting**

Run: `git diff --check`
Expected: no whitespace or patch formatting errors

**Step 4: Commit**

```bash
git add .github/workflows/docker-release.yml \
  deploy/1panel/.env.example \
  deploy/1panel/docker-compose.yml \
  deploy/1panel/README.md \
  docs/plans/2026-04-24-docker-release-design.md \
  docs/plans/2026-04-24-docker-release.md
git commit -m "feat: add docker hub release pipeline"
```
