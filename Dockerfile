# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Veyra API (@veyra/api) — NestJS + Prisma, built for Cloud Run.
#
# The build context is the REPO ROOT, not apps/api: the API imports the
# @veyra/contracts workspace and resolves its dependency tree from the root
# package-lock.json, so neither is reachable from a narrower context.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-slim AS base
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false
WORKDIR /app

# ── build ───────────────────────────────────────────────────────────────────
FROM base AS build

# argon2 falls back to compiling from source whenever no prebuilt binary
# matches the platform; openssl is Prisma's engine dependency.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Every workspace's manifest is copied even though only two are installed:
# npm resolves the workspace graph from the root `workspaces` globs, and a
# missing manifest makes `npm ci` reject the lockfile as out of sync.
# The nested apps/api/node_modules is created explicitly above for the same
# reason in reverse: npm hoists to the root, so the directory may not exist,
# and a COPY of a missing path fails the build.
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/design-system/package.json packages/design-system/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/playground/package.json apps/playground/

# --workspace keeps vite/antd/storybook out of the image entirely.
RUN npm ci --include-workspace-root \
      --workspace @veyra/contracts \
      --workspace @veyra/api

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api

# contracts emits the CommonJS dist that the API imports at runtime.
RUN npm run build --workspace @veyra/contracts \
 && npm run prisma:generate --workspace @veyra/api \
 && npm run build --workspace @veyra/api \
 && mkdir -p /app/apps/api/node_modules

# ── runtime ─────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# node_modules is carried over rather than reinstalled with --omit=dev: argon2
# is a native module, and copying the already-compiled tree avoids needing a
# toolchain in this stage. It leaves the build-only deps in the image — worth
# pruning later, but not at the cost of a second native compile.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

# Left as root deliberately: Cloud Run's GCS FUSE volume mount is not reliably
# writable by an unprivileged uid, and every upload is written through it.
# Worth revisiting if storage moves to the S3 driver, where no mount is involved.
WORKDIR /app/apps/api

# Cloud Run injects PORT (8080) and the app reads it through the validated env
# schema, so nothing is hardcoded here. EXPOSE is documentation only.
EXPOSE 8080
CMD ["node", "dist/main.js"]
