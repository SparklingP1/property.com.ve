#!/usr/bin/env bash
# Daily property.com.ve scrape for the work server's cron (GitHub Actions are
# switched off). Does NOT send user alert e-mails (send_alerts.py) or the
# admin summary: scraping and the market index only.
#
#   scraper/cron/run_daily.sh              # live run
#   scraper/cron/run_daily.sh --dry-run    # extra args go to run.py
#
# Exit status: 0 ok; non-zero if setup, a source, or the monthly index failed.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROPERTY_ENV_FILE:-/home/dan/ve-secrets/sites/property.com.ve/.env.local}"
VENV="${PROPERTY_VENV:-/home/dan/.venvs/property-scraper}"
LOG_DIR="${PROPERTY_LOG_DIR:-/home/dan/VE/logs/property-scraper}"
PY_BIN="${PYTHON:-/usr/bin/python3}"

mkdir -p "$LOG_DIR/runs"
LOG="$LOG_DIR/$(date -u +%Y-%m-%d).log"
exec >>"$LOG" 2>&1
echo "=== $(date -u +%FT%TZ) run_daily start (repo $REPO, args: $*)"

# One run at a time
exec 9>"$LOG_DIR/.lock"
if ! flock -n 9; then
  echo "another run is still going; exiting"
  exit 75
fi

# --- environment: read only the two names we need, never print values ------
get_var() {  # get_var NAME -> value of NAME= in $ENV_FILE (quotes stripped)
  local line
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$ENV_FILE" | tail -n 1)" || return 1
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"; line="${line%\'}"; line="${line#\'}"
  printf '%s' "$line"
}
[ -r "$ENV_FILE" ] || { echo "env file not readable: $ENV_FILE"; exit 10; }
SUPABASE_URL="$(get_var NEXT_PUBLIC_SUPABASE_URL)"
SUPABASE_KEY="$(get_var SUPABASE_SERVICE_ROLE_KEY)"
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in $ENV_FILE"
  exit 10
fi
export SUPABASE_URL SUPABASE_KEY
export PROPERTY_SCRAPER_RUN_LOG="$LOG_DIR/runs"

# --- venv -------------------------------------------------------------------
REQ="$REPO/scraper/requirements.txt"
if [ ! -x "$VENV/bin/python" ]; then
  "$PY_BIN" -m venv "$VENV" || { echo "venv creation failed"; exit 11; }
fi
STAMP="$VENV/.requirements.sha256"
if ! sha256sum -c --status "$STAMP" 2>/dev/null; then
  "$VENV/bin/pip" install -q --upgrade pip >/dev/null && \
  "$VENV/bin/pip" install -q -r "$REQ" || { echo "pip install failed"; exit 11; }
  sha256sum "$REQ" > "$STAMP"
fi

# --- scrape -----------------------------------------------------------------
status=0
extra=()
# Sundays: walk every RE/MAX search page (slow; enables absence expiry for RE/MAX)
[ "$(date -u +%u)" = "7" ] && extra+=(--remax-full)
"$VENV/bin/python" "$REPO/scraper/run.py" --source all "${extra[@]}" "$@"
rc=$?
echo "run.py exit $rc"
[ $rc -ne 0 ] && status=$rc

# --- monthly index on the 1st (previous month), live runs only --------------
case " $* " in *" --dry-run "*) dry=1 ;; *) dry=0 ;; esac
if [ "$(date -u +%d)" = "01" ] && [ $dry -eq 0 ]; then
  "$VENV/bin/python" "$REPO/scraper/compute_stats.py" --apply
  rc=$?
  echo "compute_stats.py exit $rc"
  [ $rc -ne 0 ] && [ $status -eq 0 ] && status=20
fi

# keep 90 days of daily logs
find "$LOG_DIR" -maxdepth 1 -name '20*.log' -mtime +90 -delete 2>/dev/null

echo "=== $(date -u +%FT%TZ) run_daily end, exit $status"
exit $status
