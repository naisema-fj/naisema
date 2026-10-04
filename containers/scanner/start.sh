#!/bin/sh
# Starts clamd and the scanning front end. freshclam refreshes the signatures in the background;
# if it can't reach the update servers, the image's own signatures are used. If clamd or the
# front end stops, the container exits, so the next scan request starts a fresh one.
set -eu
freshclam --daemon --checks=4 --stdout || echo "freshclam could not start; using the image's signatures"
clamd --config-file=/etc/clamav/clamd.conf &
CLAMD=$!
/scanner/scanner-server &
SERVER=$!
while kill -0 "$CLAMD" 2>/dev/null && kill -0 "$SERVER" 2>/dev/null; do
  sleep 5
done
echo "clamd or the scanner front end stopped; exiting so the container is replaced"
exit 1
