#!/usr/bin/env bash
# Runs frontend tests. Pass spec files, folders or Vitest options:
#
#   npm run test:frontend                                   every frontend test
#   npm run test:frontend -- src/pages/PollPage.spec.tsx    one spec
#   npm run test:frontend -- src/pages -t "Results"         filter by test name
#
# Paths can start with apps/frontend/ too.
set -euo pipefail

# Vitest runs from apps/frontend, so paths from the repo root wouldn't match.
args=()
for arg in "$@"; do
  args+=("${arg#apps/frontend/}")
done

npx nx test frontend --output-style=static -- ${args[@]+"${args[@]}"}
