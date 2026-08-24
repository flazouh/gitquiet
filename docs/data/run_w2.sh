#!/bin/zsh
D=/Users/alex/Documents/githubpro/.claude/worktrees/ai-pr-review-research-d086e8/docs/data
for i in $(seq 1 8); do
  rem=$(gh api rate_limit --jq '.resources.graphql.remaining')
  if [ "$rem" -lt 900 ]; then
    w=$(gh api rate_limit --jq '.resources.graphql.reset - now | floor')
    echo "[w2] rl=$rem sleep ${w}s" >&2; sleep $((w+15))
  fi
  python3 "$D/harvest_w2.py" 1 2>>"$D/harvest_w2.err"
  c=$?
  echo "[w2] round $i exit=$c rows=$(wc -l < $D/threads_w2.jsonl 2>/dev/null) repos=$(wc -l < $D/harvest_w2_done.txt 2>/dev/null)" >&2
  [ $c -eq 0 ] && { echo "[w2] COMPLETE" >&2; break; }
done
