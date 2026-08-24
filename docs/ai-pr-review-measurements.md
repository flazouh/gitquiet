# Three measurements of AI review bots on public GitHub PRs

Measured 2026-08-22 against the GitHub GraphQL API. Raw per-thread records are
committed under [docs/data/](data/); every number below is reproducible from them
with [analyze_full.py](data/analyze_full.py).

**Two headlines.**

1. **The staleness hypothesis is wrong, and wrong in the opposite direction.**
   Bot threads go stale at 38.8%, human threads at 55.7%. The dead weight a
   filter would target — a bot thread that went stale and was never resolved —
   is 5.7% of bot threads. Cross-bot duplicates add 3.4%. That ceiling is too
   low to build a product on.
2. **Published resolution rate measures whether the vendor ships auto-resolve,
   not whether the comment was any good.** Six of thirteen tools close their own
   threads (31–61% of them); seven never do. Decomposing by `resolvedBy` moves
   CodeRabbit from 81% "resolved" to 18.1% human assent, and reverses most of
   the ranking.

---

## Corpus

| | |
|---|---|
| Review threads | 42,714 raw, 42,184 after dedupe |
| **AI-review-bot threads** | **34,331** |
| Human threads (control) | 5,938 |
| Other bot threads (CI, scanners) | 1,915 |
| Repositories | 300 |
| Pull requests | 8,734, of which 8,087 carry a bot thread |
| PR creation dates | 2024-11-07 to 2026-08-22 |
| AI review bots with n ≥ 80 | 13 |

Method: for each repo, the most recently created PRs (`MERGED`, `CLOSED`,
`OPEN`), up to 60 `reviewThreads` per PR, reading `isOutdated`, `isResolved`,
`resolvedBy`, `path`, `line`, `originalLine` and the first comment's author
directly off `ReviewThread`.

Repos were found in two waves. Wave 1 code-searched bot config files
(`.coderabbit.yaml`, `greptile.json`, `BUGBOT.md`, `.pr_agent.toml`) and ranked
by PR count — which over-sampled whichever bot is most popular. Wave 2 fixed
that by seeding from each bot's *own* config file and weighting selection toward
the rare tools. That took Greptile from n=140 across 6 repos to n=1,704 across
53, and materially changed its numbers. Ranking candidate repos by size finds
the popular tool; searching for the tool's own config file finds the tool.

Bot classification is by login. Excluded from the AI set and reported separately:
`github-advanced-security`, `github-actions`, Sentry's bots, `clickhouse-gh`,
DeepSource, CodeScene, Aikido, gitStream, `github-code-quality`.

---

## Master table

`assent%` = the thread is resolved **and** a `User` account that is not the bot
itself closed it. `self%` = the bot closed its own thread. Wilson 95% intervals.

| Bot | n | repos | stale % | 95% CI | assent % | 95% CI | self % | stale & unres. | thr/PR |
|---|---:|---:|---:|---|---:|---|---:|---:|---:|
| CodeRabbit | 13,577 | 142 | 36.7% | 35.9–37.5 | 18.1% | 17.5–18.8 | 52.8% | 3.6% | 4.34 |
| OpenAI Codex | 3,838 | 56 | 46.0% | 44.5–47.6 | 55.3% | 53.7–56.9 | 0.0% | 12.0% | 3.95 |
| Gemini Code Assist | 3,534 | 50 | 41.7% | 40.1–43.4 | 61.8% | 60.2–63.4 | 0.0% | 8.9% | 2.90 |
| Cursor Bugbot | 3,429 | 52 | 30.0% | 28.5–31.6 | 26.2% | 24.7–27.7 | 56.4% | 0.8% | 3.16 |
| cubic | 2,449 | 17 | 43.6% | 41.6–45.5 | 33.4% | 31.6–35.3 | 38.7% | 2.7% | 5.27 |
| GitHub Copilot | 2,078 | 87 | 44.0% | 41.9–46.2 | 50.6% | 48.5–52.8 | 0.0% | 14.1% | 2.99 |
| Qodo | 2,057 | 40 | 36.8% | 34.8–39.0 | 19.2% | 17.5–20.9 | 51.7% | 3.3% | 2.94 |
| Greptile | 1,704 | 53 | 44.4% | 42.1–46.8 | 25.2% | 23.2–27.4 | 46.4% | 3.6% | 2.00 |
| FullSend | 720 | 8 | 25.8% | 22.8–29.2 | 61.5% | 57.9–65.0 | 0.0% | 9.9% | 5.50 |
| Macroscope | 318 | 3 | 45.9% | 40.5–51.4 | 6.9% | 4.6–10.3 | 60.7% | 8.5% | 4.42 |
| Claude | 292 | 7 | 47.9% | 42.3–53.7 | 34.6% | 29.4–40.2 | 0.0% | 21.6% | 2.73 |
| Gitar | 147 | 5 | 21.1% | 15.3–28.4 | 8.2% | 4.7–13.7 | 30.6% | 6.1% | 1.81 |
| Sourcery | 90 | 8 | 32.2% | 23.5–42.4 | 25.6% | 17.7–35.4 | 48.9% | 1.1% | 1.67 |
| **Humans (control)** | 5,938 | 182 | 55.7% | 54.4–56.9 | 42.5% | 41.3–43.8 | — | 13.1% | 3.83 |

---

## 1. Stale rate

`isOutdated` is true when the diff hunk the thread anchors to no longer exists at
head.

| Actor | n | stale % | 95% CI | stale AND unresolved | 95% CI |
|---|---:|---:|---|---:|---|
| All AI bots | 34,331 | **38.8%** | 38.3–39.3 | 5.7% | 5.4–5.9 |
| Humans | 5,938 | **55.7%** | 54.4–56.9 | 13.1% | 12.3–14.0 |

Humans go stale at 1.44x the bot rate. The inversion holds in the within-PR
paired test, which removes repo, project-culture and churn effects by restricting
to the 1,107 PRs carrying both a bot thread and a human thread:

| | n | stale % | 95% CI |
|---|---:|---:|---|
| AI bots | 5,516 | 45.2% | 43.9–46.5 |
| Humans | 4,602 | 57.7% | 56.2–59.1 |

**Reading it.** `isOutdated` marks a comment whose code was subsequently
rewritten. For a human reviewer that is usually the review *working*: they asked
for a change and got one. A bot commenting seconds after a push, on code nobody
revisits, keeps its anchor. Staleness measures how much the code moved after the
comment landed, and human comments move code more often. Treating high staleness
as waste has the sign backwards.

**The number a filter could target is 5.7% of bot threads**, ranging from 0.8%
(Cursor Bugbot) to 21.6% (Claude). For the highest-volume tool, CodeRabbit, it is
3.6%. Stated plainly: too small to be the product. It is a feature, and only for
the four tools above 10% — Claude, GitHub Copilot, OpenAI Codex and FullSend.

---

## 2. Duplicate rate between different bots

1,369 of 8,087 AI-reviewed PRs (16.9%) carry threads from two or more distinct AI
bots, holding 11,308 bot threads.

**Mechanical overlap** — two different bots, same PR, same file, anchors within 3
lines: 1,253 colliding pairs; 2,104 of 11,308 threads sit in at least one
collision.

- **18.6%** (CI 17.9–19.3) of threads on multi-bot PRs
- **6.13%** (CI 5.88–6.39) of all bot threads

**Hand-judged** — 50 collisions sampled across 50 distinct bot-pairs, both bodies
read in full, judged on whether they describe the same defect. Verdicts with
reasons: [judgments_all.json](data/judgments_all.json).

| Verdict | Count |
|---|---:|
| Same defect | 26 |
| Same code, different consequence and fix | 1 |
| Different defects that merely share lines | 20 |
| Could not tell (one body was analysis scaffold only) | 3 |

Strict duplicate share of resolvable collisions: **55.3%** (CI 41.2–68.6, n=47).
Counting the three unclear cases as non-duplicates gives 52.0% (CI 38.5–65.2).
The first 20 judgments alone gave 55%, so the estimate converged.

**Corrected duplicate rate** = mechanical × hand-judged:

- of threads on multi-bot PRs: **10.3%** (CI 7.7–12.8)
- of all bot threads: **3.4%** (CI 2.5–4.2)

The two numbers really are different. Almost half of mechanical collisions are
not duplicates — colocation on a line is weak evidence. Two failure modes:

- `MentraOS#3665` line ~245: Cursor Bugbot reports a hung decode starving every
  later thumbnail; cubic reports an idle executor thread never shut down. Same
  static executor, two distinct defects.
- `siemens/ix#2659`: Gemini Code Assist reports that negative `tabindex`
  elements break sequential tab order; CodeRabbit says the comparator duplicates
  an existing helper. One correctness, one style.

And a clean duplicate for contrast — `gocryptotrader#2305`, where Copilot and
Codex independently report that `BENCHCHECK_FLAGS=-warn` stops the allocation
gate from ever failing.

---

## 3. Threads per PR

Denominator is PRs that bot actually commented on, so this is conditional volume.

| Bot | PRs | mean | median | p90 | max |
|---|---:|---:|---:|---:|---:|
| FullSend | 131 | 5.50 | 3 | 11 | 54 |
| cubic | 465 | 5.27 | 3 | 12 | 60 |
| Macroscope | 72 | 4.42 | 3 | 8 | 26 |
| CodeRabbit | 3,127 | 4.34 | 2 | 10 | 60 |
| OpenAI Codex | 972 | 3.95 | 2 | 8 | 57 |
| Cursor Bugbot | 1,084 | 3.16 | 2 | 7 | 57 |
| GitHub Copilot | 695 | 2.99 | 2 | 6 | 23 |
| Qodo | 699 | 2.94 | 2 | 6 | 29 |
| Gemini Code Assist | 1,220 | 2.90 | 2 | 5 | 60 |
| Claude | 107 | 2.73 | 2 | 5 | 16 |
| **Greptile** | 854 | **2.00** | 1 | 4 | 26 |
| Gitar | 81 | 1.81 | 1 | 3 | 7 |
| Sourcery | 54 | 1.67 | 1 | 3 | 6 |
| **Humans (control)** | 1,551 | 3.83 | 2 | 8 | 56 |

No primary source counted this at scale for commercial tools before.

1. **Every tool has a median of 3 or fewer, and nine of thirteen have a median
   of 2.** The "comment explosion" framing does not survive contact with the
   data. Means are pulled up by a thin tail — four tools have a 60-thread PR.
2. **Greptile is the quietest of the major tools** at 2.00 per PR, median 1. That
   matches its own "agent of few words" claim, on an independent sample of 854
   PRs across 53 repos. Note the wave-1 figure was 1.55 on 6 repos; broader
   sampling moved it up 29%.
3. **Humans out-comment nine of the thirteen bots**, at 3.83 per PR. The volume
   complaint is not supported by volume.

---

## 4. Who actually closes the thread

The self-close split is near-binary. Six tools close 31–61% of their own threads;
seven never do it at all. Nothing sits between 0% and 30%. That is a product
decision, not a spectrum.

Ranked by human assent, with the raw resolution figure alongside:

| Rank | Bot | human assent | 95% CI | self-closes |
|---:|---|---:|---|---:|
| 1 | Gemini Code Assist | 61.8% | 60.2–63.4 | never |
| 2 | FullSend | 61.5% | 57.9–65.0 | never |
| 3 | OpenAI Codex | 55.3% | 53.7–56.9 | never |
| 4 | GitHub Copilot | 50.6% | 48.5–52.8 | never |
| — | **Humans (control)** | **42.5%** | 41.3–43.8 | — |
| 5 | Claude | 34.6% | 29.4–40.2 | never |
| 6 | cubic | 33.4% | 31.6–35.3 | 38.7% |
| 7 | Cursor Bugbot | 26.2% | 24.7–27.7 | 56.4% |
| 8 | Sourcery | 25.6% | 17.7–35.4 | 48.9% |
| 9 | Greptile | 25.2% | 23.2–27.4 | 46.4% |
| 10 | Qodo | 19.2% | 17.5–20.9 | 51.7% |
| 11 | CodeRabbit | 18.1% | 17.5–18.8 | 52.8% |
| 12 | Gitar | 8.2% | 4.7–13.7 | 30.6% |
| 13 | Macroscope | 6.9% | 4.6–10.3 | 60.7% |

**What this proves and does not prove.** It proves raw resolution rate is
dominated by whether the vendor ships auto-resolve rather than by comment
quality — CodeRabbit reads 81% on the raw column and 18.1% here. It does **not**
prove CodeRabbit's comments are a third as good as Copilot's. Auto-resolve fires
when the tool detects the issue was fixed, which often means the developer *did*
act and simply never clicked resolve. Human assent therefore undercounts
auto-resolving tools by an unknown amount.

The clean comparison is among the seven tools that never self-close: Gemini
61.8%, FullSend 61.5%, Codex 55.3%, Copilot 50.6%, Claude 34.6%. Four of those
five sit **above** the 42.5% human-reviewer control — their comments get acted on
more often than a human colleague's do.

This confound reaches the literature. The Atlassian paper (arXiv:2510.05450)
defines resolution as "a subsequent commit modified the exact line", sidestepping
it. "Go Home Copilot" (arXiv:2607.21997) states "we exclude resolutions performed
solely by AI agents" — handled correctly. Any comparison built on raw
`isResolved` across tools is measuring auto-resolve.

---

## Sampling bias I could not remove

1. **Self-selection, and it is severe.** Every repo here chose to install a bot
   and chose to keep it. Teams that installed one and ripped it out are invisible
   by construction. All measurements are best-case.
2. **Recency.** Most recent PRs per repo. Open PRs have not finished accruing
   staleness, biasing the stale rate down by roughly 5 points.
3. **Assent undercounts auto-resolving tools.** See section 4. This is the
   largest remaining methodological weakness.
4. **Repo-count skew per tool.** FullSend (8 repos), Macroscope (3), Gitar (5),
   cubic (17) and Claude (7) are concentrated. Their rows are directional. Tools
   spread over 40+ repos — CodeRabbit, Copilot, Codex, Cursor, Greptile, Qodo,
   Gemini — are solid.
5. **Login-based classification.** A bot posting under a plain user account is
   miscounted as human. No AI reviewer appeared among the unclassified logins,
   but the method cannot prove a negative.

---

## What this says about what to build

The filter as scoped targets 5.7% of bot threads (stale and unresolved) plus 3.4%
genuine cross-bot duplicates. Assuming no overlap and a perfect classifier, the
ceiling is roughly one comment in eleven, and the highest-volume tools contribute
least to the first bucket.

The larger signal is the quality spread the measurement exposes. Human assent
runs 6.9% to 61.8% across tools; volume runs 1.67 to 5.50 threads per PR; the two
are uncorrelated. Gemini Code Assist leaves 2.90 threads per PR and 61.8% get
acted on by a person. Macroscope leaves 4.42 and 6.9% do. That is a per-tool
quality gap of nearly an order of magnitude, computable from the public API, and
nobody publishes it.

There is no independent, per-tool benchmark of these products — established
separately in [ai-pr-review-pain-points.md](ai-pr-review-pain-points.md) §4. What
this rig produces — per-tool human assent, comment volume, and stale-and-abandoned
rate over any repo set, with the auto-resolve confound removed — is closer to
filling that gap than anything currently published by a vendor or an academic
group.
