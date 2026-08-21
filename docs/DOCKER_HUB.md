# Patchies

Patchies is a visual programming environment for building audio-visual patches in the browser. This image packages the SvelteKit frontend and PocketBase backend into one portable service.

- [Open Patchies](https://patchies.app)
- [Source code](https://github.com/heypoom/patchies)
- [Production guide](https://github.com/heypoom/patchies/blob/main/docs/PRODUCTION.md)

## Run locally

```bash
docker run --rm \
  -p 8090:8090 \
  -v patchies-data:/app/pb_data \
  phoomparin/patchies:latest
```

Open [http://localhost:8090](http://localhost:8090). The `patchies-data` volume preserves patches, PocketBase settings, and uploaded files between container runs.

## Production

Production deployments should:

- Mount persistent storage at `/app/pb_data`.
- Run one Patchies instance against each data directory.
- Set a random 32-character `PATCHIES_ENCRYPTION_KEY` through the platform's secret manager.
- Terminate HTTPS through the hosting platform or a reverse proxy.
- Use `GET /api/healthz` for health checks.
- Back up the persistent data and encryption key separately.

Generate an encryption key with:

```bash
openssl rand -hex 16
```

See the [production guide](https://github.com/heypoom/patchies/blob/main/docs/PRODUCTION.md) for encryption, backup, and restore details.

## Image tags and platforms

- `latest` tracks the latest build from the default branch.
- Version tags such as `v1.0.0` track Patchies releases.
- Images are published for `linux/amd64` and `linux/arm64`.
