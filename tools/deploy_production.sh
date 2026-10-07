#!/usr/bin/env bash
set -euo pipefail
release_dir="${1:?Release directory required}"
env_file="${2:?Shared environment required}"
release_id="${3:?Git SHA required}"
[[ "$release_id" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid release SHA" >&2; exit 1; }
[[ -f "$env_file" ]] || { echo "Shared production environment must be provisioned first." >&2; exit 1; }
cd "$release_dir"
export ENV_FILE="$env_file"
export RELEASE_IMAGE="recognize_cctv_fe:$release_id"
compose=(docker compose -p recognize-cctv-fe -f docker-compose.yml --env-file "$env_file")
state_dir="$(dirname "$env_file")/frontend-deployment"
mkdir -p "$state_dir"
exec 9>"$state_dir/deploy.lock"
flock -n 9 || { echo "Another deployment is running" >&2; exit 1; }
previous_image=$(docker inspect --format '{{.Image}}' recognize_cctv_fe 2>/dev/null || true)
previous_release=""
[[ ! -f "$state_dir/current" ]] || previous_release=$(cat "$state_dir/current")
if [[ -n "$previous_image" && -z "$previous_release" ]]; then
  echo "Register the existing release in $state_dir/current before deployment." >&2
  exit 1
fi
"${compose[@]}" config --quiet
"${compose[@]}" build recognize_cctv_fe
rollback() {
  status=$?
  if [[ -n "$previous_image" ]]; then
    export RELEASE_IMAGE="$previous_image"
    cd "$previous_release"
    docker compose -p recognize-cctv-fe -f docker-compose.yml --env-file "$env_file" up -d --no-build --force-recreate recognize_cctv_fe || true
  fi
  exit "$status"
}
trap rollback ERR
"${compose[@]}" up -d --no-build --force-recreate recognize_cctv_fe
healthy=false
for attempt in {1..60}; do
  state=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' recognize_cctv_fe)
  if [[ "$state" == 'running healthy' ]]; then
    curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8005/ > /dev/null
    healthy=true
    break
  fi
  [[ "$state" != *unhealthy* && "$state" != exited* && "$state" != restarting* ]]
  sleep 5
done
[[ "$healthy" == true ]]
printf '%s\n' "$release_dir" > "$state_dir/current.next"
mv "$state_dir/current.next" "$state_dir/current"
trap - ERR
echo "Production frontend release is healthy."
