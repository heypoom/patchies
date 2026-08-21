# syntax=docker/dockerfile:1

FROM oven/bun:1.3.7 AS bun

FROM node:22-bookworm-slim AS frontend

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app/ui

COPY ui/package.json ui/bun.lock ./
COPY ui/patches ./patches
COPY ui/packages/csound-browser ./packages/csound-browser
COPY ui/src/assets/vasm ./src/assets/vasm
RUN bun install --frozen-lockfile

COPY ui ./
RUN node ./node_modules/vite/bin/vite.js build

FROM golang:1.26-alpine AS server

WORKDIR /src

COPY server/go.mod ./
RUN go mod download

COPY server ./
COPY --from=frontend /app/ui/build ./static
RUN go run ./cmd/pack-static -source static -destination static.zip
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /patchies-server .
RUN mkdir -p /runtime/app/pb_data && chown 65532:65532 /runtime/app/pb_data

FROM gcr.io/distroless/static-debian12

WORKDIR /app

COPY --from=server /patchies-server /patchies-server
COPY --from=server --chown=65532:65532 /runtime/app/pb_data /app/pb_data

ENV PATCHIES_RUN_UID=65532
ENV PATCHIES_RUN_GID=65532

EXPOSE 8090

USER 65532:65532

ENTRYPOINT ["/patchies-server"]
CMD ["serve", "--http=0.0.0.0:8090"]
