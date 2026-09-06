#!/usr/bin/env bash
# Configure YOUR fork from your seat card — one command, no settings forms.
#
#   ./scripts/setup-seat.sh path/to/seatNN.txt
#   ./scripts/setup-seat.sh            # then paste the JSON when prompted
#
# Sets the AZURE_CREDENTIALS secret and the two repo variables, then verifies.
set -euo pipefail

command -v gh >/dev/null || { echo "GitHub CLI (gh) not found: https://cli.github.com" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Run 'gh auth login' first." >&2; exit 1; }

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
case "$REPO" in
  Buckshot-Technologies/*)
    echo "You are in the upstream repo, not your fork." >&2
    echo "Run this inside YOUR fork (gh repo fork ... --clone)." >&2
    exit 1 ;;
esac
echo "configuring fork: $REPO"

CARD="${1:-}"
if [ -n "$CARD" ] && [ -f "$CARD" ]; then
  # pull the JSON block out of the seat card
  CREDS="$(python3 - "$CARD" <<'PY'
import json,re,sys
text=open(sys.argv[1]).read()
m=re.search(r'\{.*?"tenantId".*?\}', text, re.S)
if not m: sys.exit("no JSON block found in card")
print(json.dumps(json.loads(m.group(0))))
PY
)"
else
  echo "Paste the JSON block from your seat card, then press Ctrl-D:"
  CREDS="$(python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)))')"
fi

# Resource group and app name come from the card; env vars override for testing.
SEAT_RG="${SEAT_RG:-}"
APP_NAME="${APP_NAME:-}"
if [ -n "$CARD" ] && [ -f "$CARD" ]; then
  [ -z "$SEAT_RG" ]  && SEAT_RG="$(grep -E 'AZURE_RESOURCE_GROUP' "$CARD" | head -1 | sed 's/.*=[[:space:]]*//')"
  [ -z "$APP_NAME" ] && APP_NAME="$(grep -E 'CONTAINER_APP_NAME'  "$CARD" | head -1 | sed 's/.*=[[:space:]]*//')"
fi
: "${SEAT_RG:?could not read AZURE_RESOURCE_GROUP — pass the card file, or set SEAT_RG=}"
: "${APP_NAME:?could not read CONTAINER_APP_NAME — pass the card file, or set APP_NAME=}"

printf '%s' "$CREDS" | gh secret set AZURE_CREDENTIALS --repo "$REPO"
gh variable set AZURE_RESOURCE_GROUP --repo "$REPO" --body "$SEAT_RG"
gh variable set CONTAINER_APP_NAME   --repo "$REPO" --body "$APP_NAME"

echo
echo "done:"
echo "  secret    AZURE_CREDENTIALS     set"
echo "  variable  AZURE_RESOURCE_GROUP = $SEAT_RG"
echo "  variable  CONTAINER_APP_NAME   = $APP_NAME"
echo
gh secret list --repo "$REPO" | sed 's/^/  /'
gh variable list --repo "$REPO" | sed 's/^/  /'
echo
echo "Now: git push origin main  — then watch the Actions tab."
