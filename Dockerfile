# syntax=docker/dockerfile:1

FROM node:22-bookworm AS web-build
WORKDIR /app
RUN npm install --global pnpm@11
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm prepare && pnpm build:web:prod

FROM golang:1.25-bookworm AS server-build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY --from=web-build /app/cmd ./cmd
COPY internal ./internal
COPY scripts ./scripts
COPY --from=web-build /app/web ./web
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/jj-view ./cmd/jj-view

FROM debian:bookworm-slim AS runtime
ARG TARGETARCH
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git openssh-client \
    && rm -rf /var/lib/apt/lists/*
# Pin jj and verify the official Linux release for each architecture.
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) arch=x86_64; checksum=d4b657f622ee50929c8916466dfa3d6a6c17a0a32b50e7b2c793707ec9ebcad7 ;; \
      arm64) arch=aarch64; checksum=0f300e1576de8dabe0a9dedf0b87ae44f8accea5cf54d9a342a51061c1fb1bcd ;; \
      *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/jj-vcs/jj/releases/download/v0.47.1/jj-v0.47.1-${arch}-unknown-linux-musl.tar.gz" -o /tmp/jj.tar.gz; \
    echo "$checksum  /tmp/jj.tar.gz" | sha256sum -c -; \
    mkdir /tmp/jj; \
    tar -xzf /tmp/jj.tar.gz -C /tmp/jj; \
    install /tmp/jj/jj /usr/local/bin/jj; \
    rm -rf /tmp/jj /tmp/jj.tar.gz; \
    jj --version
COPY --from=server-build /out/jj-view /usr/local/bin/jj-view
ENV HOME=/home/jj-view
RUN mkdir -p /home/jj-view/.config/jj-view /repo \
    && chown -R 1000:1000 /home/jj-view /repo
USER 1000:1000
WORKDIR /repo
EXPOSE 8080
ENTRYPOINT ["jj-view"]
CMD ["--host=0.0.0.0", "--no-open", "--user-data-dir=/home/jj-view/.config/jj-view"]
