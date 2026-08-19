# syntax=docker/dockerfile:1

FROM oven/bun:1.2 AS frontend

WORKDIR /app/ui

COPY ui/package.json ui/bun.lock ./
COPY ui/patches ./patches
COPY ui/packages/csound-browser ./packages/csound-browser
COPY ui/src/assets/vasm ./src/assets/vasm
RUN bun install --frozen-lockfile

COPY ui ./
RUN bun run build

FROM golang:1.26-alpine AS server

WORKDIR /src

COPY server/go.mod ./
RUN go mod download

COPY server ./
COPY --from=frontend /app/ui/build ./static
RUN go run ./cmd/pack-static -source static -destination static.zip
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /patchies .

FROM gcr.io/distroless/static-debian12

WORKDIR /app

COPY --from=server /patchies /patchies

VOLUME ["/app/pb_data"]

EXPOSE 8090

ENTRYPOINT ["/patchies"]
CMD ["serve", "--http=0.0.0.0:8090"]
