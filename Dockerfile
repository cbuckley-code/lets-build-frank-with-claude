# Frank and his console in one image (ADR-009).
#
# Build context is the repository root, not server/ — `az containerapp up
# --source ./server` cannot reach ui/, which is why ADR-009 moves this file up
# here and deploys with `--source .`.
#
#   ui/dist  ->  /app/public   served at /
#   server/  ->  /app/dist     MCP at POST /mcp, health at GET /healthz

# ---- build the console ----------------------------------------------------
FROM node:22-slim AS ui-build
WORKDIR /build/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# ---- build Frank ----------------------------------------------------------
FROM node:22-slim AS server-build
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Frank's production dependencies only: the console is static files by now and
# needs nothing at runtime.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=server-build /build/server/dist ./dist
# config.ts resolves the console as `<package root>/public`, which is this.
COPY --from=ui-build /build/ui/dist ./public

# ADR-004 gives Frank a managed identity, not root.
USER node

# Must match deploy.yml's --target-port and config.ts's PORT default.
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
