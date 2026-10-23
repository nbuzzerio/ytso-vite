#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ "$EUID" -ne 0 ]] || exit 64

operation=${1:-}
base=${2:-}
job=${3:-}
release_id=${4:-}
digest=${5:-}
[[ $# -ge 3 && $# -le 5 && "$base" =~ ^/[a-zA-Z0-9_./-]+$ && "$base" != / ]] || exit 64
[[ "$job" =~ ^[0-9]+-[0-9]+-[a-zA-Z0-9]{6}$ ]] || exit 64
case "$operation" in
  start|run) [[ $# == 5 && "$release_id" =~ ^[0-9a-f]{40}$ && "$digest" =~ ^[0-9a-f]{64}$ ]] || exit 64 ;;
  status|recover|recovery-worker) [[ $# == 3 ]] || exit 64 ;;
  *) exit 64 ;;
esac
[[ -d "$base" && -O "$base" && ! -L "$base" && "$(realpath -e "$base")" == "$base" ]] || exit 64
for directory in incoming releases deployments; do
  mkdir -p "$base/$directory"
  [[ -O "$base/$directory" && ! -L "$base/$directory" ]] || exit 64
done
incoming="$base/incoming/$job"
state="$base/deployments/$job"
[[ -d "$incoming" && ! -L "$incoming" && -O "$incoming" ]] || exit 64
script="$incoming/deploy-release.sh"
helper="$incoming/deploy-state.mjs"

status() {
  node "$helper" write-status "$state/status.json" "$1" "$release_id" 9>&-
}

readiness() {
  local attempt
  for attempt in {1..20}; do
    if node "$helper" health "$1" 9>&-; then return 0; fi
    sleep 2
  done
  return 1
}

rollback() {
  local previous
  status rolling_back
  if ! previous=$(node "$helper" previous-token "$state/previous.json" 9>&-); then
    status rollback_failed
    return 1
  fi
  if [[ "$previous" == present ]]; then
    if node "$helper" activate "$state/previous.json" 9>&- && readiness "$state/previous.json" && node "$helper" save unused 9>&-; then
      status rolled_back
      return 0
    fi
  else
    if node "$helper" remove-candidate "$incoming/candidate.json" 9>&-; then
      status activation_failed
      return 0
    fi
  fi
  status rollback_failed
  return 1
}

recover_state() {
  local current
  current=$(node "$helper" status-token "$state/status.json" 9>&-)
  case "$current" in
    succeeded|rolled_back|preparation_failed|activation_failed) return 0 ;;
  esac
  if [[ -f "$state/activation-started" ]]; then
    rollback
  else
    status preparation_failed
  fi
}

case "$operation" in
  status)
    [[ $# == 3 && -d "$state" && ! -L "$state" ]] || exit 64
    exec node "$helper" status "$state/status.json"
    ;;
  start)
    [[ $# == 5 && "$release_id" =~ ^[0-9a-f]{40}$ && "$digest" =~ ^[0-9a-f]{64}$ ]] || exit 64
    mkdir "$state"
    status queued
    nohup setsid timeout --signal=TERM --kill-after=180s 20m bash "$script" run "$base" "$job" "$release_id" "$digest" </dev/null >"$state/worker.log" 2>&1 &
    exit 0
    ;;
  recover)
    [[ $# == 3 && -d "$state" && ! -L "$state" ]] || exit 64
    nohup setsid timeout --signal=TERM --kill-after=180s 5m bash "$script" recovery-worker "$base" "$job" </dev/null >"$state/recovery.log" 2>&1 &
    exit 0
    ;;
  run|recovery-worker) ;;
  *) exit 64 ;;
esac

[[ -d "$state" && ! -L "$state" && -O "$state" ]] || exit 64
exec 9>"$base/deploy.lock"
if ! flock -n 9; then
  if [[ "$operation" == run ]]; then status busy; rm -f "$incoming/runtime.json"; fi
  exit 75
fi

if [[ "$operation" == recovery-worker ]]; then
  [[ -f "$base/active-deployment" && "$(cat "$base/active-deployment")" == "$job" ]] || exit 64
  release_id=$(node "$helper" release-token "$state/status.json" 9>&-)
  recover_state
  rm -f "$incoming/runtime.json"
  exit 0
fi
[[ $# == 5 && "$release_id" =~ ^[0-9a-f]{40}$ && "$digest" =~ ^[0-9a-f]{64}$ ]] || exit 64
[[ "$(node "$helper" status-token "$state/status.json" 9>&-)" == queued ]] || exit 64

if [[ -f "$base/active-deployment" ]]; then
  previous_job=$(cat "$base/active-deployment")
  [[ "$previous_job" =~ ^[0-9]+-[0-9]+-[a-zA-Z0-9]{6}$ ]] || exit 64
  if ! previous_status=$(node "$helper" status-token "$base/deployments/$previous_job/status.json" 9>&-); then
    status blocked
    rm -f "$incoming/runtime.json"
    exit 1
  fi
  case "$previous_status" in
    succeeded|rolled_back|preparation_failed|activation_failed) ;;
    *) status blocked; rm -f "$incoming/runtime.json"; exit 1 ;;
  esac
fi
node "$helper" write-pointer "$base/active-deployment" "$job" 9>&-

finished=false
cleanup() {
  local result=$?
  trap - EXIT TERM INT HUP
  if [[ "$finished" == false ]]; then
    local current
    current=$(node "$helper" status-token "$state/status.json" 9>&-) || current=interrupted
    case "$current" in
      succeeded|rolled_back|preparation_failed|activation_failed) ;;
      *) if [[ -f "$state/activation-started" ]]; then rollback || true; else status preparation_failed; fi ;;
    esac
  fi
  rm -f "$incoming/runtime.json"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
trap 'exit 129' HUP

status preparing
python3 "$incoming/validate-release.py" "$incoming/ytso-release.tar.gz" "$digest" "$release_id" 9>&-
release_dir=$(mktemp -d "$base/releases/${release_id:0:12}-XXXXXX")
tar --extract --gzip --file "$incoming/ytso-release.tar.gz" --directory "$release_dir" --no-same-owner --no-same-permissions 9>&-
(cd "$release_dir" && HUSKY=0 NODE_ENV=production timeout 10m npm ci --omit=dev --no-audit --no-fund 9>&-)
node "$helper" snapshot "$state/previous.json" 9>&-
previous=$(node "$helper" previous-token "$state/previous.json" 9>&-)
if [[ "$previous" == present ]]; then readiness "$state/previous.json"; fi
node "$helper" candidate "$incoming/runtime.json" "$release_dir" "$release_id" "$state/previous.json" 9>&-
rm -f "$incoming/runtime.json"
node "$helper" mark "$state/activation-started" 9>&-
status activating
if node "$helper" activate "$incoming/candidate.json" 9>&-; then
  status verifying
  if readiness "$incoming/candidate.json" && node "$helper" save unused 9>&-; then
    status succeeded
    finished=true
    exit 0
  fi
fi
rollback || true
finished=true
exit 1
