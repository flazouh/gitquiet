#!/usr/bin/env bash
#
# Builds one pull request per Control Center situation in the scratch repo.
#
#     bash scripts/scratch-scenarios.sh
#
# Each pull request is named for what it is meant to draw, so the panel can be
# read against a state somebody chose rather than against whatever a real repo
# happened to be doing that afternoon. Run it again and it opens a fresh set;
# close the old ones by hand or leave them, they are all in a scratch repo.
#
# Point SCRATCH_REPO at a repository of your own. It commits as whoever your
# global git config says you are.
set -euo pipefail

REPO=${SCRATCH_REPO:-flazouh/ghpro-scratch}
WORK=$(mktemp -d)
STAMP=$(date +%s)

git clone --quiet "https://github.com/$REPO.git" "$WORK"
cd "$WORK"

say() { printf '\n=== %s ===\n' "$1"; }

# One commit that changes one line, so every pull request has a real diff.
commit() {
  printf '%s\n' "$2" >> "$1.txt"
  git add "$1.txt"
  git commit --quiet -m "$2"
}

branch() {
  git checkout --quiet main
  git checkout --quiet -b "$1"
}

open_pr() {
  git push --quiet -u origin "$1" 2>/dev/null
  gh pr create -R "$REPO" --head "$1" --base main --title "$2" --body "$3" | tail -n1 | sed 's#.*/##'
}

# 1. Commits landed after the reader reviewed: the delta row.
say "since"
SINCE="since-$STAMP"
branch "$SINCE"
commit since "first, and the one that gets reviewed"
N=$(open_pr "$SINCE" "since: commits landed after your review" "Expect: N commits since you last reviewed")
gh pr review "$N" -R "$REPO" --comment --body "Read the first commit."
commit since "second, landed after the review"
commit since "third, landed after the review"
git push --quiet
echo "#$N"

# 2. The reader reviewed the newest commit: no delta row at all.
say "level"
LEVEL="level-$STAMP"
branch "$LEVEL"
commit level "the only commit, and it is reviewed"
N=$(open_pr "$LEVEL" "level: you reviewed the newest commit" "Expect: no delta row")
gh pr review "$N" -R "$REPO" --comment --body "Read all of it."
echo "#$N"

# 3. The commit the reader reviewed is no longer on the branch.
say "rewritten"
REWRITE="rewritten-$STAMP"
branch "$REWRITE"
commit rewritten "first, and it will be rebased away"
N=$(open_pr "$REWRITE" "rewritten: rebased since your review" "Expect: Rewritten")
gh pr review "$N" -R "$REPO" --comment --body "Read it before the rebase."
git commit --quiet --amend -m "first, rewritten by an amend"
git push --quiet --force
echo "#$N"

# 4. Nobody has reviewed and nothing is failing: the empty panel.
say "quiet"
QUIET="quiet-$STAMP"
branch "$QUIET"
commit quiet "one commit, unreviewed"
N=$(open_pr "$QUIET" "quiet: nothing owed to anybody" "Expect: Nothing is owed here")
echo "#$N"

# 5. The base moved on after the branch left it.
say "behind"
BEHIND="behind-$STAMP"
branch "$BEHIND"
commit behind "the branch's own commit"
N=$(open_pr "$BEHIND" "behind: the base has moved on" "Expect: Behind main")
git checkout --quiet main
commit base "a commit on main, after the branch left it"
git push --quiet origin main
echo "#$N"

say "done"
echo "$WORK"
