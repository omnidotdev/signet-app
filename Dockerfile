# syntax=docker/dockerfile:1

FROM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
# Skip puppeteer's chrome-headless-shell download (pulled in by @unlighthouse/cli devDep)
# The base image lacks tar/unzip; we don't run puppeteer in this image anyway
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
# Bust the COPY cache per commit. The Fractal operator always builds
# --cache-from <name>:buildcache and injects GIT_SHA; importing that registry
# cache can false-hit "COPY . ." so a new commit reuses a stale source layer and
# ships old code. Consuming GIT_SHA before the copy forces a re-copy every commit
ARG GIT_SHA=unknown
RUN echo "source-cache-bust ${GIT_SHA}"
COPY . .
RUN bun run build

# TODO: Switch back to Bun runtime once module resolution is fixed
# Bun doesn't properly resolve externalized Nitro packages (srvx, react-dom/server)
# Error: Cannot find package 'srvx' from '/app/.output/server/chunks/virtual/entry.mjs'
# Error: Cannot find module 'react-dom/server'
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS runner
WORKDIR /app
ENV NODE_ENV=production
# Bake the built commit so the running commit is observable and a stale build is
# detectable (compare BUILD_SHA against the expected commit)
ARG GIT_SHA=unknown
ENV BUILD_SHA=${GIT_SHA}

# Nitro bundles production deps into .output/server/node_modules.
COPY --from=builder /app/.output ./.output

EXPOSE 3000
# Raise the max request-header size so large many-workspace auth cookies do not trip HTTP 431
CMD ["node", "--max-http-header-size=65536", ".output/server/index.mjs"]
