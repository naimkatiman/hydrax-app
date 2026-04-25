#!/usr/bin/env bash
# Live cross-service /healthz smoke. Starts all 8 services on their default
# ports, verifies each responds with its identity, then tears them down.
#
# Run from repo root:
#     bash scripts/smoke-services.sh
#
# Prerequisites: Go 1.22+, Node 20+, pnpm 9+, services already built once.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PIDS=()
cleanup() {
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT

start_go() {
  local svc="$1" port="$2"
  (cd "services/$svc" && PORT="$port" go run ./cmd/server >/tmp/"$svc".log 2>&1) &
  PIDS+=($!)
}

start_ts() {
  local pkg="$1" port="$2"
  (PORT="$port" pnpm -F "$pkg" --silent dev >/tmp/"${pkg//[\/@]/_}".log 2>&1) &
  PIDS+=($!)
}

start_go workflow-svc 7001
start_go approval-svc 7002
start_go audit-svc 7003
start_go hydrax-adapter 7004
start_go canton-adapter 7005
start_ts @hydrax/notify-svc 7101
start_ts @hydrax/integration-svc 7102
start_ts @hydrax/bff 7103

# Give servers a moment to bind
sleep 4

declare -A EXPECT=(
  [7001]=workflow-svc
  [7002]=approval-svc
  [7003]=audit-svc
  [7004]=hydrax-adapter
  [7005]=canton-adapter
  [7101]=notify-svc
  [7102]=integration-svc
  [7103]=bff
)

failed=0
for port in 7001 7002 7003 7004 7005 7101 7102 7103; do
  expected="${EXPECT[$port]}"
  body="$(curl -fsS --max-time 3 "http://localhost:$port/healthz" 2>/dev/null || true)"
  if [[ "$body" == *"\"service\":\"$expected\""* && "$body" == *"\"status\":\"ok\""* ]]; then
    printf '  :%s -> %s ok\n' "$port" "$expected"
  else
    printf '  :%s -> FAIL (expected %s, got: %s)\n' "$port" "$expected" "$body"
    failed=1
  fi
done

if [[ $failed -ne 0 ]]; then
  echo "smoke FAILED — see /tmp/*.log for details"
  exit 1
fi
echo "smoke OK — all 8 services healthy"
