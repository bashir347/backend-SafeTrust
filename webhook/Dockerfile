FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS builder # 24-bookworm-slim

RUN apt-get update && \
    apt-get install --no-install-recommends -y \
      ca-certificates \
      curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
    && apt-get clean

WORKDIR /app

COPY webhook/package.json webhook/package-lock.json ./
RUN npm ci --omit=dev

COPY webhook/tsconfig.json ./
COPY webhook/src ./src
COPY webhook/tests ./tests
COPY webhook/public ./public

RUN npm run build

FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS runtime # 24-bookworm-slim

RUN apt-get update && \
    apt-get install --no-install-recommends -y \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
    && apt-get clean

RUN groupadd -r nodeuser && \
    useradd -r -g nodeuser -d /app -s /usr/sbin/nologin nodeuser && \
    mkdir -p /app && \
    chown -R nodeuser:nodeuser /app

WORKDIR /app

COPY --from=builder --chown=nodeuser:nodeuser node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodeuser dist ./dist
COPY --from=builder --chown=nodeuser:nodeuser package.json ./

USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || '3000') + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["node", "dist/index.js"]
