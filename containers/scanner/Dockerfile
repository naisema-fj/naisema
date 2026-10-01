# The upload scanner (ADR-0010): ClamAV (GPL-2.0) in its own container, never linked into the
# application. The official image ships with a recent signature database; freshclam keeps it
# current while the container runs. The HTTP front end is a static Go binary (standard library
# only), so nothing is installed into the ClamAV image.
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY main.go go.mod ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /scanner-server .

FROM clamav/clamav:stable
COPY clamd.conf /etc/clamav/clamd.conf
COPY start.sh /scanner/start.sh
COPY --from=build /scanner-server /scanner/scanner-server
USER clamav
EXPOSE 8080
ENTRYPOINT ["/bin/sh", "/scanner/start.sh"]
