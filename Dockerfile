# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

# --- dependencies (cached until package*.json changes) ---------------------------------------
FROM base AS deps
# Some networks drop connections under parallel fetches; fail slow rather than flake.
ENV npm_config_maxsockets=3 \
    npm_config_fetch_retries=8 \
    npm_config_fetch_retry_maxtimeout=180000 \
    npm_config_fetch_timeout=900000 \
    npm_config_audit=false \
    npm_config_fund=false
COPY package.json package-lock.json* ./
RUN npm ci

# --- development image (see docker-compose.yml for the usual bind-mounted setup) -------------
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- build. Needs no database: pages render per request, not at build time. -------------------
FROM base AS builder
ENV NEXT_OUTPUT=standalone \
    NODE_OPTIONS=--max-old-space-size=1400
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runtime: small, non-root, self-contained standalone server -------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
