#!/usr/bin/env sh

# What `bun install` runs after it installs, for every consumer of this
# repository and not only a developer on a laptop.

set -eu

./scripts/prepare-effect.sh

# Only where there is a repository to write hooks into.
#
# `lefthook install` writes into the hooks directory and exits 128 when git
# cannot find one. That failure used to take the whole install with it, and
# `bun install` is the first thing every build runs, so a source tree without a
# repository was a red build and nothing else. Two are exactly that: Railway
# copies the source without `.git`, and so does the archive Mozilla rebuilds the
# extension from. Neither commits anything, so neither needs a hook.
#
# The same question git answers rather than `[ -d .git ]`, which is false in a
# worktree, where `.git` is a file pointing at the real one.
if git rev-parse --git-dir > /dev/null 2>&1; then
  lefthook install
fi

bun run types
