#!/bin/sh
# Starts clamd and the scanning front end. freshclam refreshes the signatures in the background;
# if it can't reach the update servers, the image's own signatures are used.
set -eu
freshclam --daemon --checks=4 --stdout || echo "freshclam could not start; using the image's signatures"
clamd --config-file=/etc/clamav/clamd.conf &
exec /scanner/scanner-server
