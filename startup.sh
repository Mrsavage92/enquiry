#!/bin/sh
# Revive contract: start the Enquiry prototype on 0.0.0.0:8080 if it is down.
set -eu
cd /workspace
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev > /tmp/enquiry-dev.log 2>&1 &
exit 0
