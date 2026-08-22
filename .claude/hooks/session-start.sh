#!/bin/bash

# Installs what a Claude Code on the web session needs before it starts:
# `bun install` also clones the Effect source into .repos/effect, installs the
# lefthook git hooks, and writes .wxt/tsconfig.json (see scripts/prepare.sh),
# which is everything `bun run gates` and `bun run build` depend on.

set -euo pipefail

# Only in remote (web) sessions; a laptop already has its own setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

bun install

# The QA capture (`bun run qa`) drives whatever findChrome finds, and in this
# container that is the Chromium Playwright pre-installs. Said via CHROME_PATH so
# the repository's own scripts stay ignorant of where this machine keeps it.
if [ -z "${CHROME_PATH:-}" ] && [ -x /opt/pw-browsers/chromium ]; then
  echo 'export CHROME_PATH=/opt/pw-browsers/chromium' >> "$CLAUDE_ENV_FILE"
fi
