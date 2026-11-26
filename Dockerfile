FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc AS base # bookworm-slim

RUN apt-get update && \
    apt-get install --no-install-recommends -y \
      bash \
      ca-certificates \
      gettext \
      curl \
      jq \
      postgresql-client \
    && rm -rf /var/lib/apt/lists/*

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc AS build # bookworm-slim

COPY --from=base /usr/bin/bash /usr/bin/bash
COPY --from=base /usr/bin/curl /usr/bin/curl
COPY --from=base /usr/bin/jq /usr/bin/jq
COPY --from=base /usr/bin/gettext /usr/bin/gettext
COPY --from=base /usr/bin/psql /usr/bin/psql
COPY --from=base /usr/bin/openssl /usr/bin/openssl
COPY --from=base /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

WORKDIR /app

COPY bin/start.sh .
COPY config.yaml .
COPY metadata ./metadata
COPY migrations ./migrations
COPY seeds ./seeds
COPY hasura-cli bin/hasura-cli

RUN chmod +x start.sh

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc AS runtime # bookworm-slim

RUN apt-get update && \
    apt-get install --no-install-recommends -y \
      bash \
      ca-certificates \
      gettext \
      curl \
      jq \
      postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r hasura && \
    useradd -r -g hasura -d /app -s /usr/sbin/nologin hasura && \
    mkdir -p /app && \
    chown -R hasura:hasura /app

WORKDIR /app

COPY --from=build --chown=hasura:hasura start.sh .
COPY --from=build --chown=hasura:hasura config.yaml .
COPY --from=build --chown=hasura:hasura metadata ./metadata
COPY --from=build --chown=hasura:hasura migrations ./migrations
COPY --from=build --chown=hasura:hasura seeds ./seeds
COPY --from=build --chown=hasura:hasura bin/hasura-cli bin/hasura-cli

USER hasura

EXPOSE 8080

ENTRYPOINT ["./start.sh"]
