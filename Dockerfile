# syntax=docker/dockerfile:1

# --- Build stage -----------------------------------------------------------
# Compile the TypeScript CLI to a single ESM bundle in dist/.
FROM node:20-slim AS builder
WORKDIR /app

# Install all dependencies (including dev) for the build.
COPY package.json package-lock.json ./
RUN npm ci

# Build the bundle. The committed drizzle/ migrations ship as-is.
COPY tsconfig.json tsup.config.ts drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build

# --- Runtime stage ---------------------------------------------------------
# A slim image with only production dependencies and the built bundle.
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Optionally install the Chromium binary for the scraping pillar:
#   docker build --build-arg INSTALL_CHROMIUM=1 .
ARG INSTALL_CHROMIUM=0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && if [ "$INSTALL_CHROMIUM" = "1" ]; then npx playwright install --with-deps chromium; fi \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# PGlite stores its files here when no DATABASE_URL is provided; mount a volume
# to persist them. Ignored when DATABASE_URL points at a Postgres server.
ENV LOSTFAST_DATA_DIR=/data/pgdata
VOLUME ["/data"]

ENTRYPOINT ["node", "dist/index.js"]
