#!/usr/bin/env bash
# Runs backend tests, starting the test database only when it's needed.
#
#   npm run test:backend                                   every backend test
#   npm run test:backend -- src/books/books.db.spec.ts     one database spec
#   npm run test:backend -- src/books/open-library.spec.ts one unit spec
#   npm run test:backend -- src/books                      everything in a folder
#
# Paths can start with apps/backend/ too. Anything else (like -t "test name")
# is passed on to Vitest. *.db.spec.ts files go to `nx test-db backend`
# (Docker and the test database); other specs go to `nx test backend`. A
# folder or name filter runs both.
set -euo pipefail

# Vitest runs from apps/backend, so paths from the repo root wouldn't match.
args=()
for arg in "$@"; do
  args+=("${arg#apps/backend/}")
done

run_unit=false
run_db=false
files=0
takes_value=false
for arg in ${args[@]+"${args[@]}"}; do
  # The name after -t is a test name, not a file.
  if $takes_value; then
    takes_value=false
    continue
  fi
  case "$arg" in
    -t | --testNamePattern) takes_value=true; continue ;;
    -*) continue ;;
    *.db.spec.ts) run_db=true ;;
    *.spec.ts | *.test.ts) run_unit=true ;;
    *) run_unit=true run_db=true ;;
  esac
  files=$((files + 1))
done
if [ "$files" -eq 0 ]; then
  run_unit=true
  run_db=true
fi

# A filter sent to both sides may only match on one of them, so only then is
# finding no tests allowed. A specific spec that matches nothing fails.
extra=()
if $run_unit && $run_db; then
  extra=(--passWithNoTests)
fi

# Both run before failing, so one failure doesn't hide the other's results.
status=0
if $run_unit; then
  npx nx test backend --output-style=static -- \
    ${extra[@]+"${extra[@]}"} ${args[@]+"${args[@]}"} || status=1
fi
if $run_db; then
  npx nx test-db backend --output-style=static -- \
    ${extra[@]+"${extra[@]}"} ${args[@]+"${args[@]}"} || status=1
fi
exit $status
