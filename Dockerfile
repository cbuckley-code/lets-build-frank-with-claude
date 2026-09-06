# Frank and his console in one image (ADR-006).
#
# Build context is the repository root, not server/ — a server/-scoped build
# cannot reach ui/, which is why ADR-006 moves this file up here. The pipeline
# builds it with `az acr build --file Dockerfile .`; `az containerapp up
# --source` is deliberately not used (it crashes on some azure-cli builds —
# see the note in .github/workflows/deploy.yml).
#
#   ui/dist  ->  /app/public   served at /
#   server/  ->  /app/dist     MCP at POST /mcp, health at GET /healthz

# ---- build the console ----------------------------------------------------
FROM node:22-slim AS ui-build
WORKDIR /build/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
# Tests run here, not only in Actions. On main this image build is the single
# build AND the test gate — a red suite fails the build and nothing deploys.
RUN npm test && npm run build

# ---- build Frank ----------------------------------------------------------
FROM node:22-slim AS server-build
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm test && npm run build

# ---- runtime --------------------------------------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Frank's production dependencies only: the console is static files by now and
# needs nothing at runtime.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node --from=server-build /build/server/dist ./dist
# config.ts resolves the console as `<package root>/public`, which is this.
COPY --chown=node:node --from=ui-build /build/ui/dist ./public

# ADR-004 gives Frank a managed identity, not root.
USER node

# Must match deploy.yml's --target-port and config.ts's PORT default.
ENV PORT=3000
EXPOSE 3000

# NOTE: Azure Container Apps does NOT use this HEALTHCHECK as its platform
# liveness probe — without an explicit ACA probe you get default TCP probing on
# the ingress port. This is for local `docker run` and as executable
# documentation of what "healthy" means.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
