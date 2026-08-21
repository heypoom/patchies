# Production

Patchies packages its frontend and PocketBase backend in one process. A production deployment must persist its data directory, protect PocketBase settings, and keep the service behind HTTPS.

## Persistent data

Patchies stores its PocketBase databases and uploaded files in one data directory. Do not rely on a container's writable filesystem for this directory.

- Docker deployments should mount persistent storage at `/app/pb_data`.
- Native deployments should set `PATCHIES_DATA_DIR` to a persistent directory.
- Run only one Patchies process against a data directory.

## Settings encryption

Production deployments should always set `PATCHIES_ENCRYPTION_KEY`. Without it, PocketBase stores application settings unencrypted. Generate a random 32-character key once for each production instance:

```bash
openssl rand -hex 16
```

Save the generated value as `PATCHIES_ENCRYPTION_KEY` in the deployment platform's secret manager, and keep a separate copy in a password manager. Do not commit it to the repository. Patchies does not include the key in its data directory or database backups.

For Docker, put the variable in a protected environment file and pass that file when starting the container:

```text
PATCHIES_ENCRYPTION_KEY=<generated-key>
```

```bash
chmod 600 /absolute/path/to/patchies.env
docker run --env-file /absolute/path/to/patchies.env \
  -p 8090:8090 \
  -v patchies-data:/app/pb_data \
  phoomparin/patchies:latest
```

For a native deployment, provide the variable through the process manager or hosting platform before starting Patchies.

When restoring a database with encrypted settings, configure the key used by the source Patchies instance. Retrieve it from the source deployment's secret manager; it cannot be derived from `data.db`. The key protects PocketBase settings, not collection records or uploaded files.

## Backups

Back up both the persistent data directory and `PATCHIES_ENCRYPTION_KEY`, but store them separately. Use the hosting platform's volume snapshots or a SQLite-aware backup process. Stop Patchies before directly copying or replacing database files so the backup includes a consistent database state and its SQLite sidecars.

Test the restore procedure before relying on a backup. Restoring an encrypted database also requires the source instance's encryption key.

## Health checks and HTTPS

Patchies listens on port `8090` by default. Configure the hosting platform or reverse proxy to terminate HTTPS and forward requests to this port.

Use `GET /api/healthz` for deployment health checks. A healthy instance returns HTTP 200 with:

```json
{"status":"ok"}
```
