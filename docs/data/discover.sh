#!/bin/zsh
: > cand_new.txt
for spec in "greptile.json:4" "BUGBOT.md:7" ".coderabbit.yaml:6" ".coderabbit.yml:3" ".pr_agent.toml:6" "cubic.yaml:2" ".cubic.yaml:2" "macroscope.yaml:2" ".gemini/config.yaml:3" "AGENTS.md:4"; do
  f=${spec%:*}; pages=${spec#*:}
  for p in $(seq 1 $pages); do
    gh api -X GET search/code -f q="filename:$f" -f per_page=100 -f page=$p \
      --jq '.items[].repository.full_name' >> cand_new.txt 2>/dev/null || echo "  miss $f p$p" >&2
    sleep 7
  done
  echo "  $f done ($(wc -l < cand_new.txt) cumulative)" >&2
done
grep -E '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$' cand_new.txt | sort -u > cands_new.txt
wc -l < cands_new.txt
