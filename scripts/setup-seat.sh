#!/usr/bin/env bash
# Configure YOUR fork from your seat card — one command, no settings forms.
#
#   ./scripts/setup-seat.sh path/to/seatNN.txt
#   ./scripts/setup-seat.sh            # then paste the JSON when prompted
#
# Sets the AZURE_CREDENTIALS secret and ALL FOUR repo variables, then verifies.
# The pipeline's preflight step checks every one of them; a missing variable
# expands to an empty string and fails the deploy with an unrelated-looking
# Azure error, so this script reads them all from the card and refuses to
# continue if any is absent.
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

# All four variables come from the card; env vars override for testing.
read_card() { grep -E "^[[:space:]]*$1[[:space:]]*=" "$CARD" | head -1 | sed 's/.*=[[:space:]]*//' | tr -d '[:space:]'; }

SEAT_RG="${SEAT_RG:-}"; APP_NAME="${APP_NAME:-}"
ACR_NAME="${ACR_NAME:-}"; CA_ENV="${CA_ENV:-}"
if [ -n "$CARD" ] && [ -f "$CARD" ]; then
  [ -z "$SEAT_RG" ]  && SEAT_RG="$(read_card AZURE_RESOURCE_GROUP)"
  [ -z "$APP_NAME" ] && APP_NAME="$(read_card CONTAINER_APP_NAME)"
  [ -z "$ACR_NAME" ] && ACR_NAME="$(read_card ACR_NAME)"
  [ -z "$CA_ENV" ]   && CA_ENV="$(read_card CONTAINERAPPS_ENV)"
fi
: "${SEAT_RG:?could not read AZURE_RESOURCE_GROUP from the card}"
: "${APP_NAME:?could not read CONTAINER_APP_NAME from the card}"
: "${ACR_NAME:?could not read ACR_NAME from the card}"
: "${CA_ENV:?could not read CONTAINERAPPS_ENV from the card}"

printf '%s' "$CREDS" | gh secret set AZURE_CREDENTIALS --repo "$REPO"
gh variable set AZURE_RESOURCE_GROUP --repo "$REPO" --body "$SEAT_RG"
gh variable set CONTAINER_APP_NAME   --repo "$REPO" --body "$APP_NAME"
gh variable set ACR_NAME             --repo "$REPO" --body "$ACR_NAME"
gh variable set CONTAINERAPPS_ENV    --repo "$REPO" --body "$CA_ENV"

echo
echo "done:"
echo "  secret    AZURE_CREDENTIALS     set"
echo "  variable  AZURE_RESOURCE_GROUP = $SEAT_RG"
echo "  variable  CONTAINER_APP_NAME   = $APP_NAME"
echo "  variable  ACR_NAME             = $ACR_NAME"
echo "  variable  CONTAINERAPPS_ENV    = $CA_ENV"
echo
gh secret list --repo "$REPO" | sed 's/^/  /'
gh variable list --repo "$REPO" | sed 's/^/  /'
echo
echo "Now: git push origin main  — then watch the Actions tab."
