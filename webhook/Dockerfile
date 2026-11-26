# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS builder # 24-bookworm-slim

# Rust toolchain for the Neon addons (webhook-verifier, zk-verifier,
# stellar-utils, chunk-processor, pg-bulk-upsert, x402-processor, soroban-reconciler,
# escrow-state-machine), plus a glibc runtime for the pinned Barretenberg binary.
#
# Install with --no-install-recommends and clean the apt cache so the builder layer
# does not keep recommended packages or the package index.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

# Build context is the repo root, so source paths are repo-root relative.
WORKDIR /app

# 1. Node dependencies first (cached until package.json changes).
COPY webhook/package*.json ./webhook/
RUN cd webhook && npm ci

# 2. Rust workspace: root manifest + lockfile + all member crates at /app so
#    `cargo build --workspace --manifest-path ../crates/Cargo.toml` resolves from webhook.
COPY crates/ ./crates/
COPY tsconfig.crates.json ./
COPY Cargo.lock ./
COPY Cargo.toml ./

# 3. TypeScript sources + config.
COPY webhook/tsconfig.json ./webhook/
COPY webhook/src/ ./webhook/src/

# 4. Build the Neon addons (cargo --workspace → each crate's copy-native.js) and
#    compile TypeScript. See webhook/package.json "build" script.
RUN cd webhook && npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS production # 24-bookworm-slim

WORKDIR /app/webhook

# No need for curl in the runtime image: the health check uses the Node runtime that
# is already present, and the webhook never calls out with curl. Keep the image small
# and reduce the attacker surface by installing only ca-certificates.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY webhook/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/webhook/dist ./dist
COPY --from=builder /app/crates/webhook-verifier/index.node /app/crates/webhook-verifier/index.node
COPY --from=builder /app/crates/webhook-verifier/index.js /app/crates/webhook-verifier/index.js
COPY --from=builder /app/crates/webhook-verifier/fallback.js /app/crates/webhook-verifier/fallback.js
COPY --from=builder /app/crates/webhook-verifier/package.json /app/crates/webhook-verifier/package.json
COPY --from=builder /app/crates/zk-verifier/index.node /app/crates/zk-verifier/index.node
COPY --from=builder /app/crates/zk-verifier/package.json /app/crates/zk-verifier/package.json
COPY --from=builder /app/crates/zk-verifier/index.d.ts /app/crates/zk-verifier/index.d.ts
COPY --from=builder /app/crates/zk-verifier/bb /app/crates/zk-verifier/bb
RUN chmod 0755 /app/crates/zk-verifier/bb
# Runtime pieces of the stellar-utils addon (package.json → main: native/index.node).
# Placed at /app/crates/… so `require('../../../../crates/stellar-utils')` from
# dist/routes/auth resolves correctly.
COPY --from=builder /app/crates/stellar-utils/package.json /app/crates/stellar-utils/package.json
COPY --from=builder /app/crates/stellar-utils/native /app/crates/stellar-utils/native
# chunk-processor: parallel escrow-chunk fetcher (built by build:rust --workspace).
COPY --from=builder /app/crates/chunk-processor/index.node /app/crates/chunk-processor/index.node
COPY --from=builder /app/crates/chunk-processor/package.json /app/crates/chunk-processor/package.json
# pg-bulk-upsert: single-statement escrow UPSERT (built by build:rust --workspace).
COPY --from=builder /app/crates/pg-bulk-upsert/index.node /app/crates/pg-bulk-upsert/index.node
COPY --from=builder /app/crates/pg-bulk-upsert/package.json /app/crates/pg-bulk-upsert/package.json
# soroban-reconciler: reconcile escrow state.
COPY --from=builder /app/crates/soroban-reconciler/package.json /app/crates/soroban-reconciler/package.json
COPY --from=builder /app/crates/soroban-reconciler/native /app/crates/soroban-reconciler/native
# x402-processor: x402 payment protocol verifier (built by build:rust --workspace).
COPY --from=builder /app/crates/x402-processor/index.node /app/crates/x402-processor/index.node
COPY --from=builder /app/crates/x402-processor/package.json /app/crates/x402-processor/package.json
# escrow-state-machine: compile-time SafeTrust escrow lifecycle (built by build:rust --workspace).
COPY --from=builder /app/crates/escrow-state-machine/index.node /app/crates/escrow-state-machine/index.node
COPY --from=builder /app/crates/escrow-state-machine/package.json /app/crates/escrow-state-machine/package.json
COPY --from=builder /app/crates/escrow-state-machine/index.d.ts /app/crates/escrow-state-machine/index.d.ts

# Use the non-root node user shipped in the official Node image.
USER node

# Match the service port used in Compose (3000 by default), not 3001.
EXPOSE 3000

# The health check uses the Node runtime, not curl, and reads the service port from
# the PORT env so the image's own health check is correct outside Compose too.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
