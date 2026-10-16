#!/usr/bin/env bash
# Checks that the live site serves main's content after a deploy (#83, #84).
# Usage: bash verify-live.sh [base-url]
set -u
BASE="${1:-https://enquiry-ashy.vercel.app}"
fail=0

page() { curl -s --compressed -m 20 "$BASE$1"; }
has() {
  if page "$1" | grep -q "$2"; then echo "PASS $1 has: $2"; else echo "FAIL $1 missing: $2"; fail=1; fi
}
lacks() {
  if page "$1" | grep -q "$2"; then echo "FAIL $1 still has: $2"; fail=1; else echo "PASS $1 free of: $2"; fi
}
code() {
  got=$(curl -s -o /dev/null -w "%{http_code}" -m 20 "$BASE$1")
  if [ "$got" = "$2" ]; then echo "PASS $1 -> $got"; else echo "FAIL $1 -> $got (want $2)"; fail=1; fi
}

has / "for as long as you stay"
has / "Built for your trade"
has / "Priya"
lacks / "while you&#x27;re a member"
lacks / "Prices include GST"
has /privacy "n8n"
has /privacy "oaic.gov.au"
code "/unsubscribe?t=x&result=" 200
code /api/unsubscribe 405
code /og.jpg 200
code /no-such-page-golive 404

size=$(curl -s -m 20 "$BASE/og.jpg" | python -c "import sys,struct
d=sys.stdin.buffer.read(); i=2
while i<len(d):
  m=d[i+1]; l=struct.unpack('>H',d[i+2:i+4])[0]
  if m in (0xC0,0xC2): h,w=struct.unpack('>HH',d[i+5:i+9]); print(f'{w}x{h}'); break
  i+=2+l")
[ "$size" = "1200x630" ] && echo "PASS og.jpg $size" || { echo "FAIL og.jpg $size"; fail=1; }

exit $fail
