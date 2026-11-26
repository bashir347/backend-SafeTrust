FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc # bookworm-slim

# Install only what the Hasura CLI entrypoint needs. No socat: start.sh documents
# that the socat workaround is for Hasura v1.x and is not needed on v2.47.0.
# Use --no-install-recommends and clean the apt cache to keep the image small.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates jq \
    && rm -rf /var/lib/apt/lists/*

# Install Hasura CLI directly from GitHub releases
RUN curl -L "https://github.com/hasura/graphql-engine/releases/latest/download/cli-hasura-linux-amd64" -o /usr/local/bin/hasura \
    && chmod +x /usr/local/bin/hasura

# Install pinned yq (replaces runtime download in migrate-test)
RUN ARCH=$(case "$(uname -m)" in aarch64|arm64) echo arm64;; *) echo amd64;; esac) \
    && curl -L "https://github.com/mikefarah/yq/releases/download/v4.44.1/yq_linux_${ARCH}" -o /usr/local/bin/yq \
    && chmod +x /usr/local/bin/yq

# Run as a non-root user so a compromised CLI process does not have full container
# privileges. The bind mount (-v .:/app) still requires the host UID to match; if the
# local checkout is owned by another UID, run with --user "$(id -u):$(id -g)" instead.
RUN groupadd --system --gid 1000 hasura \
    && useradd --system --uid 1000 --gid hasura --shell /usr/sbin/nologin --home-dir /app hasura

WORKDIR /app

# Copy only the files the CLI container actually uses. With the repo-root build
# context this keeps .env*, key files, docs/, .github/ and test artifacts out of the
# image. The hasura-cli-test service mounts the repo over /app at runtime, so the
# image itself only needs the entrypoint and enough of the repo skeleton to be useful
# when run without a mount (e.g. in CI).
COPY start.sh ./
COPY metadata ./metadata/
COPY migrations ./migrations/
COPY seeds ./seeds/
COPY bin ./bin/
COPY config.yaml ./
COPY webhook/package*.json ./webhook/

# The CLI container runs as non-root; make the entrypoint executable for that user.
RUN chmod +x ./start.sh

USER hasura

CMD ["./start.sh"]
