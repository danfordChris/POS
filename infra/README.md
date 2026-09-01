# infra

Local development backing services.

## Services

| Service | Port(s) | Purpose | UI |
|---|---|---|---|
| postgres | 5432 | primary database | — |
| redis | 6379 | job queue / cache | — |
| minio | 9000 (API), 9001 (console) | S3-compatible object storage | http://localhost:9001 |
| minio-setup | — | one-shot: creates the media bucket | — |
| mailpit | 1025 (SMTP), 8025 (web) | captures outbound email in dev | http://localhost:8025 |

Credentials and ports are driven by the repo-root `.env` (copy from `.env.example`).

## Commands

```bash
# start
docker compose -f infra/docker-compose.yml up -d

# status
docker compose -f infra/docker-compose.yml ps

# logs
docker compose -f infra/docker-compose.yml logs -f

# stop (keep data)
docker compose -f infra/docker-compose.yml down

# reset (drop all data)
docker compose -f infra/docker-compose.yml down -v
```

## Notes

- App containers (`api`, `web`) and their Dockerfiles are added in task T-0009.
- `minio-setup` exits 0 after creating `${S3_BUCKET}`; that is expected.
