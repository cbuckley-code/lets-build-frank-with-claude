# Frank's container image (ADR-001, ADR-004).
# `az containerapp up --source ./server` builds this; ingress targets port 3000.

# ---- build ----------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app

# Install with the lockfile only, so this layer caches on dependency changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# ADR-004 gives Frank a managed identity, not root. Run as the unprivileged
# user that the node image already provides.
USER node

# Must match deploy.yml's --target-port and config.ts's PORT default.
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
