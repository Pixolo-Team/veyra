# Deploying the API to Cloud Run

Covers `@veyra/api` only. The web client is a static bundle and needs no
environment variables — see the note on same-origin routing at the end.

Build inputs live at the repo root: [`Dockerfile`](../Dockerfile),
[`.dockerignore`](../.dockerignore), [`.gcloudignore`](../.gcloudignore). The
build context must be the repo root, because the API imports the
`@veyra/contracts` workspace and resolves dependencies from the root lockfile.

Deploys go through Cloud Build (`--source .`), so no local Docker daemon is
needed and the image is built natively for `linux/amd64`.

---

## 0. Decide the project

There is no `veyra` project on the account today, and the active gcloud config
points at `evento-502713`, which is unrelated. Create or pick one first —
everything below assumes `$PROJECT` and will otherwise deploy into whatever is
currently active.

```bash
export PROJECT=veyra-prod
export REGION=asia-south1
gcloud config set project "$PROJECT"
```

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com
```

## 1. Document storage

Cloud Run has no persistent disk — its filesystem is in-memory and dies with the
instance. A GCS bucket is mounted as a volume instead, so `STORAGE_DRIVER` stays
`local` and no application code changes.

This works because [`local-storage.service.ts`](../apps/api/src/storage/local-storage.service.ts)
only ever does whole-file `writeFile` / `readFile` / `rm` — no appends, renames,
or locking, which are the operations GCS FUSE handles poorly.

```bash
gcloud storage buckets create "gs://$PROJECT-documents" \
  --location="$REGION" \
  --uniform-bucket-level-access
```

```bash
gcloud iam service-accounts create veyra-api \
  --display-name="Veyra API (Cloud Run)"

gcloud storage buckets add-iam-policy-binding "gs://$PROJECT-documents" \
  --member="serviceAccount:veyra-api@$PROJECT.iam.gserviceaccount.com" \
  --role=roles/storage.objectAdmin
```

## 2. Secrets

Create these yourself — they carry live credentials.

```bash
gcloud secrets create DATABASE_URL   --replication-policy=automatic
gcloud secrets create DIRECT_URL     --replication-policy=automatic
gcloud secrets create SESSION_SECRET --replication-policy=automatic
```

Add a version to each (Supabase → Project Settings → Database for the first two;
`openssl rand -hex 48` for the third, which the env schema requires to be at
least 32 characters):

```bash
printf '%s' 'PASTE_VALUE_HERE' | gcloud secrets versions add DATABASE_URL --data-file=-
```

`DATABASE_URL` is the transaction pooler (port 6543, `?pgbouncer=true`);
`DIRECT_URL` is the session pooler (port 5432). Then grant read access:

```bash
for S in DATABASE_URL DIRECT_URL SESSION_SECRET; do
  gcloud secrets add-iam-policy-binding "$S" \
    --member="serviceAccount:veyra-api@$PROJECT.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
done
```

## 3. Migrations

Prisma migrations are not run by the container — a migration racing across
starting instances is how you corrupt a schema. Run them once from a machine
with `apps/api/.env` populated, before the first deploy and before any deploy
carrying a schema change:

```bash
npm run prisma:deploy --workspace @veyra/api
```

## 4. Deploy

```bash
gcloud run deploy veyra-api \
  --source . \
  --region "$REGION" \
  --service-account "veyra-api@$PROJECT.iam.gserviceaccount.com" \
  --add-volume=name=documents,type=cloud-storage,bucket="$PROJECT-documents" \
  --add-volume-mount=volume=documents,mount-path=/mnt/storage \
  --set-env-vars=STORAGE_DRIVER=local,STORAGE_LOCAL_ROOT=/mnt/storage,CORS_ORIGIN=https://YOUR_WEB_ORIGIN,WORKERS_ENABLED=true,MAILER_DRIVER=console,SESSION_COOKIE_NAME=veyra_session,SESSION_TTL_HOURS=12 \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest,SESSION_SECRET=SESSION_SECRET:latest \
  --min-instances=1 \
  --max-instances=1 \
  --no-cpu-throttling \
  --cpu=1 --memory=1Gi \
  --allow-unauthenticated
```

Do not set `PORT`. Cloud Run injects it (8080) and rejects it as an explicit env
var; [`env.ts`](../apps/api/src/config/env.ts) reads it through the validated
schema. `NODE_ENV=production` is baked into the image.

### Why the scaling flags are not optional

The background jobs are in-process `@Cron` / `@Interval` timers
([`apps/api/src/jobs/`](../apps/api/src/jobs/)) — the outbox worker runs every 20
seconds, plus hourly invite reminders, a 07:00 digest, and a 03:00 session
sweep. That design assumes a process that is always running, which Cloud Run's
defaults break in three separate ways:

- **`--min-instances=1`** — at zero instances no process exists, so no timer
  fires. Outbound email would simply stop until the next HTTP request.
- **`--no-cpu-throttling`** — by default Cloud Run allocates CPU only while a
  request is in flight, so timers do not fire between requests even with a warm
  instance.
- **`--max-instances=1`** — every instance runs the full schedule, so scaling to
  two means every digest and reminder is sent twice. `WORKERS_ENABLED=false`
  exists for exactly this, but there is currently no way to elect a single
  worker among many.

The consequence is that this service cannot horizontally scale as configured.
That is fine for the pilot, and `--min-instances=1` means paying for one
always-on instance. Lifting the ceiling later means moving the schedule to Cloud
Scheduler hitting authenticated endpoints, and running the web tier with
`WORKERS_ENABLED=false`.

## 5. Wire up the web client

The client calls same-origin `/api/*` with an httpOnly cookie and has no
configurable API base ([`client.ts:40`](../apps/web/src/lib/api/client.ts:40)).
So the static host must reverse-proxy `/api/*` to the Cloud Run URL on the same
origin, with SPA fallback to `index.html` for the router.

Set `CORS_ORIGIN` to that web origin. If the two ever end up on different
origins, the cookie needs `SameSite=None; Secure` and the client needs a real
API base URL — a code change, not configuration.

## Known gaps

- The runtime image ships build-only dependencies; `node_modules` is copied
  wholesale from the build stage to avoid recompiling `argon2`. Pruning is a
  size optimization, not a correctness one.
- The container runs as root, because Cloud Run's GCS FUSE mount is not reliably
  writable by an unprivileged uid. Revisit if storage moves to the S3 driver.
- `MAILER_DRIVER=console` only logs email. Resend is stubbed in
  `mailer.service.ts` and needs finishing before real invitations go out.
- `npm ci` reports 3 high-severity advisories; worth an `npm audit` pass before
  this handles real deal data.
