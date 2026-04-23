# Docker Release Pipeline Design

**Context**

Production currently runs through 1Panel by copying repository source to the server and building images locally with `docker compose up -d --build`. That makes the deployed artifact depend on whatever code is present on the server instead of a single published image source, which is how stale code can keep running even after GitHub has newer commits.

**Goals**

- Publish two Docker Hub images from GitHub: one for `web`, one for `admin`.
- Push `latest` and `sha-<short>` tags from `main`.
- Push version tags like `v1.2.3` when the repository tag is pushed.
- Stop building application source on the server for 1Panel production deploys.
- Keep production updates manual: `docker compose pull && docker compose up -d`.

**Chosen Approach**

Keep the existing multi-stage [`Dockerfile`](/Users/caomei/Downloads/vision/Dockerfile) and use GitHub Actions to build each target separately. The workflow validates the repo with the existing build commands, logs in to Docker Hub with repository secrets, then publishes `vision-web` and `vision-admin` images with predictable tags.

Production deployment switches from `build:` to `image:` in [`deploy/1panel/docker-compose.yml`](/Users/caomei/Downloads/vision/deploy/1panel/docker-compose.yml). The exact image refs are stored in a deployment `.env`, which keeps rollback simple because operations can pin `latest`, `sha-xxxxxxx`, or a semantic version tag without editing the compose file itself.

**Files Expected**

- `.github/workflows/docker-release.yml`
- `deploy/1panel/docker-compose.yml`
- `deploy/1panel/.env.example`
- `deploy/1panel/README.md`
- `docs/plans/2026-04-24-docker-release.md`
