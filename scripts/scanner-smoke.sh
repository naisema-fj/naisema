#!/bin/sh
# Builds the upload scanner image (containers/scanner) and checks it gives real ClamAV verdicts:
# a clean file passes, and the EICAR test file is reported infected whether sent with a length
# or chunked. Needs Docker. Run before changing the scanner image, and in CI.
#
#   sh scripts/scanner-smoke.sh
set -eu
IMAGE=naisema-scanner-smoke
NAME=naisema-scanner-smoke-$$
PORT=${SCANNER_SMOKE_PORT:-18080}

docker build -t "$IMAGE" containers/scanner
docker run -d --rm --name "$NAME" -p "$PORT:8080" "$IMAGE" >/dev/null
trap 'docker stop "$NAME" >/dev/null 2>&1 || true' EXIT

echo "Waiting for clamd to load its signatures..."
i=0
until curl -fsS "http://localhost:$PORT/" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 180 ]; then
    docker logs "$NAME" | tail -20
    echo "The scanner did not become ready." >&2
    exit 1
  fi
  sleep 1
done

# The EICAR test file, decoded at run time so no copy of it is kept in the repository.
EICAR=$(printf '%s' 'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=' | base64 -d)

expect() {
  description=$1
  expected=$2
  shift 2
  actual=$(curl -sS -X POST "http://localhost:$PORT/scan" "$@")
  case "$actual" in
    *"\"verdict\":\"$expected\""*) echo "ok: $description -> $actual" ;;
    *)
      echo "FAIL: $description: expected $expected, got $actual" >&2
      exit 1
      ;;
  esac
}

expect "a clean PDF" clean --data-binary "%PDF-1.7 nothing to see here"
expect "the EICAR test file" infected --data-binary "$EICAR"
expect "EICAR sent chunked" infected -H "Transfer-Encoding: chunked" --data-binary "$EICAR"
expect "a clean file sent chunked" clean -H "Transfer-Encoding: chunked" --data-binary "hello"
echo "Scanner smoke test passed."
