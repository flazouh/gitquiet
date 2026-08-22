# Three measurements of AI review bots on public GitHub PRs

Measured 2026-08-22 against the GitHub GraphQL API. Raw per-thread records are
committed at [docs/data/threads.jsonl.gz](data/threads.jsonl.gz); every number
below is reproducible from it with [docs/data/analyze.py](data/analyze.py).

**Headline: the staleness hypothesis is wrong, and it is wrong in the opposite
direction.** Bot threads go stale at 37.6%, human threads at 62.3%. The dead
weight the filter would target — a bot thread that went stale and was never
resolved — is 5.0% of bot threads. That is too small to build a product on.

> **Correction, added 2026-08-22 after first publication.** The `resolved %`
> column in section 1 counts any thread with `isResolved: true`, including
> threads the bot closed itself. A second harvest capturing `ReviewThread.
> resolvedBy` shows that self-closure dominates for several tools — CodeRabbit
> self-closes 49.8% of its threads, Cursor Bugbot 57.4%, Macroscope 61.3%.
> **Resolution rate as published in section 1 is not a quality signal.** See
> [section 4](#4-who-actually-closes-the-thread-correction) for the decomposed
> numbers. The stale-rate results are unaffected.

---

## Corpus

| | |
|---|---|
| Review threads harvested | 13,180 raw, 13,071 after dedupe |
| AI-review-bot threads | **9,896** |
| Human threads (control) | 2,442 |
| Non-AI bot threads (CI, scanners) | 733 |
| Repositories | 58 harvested, 56 contributed bot threads |
| Pull requests | 2,592, of which 2,309 carry a bot thread |
| PR creation dates | 2026-01-12 to 2026-08-22 |
| Distinct AI review bots | 11 with n ≥ 100 |

Method: for each repo, the 100 most recently created PRs (`MERGED`, `CLOSED`,
`OPEN`), up to 60 `reviewThreads` per PR, reading `isOutdated`, `isResolved`,
`path`, `line`, `originalLine` and the first comment's author directly off
`ReviewThread`. Repos were found by code-searching for bot config files
(`.coderabbit.yaml`, `greptile.json`, `BUGBOT.md`, `.pr_agent.toml`), ranked by
PR count, then probed for live bot threads. Thread-page truncation (PRs with
more than 60 threads) affects 2.74% of rows.

Bot classification is by login. AI reviewers counted: CodeRabbit, Cursor Bugbot,
cubic, GitHub Copilot, OpenAI Codex, Gemini Code Assist, Qodo (7 install
identities merged), FullSend, Claude, Macroscope, Greptile. Excluded from the AI
set and reported separately: `github-advanced-security`, `github-actions`,
Sentry's bots, `clickhouse-gh`, DeepSource, CodeScene, Aikido, gitStream,
`github-code-quality`.

---

## 1. Stale rate

`isOutdated` is true when the diff hunk the thread anchors to no longer exists in
the current head. Wilson 95% intervals throughout.

### Per bot

| Bot | n | stale % | 95% CI | resolved % | stale AND unresolved | 95% CI |
|---|---:|---:|---|---:|---:|---|
| CodeRabbit | 3,016 | 38.9% | 37.1–40.6 | 81.0% | **2.1%** | 1.6–2.6 |
| Cursor Bugbot | 1,932 | 29.8% | 27.8–31.9 | 78.4% | **0.7%** | 0.4–1.1 |
| cubic | 821 | 41.5% | 38.2–44.9 | 63.1% | 2.9% | 2.0–4.3 |
| GitHub Copilot | 789 | 40.8% | 37.4–44.3 | 63.4% | 8.5% | 6.7–10.6 |
| OpenAI Codex | 725 | 47.7% | 44.1–51.4 | 55.0% | 12.8% | 10.6–15.5 |
| Gemini Code Assist | 632 | 42.9% | 39.1–46.8 | 48.4% | **16.8%** | 14.1–19.9 |
| Qodo | 617 | 33.9% | 30.2–37.7 | 67.9% | 1.6% | 0.9–3.0 |
| FullSend | 466 | 24.2% | 20.6–28.3 | 56.0% | 12.2% | 9.6–15.5 |
| Claude | 388 | 36.1% | 31.5–41.0 | 70.6% | 7.0% | 4.8–9.9 |
| Macroscope | 268 | 48.5% | 42.6–54.5 | 69.8% | 9.3% | 6.4–13.4 |
| Greptile | 188 | 38.8% | 32.2–46.0 | 67.6% | 4.8% | 2.5–8.8 |

### Control

| Actor | n | stale % | 95% CI | resolved % | stale AND unresolved |
|---|---:|---:|---|---:|---:|
| All AI bots | 9,896 | **37.6%** | 36.6–38.5 | 70.6% | 5.0% |
| Humans | 2,442 | **62.3%** | 60.3–64.2 | 66.7% | 13.7% |
| Non-AI bots | 733 | 29.7% | 26.5–33.1 | 44.3% | 18.0% |

Humans go stale at **1.66x the bot rate**, and the intervals are nowhere near
each other. This is the opposite of the hypothesis that motivated the
measurement.

### The inversion survives every control I could apply

**(a) Within-PR paired.** Restricting to the 408 PRs that carry both a bot
thread and a human thread removes repo, project-culture and churn effects:

| | n | stale % | 95% CI |
|---|---:|---:|---|
| AI bots | 2,131 | 44.0% | 41.9–46.1 |
| Humans | 1,815 | 64.4% | 62.2–66.6 |

**(b) By position in the PR lifecycle.** A thread opened early has more time to
be invalidated. Bots comment near t=0, humans later, so this confound should
work *against* the bots — and it does not close the gap:

| Thread opened at | AI n | AI stale | Human n | Human stale |
|---|---:|---:|---:|---:|
| 0–10% of PR life | 5,117 | 42.3% | 376 | 65.2% |
| 10–33% | 1,705 | 37.2% | 451 | 64.1% |
| 33–66% | 1,183 | 34.9% | 655 | 70.2% |
| 66–100% | 1,891 | 26.8% | 960 | 54.9% |

**(c) By PR size.** Tests "staleness is about churn, not about bots". Churn
moves the bot number by 6 points at most, and never brings it near the human
line:

| Changed files | AI n | AI stale | Human n | Human stale |
|---|---:|---:|---:|---:|
| 1–2 | 1,579 | 33.1% | 256 | 64.8% |
| 3–9 | 3,339 | 39.2% | 864 | 61.9% |
| 10–29 | 3,061 | 39.8% | 827 | 61.5% |
| 30+ | 1,917 | 34.8% | 495 | 62.8% |

**(d) By PR state.** Open PRs have not finished accruing staleness:

| State | AI n | AI stale | Human n | Human stale |
|---|---:|---:|---:|---:|
| OPEN | 2,689 | 35.5% | 734 | 54.8% |
| MERGED | 6,103 | 40.7% | 1,648 | 66.0% |
| CLOSED | 1,104 | 25.4% | 60 | 53.3% |

**(e) Clustering.** Across the 33 repos with ≥100 bot threads the per-repo bot
stale rate runs 17.6% (redhat-appstudio/infra-deployments) to 58.6%
(dimagi/open-chat-studio), median 40.1%. The pooled figure is not one repo
dragging the rest.

### Reading it

`isOutdated` marks a comment whose code was subsequently rewritten. For a human
reviewer that is usually the review *working*: they asked for a change and got
one. For a bot commenting seconds after a push on code nobody revisits, the
anchor survives. Staleness measures how much the code moved after the comment
landed, and human comments move code more often than bot comments do. Reading
high staleness as waste has the sign backwards.

### The number that actually matters, and it is small

Stale **and** never resolved — the thread that went obsolete and that nobody
even dismissed — is **5.0% of bot threads (n=9,896, CI 4.6–5.4)**. Per bot it
ranges from 0.7% (Cursor Bugbot) to 16.8% (Gemini Code Assist). For the two
highest-volume bots, CodeRabbit and Cursor Bugbot, it is 2.1% and 0.7%.

At 5% of threads, a filter that removed every one of them perfectly would remove
about one comment in twenty. **State plainly: this is too small to be the
product.** It is a feature at best, and only for the three bots above 10%
(Gemini Code Assist, Codex, FullSend) — which together are 18% of the corpus.

---

## 2. Duplicate rate between different bots

586 of the 2,309 AI-reviewed PRs (25.4%) carry threads from two or more distinct
AI bots. Those PRs hold 4,768 bot threads.

**Mechanical overlap** — two different bots, same PR, same file, anchors within
3 lines:

- 636 colliding pairs
- 1,004 of 4,768 threads sit in at least one collision = **21.1%** (CI 19.9–22.2) of threads on multi-bot PRs
- as a share of all 9,896 bot threads: **10.15%** (CI 9.57–10.76)

Most frequent colliding pairs: FullSend × Qodo (101), CodeRabbit × Copilot (58),
Cursor × cubic (56), Claude × Codex (54), Cursor × Codex (52).

**Hand-judged** — I sampled 20 collisions, one from each of the 20 most common
bot-pairs, read both comment bodies in full, and judged whether they describe the
same defect. Judgments with reasons are in
[docs/data/judgments.json](data/judgments.json); every collision links to its
`discussion_r…` permalink in [docs/data/collision_sample.json](data/collision_sample.json).

| Verdict | Count |
|---|---:|
| Same defect | 11 |
| Same code, different consequence and different fix | 1 |
| Different defects that merely sit on the same lines | 8 |

Strict true-duplicate share of collisions: **55%** (CI 34.2–74.2, n=20).

**Corrected duplicate rate** = mechanical × hand-judged:

- of threads on multi-bot PRs: **11.6%** (CI 7.2–15.6)
- of all bot threads: **5.6%** (CI 3.5–7.5)

The two numbers really are different, as expected. Nearly half of mechanical
collisions are not duplicates at all — colocation on a line is weak evidence.
Two examples of the failure mode:

- `prime-agent#1495` line 1523: Cursor Bugbot reports an unbounded `control.send`
  that can hang shutdown; Macroscope reports `SIGTERM` orphaning ipykernel
  children. Same function, two real and distinct bugs.
- `ray#65578` line 57: Gemini Code Assist suggests extracting a local and using
  an f-string; Cursor Bugbot reports that the new build-arg is never declared in
  the Dockerfile. One is style, one is a real bug.

And a clean true duplicate, for contrast — `carmenta#758` line 133, where Codex
and Cursor Bugbot independently report that `getDataParts` filtering on
`type === "data"` breaks `data-*` parts, both citing the same call sites.

Caveat that limits this number: n=20 gives a 40-point interval on the 55%. The
mechanical rate is precise; the correction factor is not.

---

## 3. Threads per PR, per bot

Denominator is PRs that bot actually commented on, so this is conditional volume,
not an average over all PRs.

| Bot | PRs | threads | mean | median | p90 | max |
|---|---:|---:|---:|---:|---:|---:|
| cubic | 110 | 821 | **7.46** | 4 | 16 | 60 |
| FullSend | 85 | 466 | 5.48 | 3 | 10 | 54 |
| Macroscope | 57 | 268 | 4.70 | 3 | 9 | 26 |
| Claude | 110 | 388 | 3.53 | 2 | 9 | 29 |
| CodeRabbit | 897 | 3,016 | 3.36 | 2 | 7 | 40 |
| Cursor Bugbot | 585 | 1,932 | 3.30 | 2 | 7 | 57 |
| GitHub Copilot | 270 | 789 | 2.92 | 2 | 6 | 23 |
| Qodo | 216 | 617 | 2.86 | 2 | 6 | 28 |
| OpenAI Codex | 263 | 725 | 2.76 | 2 | 6 | 23 |
| Gemini Code Assist | 277 | 632 | 2.28 | 2 | 5 | 10 |
| **Greptile** | 121 | 188 | **1.55** | 1 | 3 | 10 |
| Humans (control) | 586 | 2,442 | 4.17 | 2 | 9 | 45 |

This closes the gap noted in the earlier research file: no primary source counted
this at scale for commercial tools.

Three things worth carrying:

1. **Every bot has a median of 2 or fewer threads per PR.** The "comment
   explosion" framing does not survive contact with the data. The mean is pulled
   up by a thin tail — cubic's 60-thread PR, Cursor's 57.
2. **Greptile is the quietest tool measured**, at 1.55 threads per PR and a
   median of 1. That matches its marketing claim of being "an agent of few
   words", on an independent sample. It is also the smallest sample here (n=188).
3. **Humans out-comment every bot except cubic**, at 4.17 threads per PR. The
   volume complaint is not supported by volume.

---

## 4. Who actually closes the thread (correction)

Second harvest, 2026-08-22, same 59 repos, now reading `ReviewThread.resolvedBy`.
n=8,986 bot threads — slightly below the first pass because the 100-most-recent
PR window had moved. Script: [analyze_assent.py](data/analyze_assent.py), data:
[threads2.jsonl.gz](data/threads2.jsonl.gz).

"Human assent" = the thread is resolved **and** a `User` account closed it,
and that account is not the bot itself.

| Bot | n | resolved % | human assent % | 95% CI | bot self-closed % |
|---|---:|---:|---:|---|---:|
| GitHub Copilot | 676 | 60.5% | **60.5%** | 56.8–64.1 | 0.0% |
| FullSend | 466 | 56.0% | **56.0%** | 51.5–60.4 | 0.0% |
| OpenAI Codex | 591 | 53.6% | **53.6%** | 49.6–57.6 | 0.0% |
| Gemini Code Assist | 629 | 48.3% | **48.3%** | 44.4–52.2 | 0.0% |
| cubic | 851 | 63.9% | 31.8% | 28.8–35.1 | 31.8% |
| CodeRabbit | 2,700 | 81.1% | 31.3% | 29.6–33.1 | **49.8%** |
| Qodo | 623 | 68.5% | 25.8% | 22.6–29.4 | 42.7% |
| Greptile | 140 | 70.0% | 22.1% | 16.1–29.7 | 47.9% |
| Cursor Bugbot | 1,909 | 78.4% | 20.6% | 18.8–22.5 | **57.4%** |
| Macroscope | 261 | 69.7% | 8.4% | 5.6–12.4 | **61.3%** |
| Humans (control) | 2,322 | 66.8% | 38.5% | 36.5–40.5 | n/a |

The ranking by `resolved %` and the ranking by human assent are close to
inverted. CodeRabbit and Cursor Bugbot look like the top two tools on the raw
column and fall to 6th and 9th on assent. Six of the ten tools ship auto-resolve;
four never close their own threads.

**What this does and does not prove.** It proves the raw resolution rate is
dominated by a product decision — whether the vendor ships auto-resolve — rather
than by comment quality. It does **not** prove that Cursor Bugbot's comments are
three times worse than Copilot's. Auto-resolve fires when the tool detects the
issue was fixed, which often means the developer *did* act and simply never
clicked resolve. So human assent undercounts the auto-resolving tools by an
unknown amount. The clean comparison is within the four tools that never
self-close: Copilot 60.5%, FullSend 56.0%, Codex 53.6%, Gemini 48.3%. Those four
are directly comparable to each other and to the 38.5% human control.

This confound reaches into the published literature. The Atlassian paper
(arXiv:2510.05450) defines resolution as "a subsequent commit modified the exact
line", which sidesteps it. The "Go Home Copilot" paper (arXiv:2607.21997) states
"we exclude resolutions performed solely by AI agents" — they handled it
correctly. My first pass did not. Any comparison built on raw `isResolved`
across tools, including the section 1 column above, is measuring auto-resolve.

---

## Sampling bias I could not remove

1. **Self-selection, and it is severe.** Every repo here chose to install a bot
   and chose to keep it. Teams that installed one and ripped it out are invisible
   by construction. All three measurements are therefore best-case: measured on
   the tolerant end of the population.
2. **Recency.** The 100 most recent PRs per repo. Open PRs have not finished
   accruing staleness, which biases the stale rate down; control (d) quantifies
   it at roughly 5 points between OPEN and MERGED.
3. ~~**Survivor bias in resolution.** `isResolved` can be set by a human, by the
   bot itself on re-review, or by an auto-resolve integration. I cannot separate
   those from the API.~~ **Resolved: `resolvedBy` does expose this, and the
   effect was large.** See [section 4](#4-who-actually-closes-the-thread-correction).
   The residual bias is that human assent undercounts auto-resolving tools.
4. **Repo-size skew.** Discovery ranked by PR count, so large mature projects are
   over-represented. Top 3 repos are 18.3% of bot threads.
5. **Language skew.** TypeScript, JavaScript, Ruby and Go dominate. No systematic
   coverage of Java, C++ or Python-heavy repos beyond a handful.
6. **Login-based classification.** A bot posting under a plain user account is
   miscounted as human. I checked the unclassified logins and none were AI
   reviewers, but the method cannot prove a negative.
7. **cubic and Greptile are thin.** 821 and 188 threads, from 3 and 6 repos.
   Their per-bot rows are directional, not solid.
8. **The duplicate correction rests on n=20.** Widening it is the cheapest way to
   tighten the weakest number in this document.

---

## What this says about what to build

The filter as scoped targets 5.0% of bot threads (stale and unresolved) plus
5.6% genuine cross-bot duplicates. Even assuming no overlap between those two
sets and a perfect classifier, the ceiling is around one comment in ten, and the
two highest-volume bots contribute almost none of the first bucket.

The measurement does surface a real and larger signal, and section 4 sharpened
it. Across the four tools that never auto-resolve, human assent runs 48.3% to
60.5%, against a 38.5% human-reviewer control — bots in that group get their
comments acted on *more* often than human reviewers do. Meanwhile the number
every vendor could quote, raw resolution rate, spans 48.3% to 81.1% and is
mostly a readout of whether they ship auto-resolve.

That is the asset here. There is no independent, per-tool, precision-and-recall
benchmark of these products (established separately in
[ai-pr-review-pain-points.md](ai-pr-review-pain-points.md) §4). What this rig
can produce instead — per-tool human assent, comment volume, and stale-and-
abandoned rate, computed from the public API over any repo set, with the
auto-resolve confound removed — is closer to that gap than anything currently
published, vendor or academic.
