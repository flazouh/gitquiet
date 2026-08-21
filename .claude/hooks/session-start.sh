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
