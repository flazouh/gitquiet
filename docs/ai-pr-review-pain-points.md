# AI PR review tools: pain points from primary sources

Research date: 2026-08-18. Every quote below was read on the live page, not in a
search snippet. Network check passed first: news.ycombinator.com 200,
www.reddit.com 200, arxiv.org 200.

Marking: `[VENDOR]` = the number comes from a company selling the thing measured,
or from a first-party engineering blog. `[INDEPENDENT]` = academic or third party
with no product in the comparison.

---

## Ranked pain points

### 1. Signal-to-noise ratio, not bug-catch rate, is the complaint

This is the single most repeated theme across every source I read. It is not
"the tool misses bugs". It is "the tool buries the bug it found".

> "My experience with using AI tools for code review is that they do find
> critical bugs (from my retrospective analysis, maybe 80% of the time), but the
> signal to noise ratio is poor. It's really hard to get it not to tell you 20
> highly speculative reasons why the code is problematic along with the one
> critical error. And in almost all cases, sufficient human attention would also
> have identified the critical bug - so human attention is the primary
> bottleneck here. Thus poor signal to noise ratio isn't a side issue, it's one
> of the core issues."
> — zmmmmm, https://news.ycombinator.com/item?id=46771757

> "The main problem with current AI reviewers isn't catching bugs, it's shutting
> up when there is no bug. Humans have an intuitive filter like 'this code is
> weird, but it works and won't break prod, so I'll let it slide'. LLMs lack
> this, they generate 20 comments about variable naming and 1 comment about a
> critical race condition. As a result the developer gets fatigue and ignores
> everything."
> — veunes, https://news.ycombinator.com/item?id=46778298

> "I work at a company you all know and we've integrated our AI offering into
> our CICD process automatically - so all PRs get a slew of comments from the AI
> review tool. In aggregate its okay. I'd say 80% of the comments are usually
> lacking context, blatantly incorrect, or insignificant nitpicks at best."
> — u/SterlingAdmiral,
> https://reddit.com/r/ExperiencedDevs/comments/1o1a601/whats_your_honest_take_on_ai_code_review_tools/nifa48g/

> "If you get 10 comments per PR, you have to go through 10 comments, assess
> them and expect only 2 of them to be kind of useful."
> — u/BaNyaaNyaa,
> https://reddit.com/r/ExperiencedDevs/comments/1o1a601/whats_your_honest_take_on_ai_code_review_tools/nifu004/

The Greptile founder concedes the problem in the same thread:

> "The signal-to-noise ratio problem is unexpectedly difficult. ... - different
> people have different ideas of what a nitpick is - it's not a spectrum, the
> differences are qualitative - LLMs are reluctant to risk downplaying the
> severity of an issue and therefore are unable to usefully filter out nits -
> theory: they are paid by the token and so they say more stuff"
> — dakshgupta (Greptile co-founder),
> https://news.ycombinator.com/item?id=46776408 `[VENDOR]`

**Hard numbers on the noise:**

`[INDEPENDENT]` Chowdhury et al., MSR '26, arXiv:2604.03196: 3,109 PRs from the
AIDev dataset. Of the 98 closed CRA-only PRs, "59 PRs (60.2%) fall into the
0-30% signal range". And: "Critically, 12 of 13 CRAs (92.31%) exhibit average
signal ratios below 60%." Per-bot: "Copilot achieves only a 19.79% average
signal ratio, while github-advanced-security[bot] achieves 27.62%. ...
codefactor-io[bot] at 0.00%". https://arxiv.org/abs/2604.03196

Caveat the authors state themselves: the signal ratio is keyword-based plus open
coding, on 98 PRs. "Our keyword-based signal-to-noise classification may miss
actionable feedback without keywords".

`[VENDOR]` CodeRabbit ships the problem as a config knob. Its own docs:
"Set the review profile: quiet for only the most important feedback, chill for
balanced feedback, assertive for more feedback (which may feel nitpicky)."
Default is `chill`. https://docs.coderabbit.ai/reference/configuration

---

### 2. Re-review churn: fixing comments produces new comments

Confirmed at the source, with real counts. GitHub discussion #189767, opened by
mbenzakis on 2026-03-16, still **Unanswered**, 4 comments and 2 replies.

> "When Copilot Code Review is enabled on a repository, every push to a PR
> triggers a full re-scan of the diff. This means that after fixing Copilot's
> comments and pushing, Copilot generates **new** comments on code that was
> already in the previous diff but wasn't flagged before."

His table for PR A, verbatim:

| Round | Push | New Copilot comments | Action |
|---|---|---|---|
| 1 | Initial PR | 10 comments | Fixed all 10, pushed |
| 2 | Fix push | 6 new comments | Fixed all 6, pushed |
| 3 | Fix push | 4 new comments | Fixed all 4, pushed |
| 4 | Fix push | 2 new comments | Fixed both, pushed |
| 5 | Fix push | 2 more new comments | Gave up |

> "Total: 5 rounds of review for a single PR. Each round took 15-30 minutes."

> "Out of ~24 total comments across all rounds: ~3 were genuinely useful (e.g.,
> UnboundLocalError due to uninitialized variable, missing function arguments
> causing crash) ~21 were low-value"

> "The severity labels (Medium/High) don't accurately reflect actual impact. A
> comment about error message wording gets 'Medium' while a real crash bug also
> gets 'Medium'."

Three other users confirm in the same thread:

> "Exactly same experience. Why can't copilot generates all comments at once?"
> — luqiang21, 2026-06-15

> "Endless loop...If not in one attempt, then two to three should be enough. It
> is endless." — mishra-punit, 2026-06-17

> "Looking forward for the change - it is counter-productive and our developers
> spend unnecessary time because of copilot's review over again on the same
> lines of code. It's major drawback for us." — ernestasdoingcode, 2026-06-18

Source: https://github.com/orgs/community/discussions/189767

Non-determinism is the same problem seen from another angle:

> "For one, it's non deterministic, so you end up with half a dozen commits,
> with each run noting different issues."
> — vimda on Cursor Bugbot, https://news.ycombinator.com/item?id=46770047

---

### 3. Missing context is the mechanism behind the noise

Developers do not describe the failures as random. They describe a tool that
cannot see the invariant, the schema, or the prior decision.

> "I find a lot of times with co-pilot it calls out issues where if the AI had
> more context of the whole codebase it would realize that scenario can't
> actually occur. Or it won't understand some invariant that you know but is not
> explicit anywhere"
> — ex-aws-dude, https://news.ycombinator.com/item?id=46774429

> "at least 75% of its comments are off base in some way. Often not _wildly_
> wrong, just lacking context. An example from earlier today was it not knowing
> that Flyway runs SQL migration scripts in transactions, so it commented that
> two of the statements in one of my scripts needed to be wrapped in a
> transaction."
> — u/koreth on Graphite Reviewer,
> https://reddit.com/r/ExperiencedDevs/comments/1grd2d9/whats_your_experience_with_aibased_code_review/lx5jwf3/

> "It also regularly complains about things that are possible in theory but
> impossible in practice, so we've gotten used to just resolving those comments
> without any action."
> — The_Fox on CodeRabbit, https://news.ycombinator.com/item?id=46771089

`[INDEPENDENT]` Cynthia et al., arXiv:2607.21997 card-sorted 470 unresolved
comment discussions. The two largest categories are *Intentional Design
Decision* (112 discussions) and *Incorrect Suggestion* (67, of which 63 are
"Factually Wrong or False Positive"). Verbatim developer replies quoted in the
paper:

> "False positive - the initial message already says '1 commit, 1 workflow'
> (singular)."

> "No, the idea is to use add logs to the docker stream."

> "Comment is not helpful"

> "No it isn't, go home copilot you're drunk"

The last one gave the paper its title. Source: https://arxiv.org/abs/2607.21997

---

### 4. No independent benchmark measures catch rate *and* false-positive rate for the named products

**This is a finding, and it is the most important one in this document.**

I looked for a benchmark that (a) is not run by a vendor in the comparison and
(b) reports both recall and precision for Greptile / CodeRabbit / Bugbot /
Copilot / Qodo / Graphite / cubic. It does not exist as of 2026-08-18. Here is
what does exist, and why each one falls short.

**Greptile's own benchmark** `[VENDOR]`, https://www.greptile.com/benchmarks

Numbers are real and reproducible: 50 bugs, 5 repos, July 2025, default
settings. Overall catch rate: Greptile 82%, Bugbot 58%, Copilot 54%, CodeRabbit
44%, Graphite 6%.

The page then says, in its own methodology section:

> "Scoring considered only detection of the original bug; **false positives,
> style suggestions, and unrelated comments did not affect the catch rate.**"

So your prior was right, and stronger than you framed it. This is not merely
"recall only, not precision". The vendor states in writing that false positives
were excluded from scoring. I found **no** false-positive counts anywhere on
greptile.com/benchmarks or greptile.com/greptile-vs-coderabbit. The "~11 false
positives per run vs CodeRabbit's 2" figure is **not on Greptile's pages**. I
could not locate its source. Treat it as unsupported.

**AIMultiple RevEval**, https://research.aimultiple.com/ai-code-review-tools/

The closest thing to third party. 309 PRs, 7 large repos plus 8 MCP servers,
November 2025 product versions, GPT-5 as judge plus 10 developers on 35 PRs.
Results: CodeRabbit 80.3, Greptile 69.5, GitHub Copilot 69.1, Cursor Bugbot
62.3. Ranked #1 on: CodeRabbit 50.8%, Greptile 22.3%, Copilot 17.8%, Bugbot
9.1%.

This is the source of the "reversed" ranking you remembered. The actual figures
are 80.3 and 69.5, not 82 and 76.

Independence caveats you should carry: AIMultiple is a vendor-facing analyst
business that runs lead generation on the same page ("Get our team to automate
one of your business processes with AI agents"). Two of the ten evaluators are
AIMultiple staff. No sponsorship disclosure appears on the page. It is *more*
independent than Greptile's, not independent.

One AIMultiple conclusion cuts directly against the received wisdom:

> "In our evaluation, the most significant concern was false negatives. The
> tools were more likely to overlook important issues than to raise incorrect
> warnings."

**c-CRAB**, NUS, arXiv:2603.23448 `[INDEPENDENT]` — the strongest academic
benchmark, but it does not test the commercial PR bots you asked about. It tests
Claude Code, Codex, Devin Review and PR-Agent on 184 PR instances.

| Reviewer | Total comments | Avg/PR | Overall pass rate |
|---|---|---|---|
| Claude Code | 1336 | 7.3 | 32.1% |
| Codex | 324 | 1.8 | 20.1% |
| Devin | 1344 | 7.3 | 24.8% |
| PR-Agent | 524 | 2.8 | 23.1% |
| Human | 234 | 1.3 | 100% (by construction) |

> "Considering the union across all four tools, 97 out of the 234 tests were
> passed by at least one tool (41.5%)"

Note the volume column: the bots leave 1.4x to 5.6x more comments per PR than
the humans whose concerns define the tests.

**CR-Bench**, Nutanix, arXiv:2603.11078 `[INDEPENDENT]` of the review-tool
market — reports precision, recall and signal-to-noise, but only for two generic
agent scaffolds (single-shot and Reflexion) over GPT-5.2 and GPT-5-mini, not for
any commercial product. Its finding is the trade-off itself: pushing recall from
27.01% to 32.76% dropped SNR from 5.11 to 1.95.

**Uber uReview** `[VENDOR, first-party]`,
https://www.uber.com/en-US/blog/ureview/, published 2025-08-12. Your figures are
verbatim correct:

> "Engineers who interact with the tool mark 75% of its comments as useful, and
> we see over 65% of its posted comments addressed."

> "This performance significantly exceeds that of human reviewers. Internal
> audits show that only 51% of human-written comments are considered as bugs by
> the author and addressed in the same changeset."

Two caveats the post itself supplies. The address rate is measured by re-running
uReview five times on the final commit and checking whether it repeats itself,
not by asking a human. And usefulness is rated by "engineers who interact with
the tool", which is a self-selected group. Uber's own read on the competition:

> "our evaluation of third-party tools on Uber code showed that they suffered
> from three main issues: many false positives, low-value true positives, and
> being unable to interact with internal systems at Uber"

---

### 5. Confidence scores and severity labels are actively harmful when wrong

> "Also the 'confidence' score added to each PR being 4/5 or something due to
> these irrelevant comments was a really annoying feature IMO. In general AI
> tools giving a rating when they're wrong feels like a big productivity loss as
> then the human reviewer will see that number and think something is wrong with
> the PR."
> — sebra, https://news.ycombinator.com/item?id=46777079

Same complaint from the Copilot discussion (see #2): equal severity for a
wording nit and a crash.

---

### 6. Nitpick and blocker are not distinguished, so nothing can be triaged

> "Human comments tend to be short and sweet like 'nit: rename creatorOfWidgets
> to widgetFactory'. Whereas AI code review comments are long winded not as
> precise. So even if there are 20 humans comments, I can easily see which are
> important and which aren't."
> — xmprt, https://news.ycombinator.com/item?id=46773031

> "A nitpick is stuff like 'these two if branches that you've explicitly kept
> separate should be merged into a single conditional statement' which is the
> sort of thing it likes to do all the time"
> — u/Ok_Individual_5050,
> https://reddit.com/r/ExperiencedDevs/comments/1r0iepg/handling_ai_code_reviews_from_juniors/o4kugu7/

`[INDEPENDENT]` The research agrees on what makes a comment survive.
arXiv:2607.21997: "comments with inline code suggestions achieve a substantially
higher resolution rate (75.5%) compared to those without suggestions (64.5%)",
and length hurts: non-accepted comments average 807.1 characters against 616.6
for useful ones. Logistic regression: code suggestion OR = 1.617, log comment
length OR = 0.926.

Uber reached the same conclusion from production:

> "Developers Don't Like Readability and Stylistic Comments ... Readability
> nits, minor logging tweaks, low-impact performance optimizations, and
> stylistic issues consistently received poor ratings."

---

### 7. Review is the bottleneck, and AI PRs sit in it longest

`[VENDOR]` LinearB 2025 Software Engineering Benchmarks Report, 8.1M+ PRs from
4,800 teams across 42 countries. https://linearb.io/resources/engineering-benchmarks

> "AI PRs wait 4.6x longer before review – but are reviewed 2x faster once
> picked up."

> "Acceptance Rates for AI-generated PRs are significantly lower than manual PRs
> (32.7% vs. 84.4%)."

> "Agentic AI PRs have a PR PIckup Time 5.3x longer than Unassisted ones."

`[INDEPENDENT]` The merge-outcome version, arXiv:2604.03196: "CRA-only reviewed
PRs achieve a 45.20% merge rate, 23.17 percentage points lower than human-only
PRs (68.37%), with significantly higher abandonment (34.88% vs 21.60%). This
difference is statistically significant (χ²=83.0319, p<0.001)."

---

### 8. AI reviewing AI reads as theatre to a large part of the audience

> "No shit. What is the point of using an llm model to review code produced by
> an llm model? Code review pressupose a different perspective, which no
> platform can offer at the moment because they are just as sophisticated as the
> model they wrap."
> — heliumtera, https://news.ycombinator.com/item?id=46770727

> "Independence is ridiculous - the underlying llm models are too similar on
> their training days and methodologies to be anything like independent."
> — sdenton4, https://news.ycombinator.com/item?id=46769939

Greptile's founder was asked for evidence for the independence claim and did not
supply any in the thread:

> "Is there empirical evidence for that? Where is it on an epistemic meter
> between (1) 'it sounds good when I say it', and (10) 'someone ran evaluation
> and got significant support.'"
> — liamconnell, https://news.ycombinator.com/item?id=46769887

The same founder posted "in the last 7 days, the authors of a PR has replied to
a Greptile comment with 'great catch', 'good catch', etc. 9,078 times"
(https://news.ycombinator.com/item?id=46769868), and got taken apart for it:

> "a figure like that is data, not evidence. At the very minimum you need
> context which allows for interpretation; 9,078 positive author comments would
> be less impressive if Greptile made 1,000,000 comments in that time period"
> — tadfisher, https://news.ycombinator.com/item?id=46770023

> "You need to contrast false positive rate with true positive rate to simply
> plot a single point along a classifier curve."
> — BlackFly, https://news.ycombinator.com/item?id=46779654

---

### 9. Buying the tool is contested: people say the frontier model already does this

> "It's very unlikely that any of these tools are getting better results than
> simply prompting verbatim 'review these code changes' in your branch with the
> SOTA model du jour."
> — roncesvalles, https://news.ycombinator.com/item?id=46774886

> "Opus 4.5 catches all sorts of things a linter would not, and with little
> manual prompting at that. ... I don't see the point of paying for yet another
> CI integration doing LLM code review."
> — gherkinnn, https://news.ycombinator.com/item?id=46770484

> "As Claude Code (and Opus) improves, Greptile is finding fewer issues in my
> code reviews."
> — seanmccann, https://news.ycombinator.com/item?id=46770566

---

### 10. Social cost: bot comments get used as a shield, and switching cost is political

> "One thing I have noticed is that juniors often use AI comments as a shield.
> If they aren't confident enough to push back on a senior's code directly, they
> just forward whatever the tool says instead of saying 'I think this might break
> if X.'"
> — u/aviboy2006,
> https://reddit.com/r/ExperiencedDevs/comments/1r0iepg/handling_ai_code_reviews_from_juniors/o4kk72o/

> "I've used the copilot review and I wish we would turn it off. It generates
> work and rarely catches something worth caring about even a little. Trash, I
> would pay money to not have it shit my PRs up."
> — u/Orca-,
> https://reddit.com/r/ExperiencedDevs/comments/1grd2d9/whats_your_experience_with_aibased_code_review/lx5fo7i/

He cannot turn it off:

> "I can ignore the suggestions but it's default on for PR feedback. I haven't
> felt like incurring the political hit for pushing back on that."
> — u/Orca-,
> https://reddit.com/r/ExperiencedDevs/comments/1grd2d9/whats_your_experience_with_aibased_code_review/lxdgwt5/

Teams do disable it:

> "We ended up disabling it on our codebase."
> — deleted user,
> https://reddit.com/r/ExperiencedDevs/comments/1grd2d9/whats_your_experience_with_aibased_code_review/lx69zha/

> "We have Code Rabbit at work, and it's made PRs unreadable. The Bun pollutes
> the comments and code diffs with noise."
> — the__alchemist, https://news.ycombinator.com/item?id=46772357

---

### 11. Trial abandonment and reliability, tool by tool

Greptile lost a paid evaluation on behaviour, not on catch rate:

> "My company just finished a several week review period of Greptile. Devs were
> split over the usefulness of the tool (compared to our current solution,
> Cursor). While Greptile did occasionally offer better insights than Cursor, it
> also exhibited strange behavior such as entirely overwriting PR descriptions
> with its own text and occasionally arguing with itself in the comments. In the
> end we decided to NOT purchase Greptile"
> — disillusionist, https://news.ycombinator.com/item?id=46770441

> "We used Greptile where I work and it was so bad we decided to switch to
> Claude." — kaishin, https://news.ycombinator.com/item?id=46770850

> "I had a bad experience with greptile due to what seemed to be excessive noise
> and nit comments." — iblaine, https://news.ycombinator.com/item?id=46775082

CodeRabbit is praised more often than Greptile in this thread, but broke:

> "Unfortunately our entire Coderabbit integration just stopped working one day
> and since then we've been in a long back and forth with their support."
> — sebra, https://news.ycombinator.com/item?id=46777079

CodeRabbit support replied publicly in-thread and resolved it:

> "I am a member of the CodeRabbit tech support team, would you be able to
> provide me the ticket number you have open with us?"
> — Dylan-CodeRab, https://news.ycombinator.com/item?id=46781884

> "Thanks Dylan. Turns out my colleague actually had a teams call with you
> yesterday and the issue was confirmed and prioritised on your end. You have a
> great product."
> — sebra, https://news.ycombinator.com/item?id=46782645

Greptile was also told to answer its own channels:

> "I would suggest you check out your Greptile discord and/or answer your
> messages on X where people are trying to reach you with problems and questions
> about your service. Unless that no longer matters."
> — las3r, https://news.ycombinator.com/item?id=46776114

---

## Claim audit

| Claim as given | Verdict | What the page actually says |
|---|---|---|
| False positives are the #1 complaint | **Confirmed** as the dominant *developer* complaint, in every source | See §1. But AIMultiple's benchmark found the opposite failure mode dominant under test: "the most significant concern was false negatives" |
| 70–90% of AI comments dismissed | **Partly supported, source-dependent** | Practitioner claim of 80% off-base (u/SterlingAdmiral). Independent addressing rate is far worse: 0.9%–19.2% (arXiv:2508.18771). Atlassian reports 60–70% unresolved. arXiv:2607.21997 reports the *opposite*: 72.9% resolved for Copilot |
| Teams seeing 200–400 comments/week | **Not found** | No primary source located. Nearest real figures: 7.3 comments per PR (c-CRAB), 24 comments over 5 rounds on one PR (GH #189767) |
| Greptile 82% catch, CodeRabbit 44% | **Confirmed verbatim** `[VENDOR]` | greptile.com/benchmarks. Also Bugbot 58%, Copilot 54%, Graphite 6% |
| Greptile ~11 FPs, CodeRabbit 2 FPs | **Unsupported** | No false-positive counts exist anywhere on Greptile's benchmark or comparison pages |
| Greptile's benchmark measures recall only | **Confirmed, and stated by Greptile** | "false positives, style suggestions, and unrelated comments did not affect the catch rate" |
| Other sources cite CodeRabbit 82%, Greptile 76% | **Close, numbers wrong** | AIMultiple RevEval: CodeRabbit 80.3, Greptile 69.5, Copilot 69.1, Bugbot 62.3 |
| Any independent benchmark exists | **No** | Nothing independent covers both catch rate and FP rate for these products. See §4 |
| CodeRabbit leaves the most comments per PR | **Not verified** | No primary source found that counts comments per PR by tool. Comment-volume data exists only for Claude Code / Codex / Devin / PR-Agent (c-CRAB) |
| CodeRabbit ~28% noise | **Not found** | No primary source |
| CodeRabbit shipped a "Quiet" profile | **Confirmed** `[VENDOR]` | docs.coderabbit.ai/reference/configuration: "quiet for only the most important feedback ... assertive for more feedback (which may feel nitpicky)" |
| Copilot regenerates comments every push | **Confirmed with counts** | GH discussion #189767, 10→6→4→2→2 over 5 rounds, ~3 of ~24 useful, still Unanswered |
| AI adoption 16.6% vs 56.5% human | **Numbers wrong, direction right** | arXiv:2508.18771 (22,000+ comments, 16 tools, 178 repos): AI 0.9%–19.2% addressed vs human 60%. Best tool was coderabbitai/ai-pr-reviewer at 19.2% |
| 12 of 13 agents below 60% actionable | **Confirmed, metric mislabelled** | arXiv:2604.03196. It is *signal ratio*, keyword-based, on 98 closed PRs. Not "actionable comments" |
| Uber uReview 75% / 65% / 51% | **Confirmed verbatim** `[VENDOR]` | uber.com/en-US/blog/ureview/. Note self-measurement caveats in §4 |
| AI PRs wait 4.6x longer | **Confirmed verbatim** `[VENDOR]` | LinearB, 8.1M+ PRs, 4,800 teams |
| Devs merge 98% more PRs; review time up 91% | **Not verified at source** | Widely repeated in aggregator blogs; I did not find it on a primary page |
| 85% of teams call review the top bottleneck | **Not verified at source** | Same |
| HN 46777079 is a thread | **Wrong shape** | It is a single comment by sebra inside https://news.ycombinator.com/item?id=46766961, "There is an AI code review bubble", greptile.com, 351 points, 248 comments, 2026-01-26 |
| HN 46301887 is the Greptile founder's comment | **Confirmed** | It is his intro to Greptile's State of AI Coding report, not about review quality |
| arXiv 2607.21997: 54,713 comments, 341 repos | **Confirmed** | 54,791 collected across 342 repos; 54,713 across 341 after dropping Claude (28 comments) and Devin (50) for low n |

---

## Corrections you should carry forward

**The "Copilot 72.9%" number means the opposite of what the framing implies.**
The abstract of arXiv:2607.21997 says Copilot accounts for "the majority of
resolved comments (72.9%)". The body says plainly: "Copilot dominates and
achieves the highest resolution rate (72.9%)".

| Agent | Comments | Resolved | Resolution rate |
|---|---|---|---|
| Copilot | 45,668 | 33,265 | 72.9% |
| Cursor | 6,778 | 4,554 | 67.2% |
| Codex | 2,267 | 1,242 | 54.8% |

Codex and Cursor concentrate on functional defects, and there their resolution
is higher still: Codex 1100/1242 (88.6%), Cursor 4006/4554 (88%).

The authors flag the catch themselves: "resolution is an imperfect proxy, as
comments may be resolved without being useful or remain unresolved despite being
valuable." A GitHub thread can be marked resolved by anyone, for any reason. That
is why this paper's 72.9% and Gan/Sun's 0.9–19.2% can both be true; they measure
different things. Gan/Sun require a code change on the commented line.

**Atlassian's paper is vendor-adjacent, not neutral.** arXiv:2510.05450 is
authored mostly by Atlassian staff and evaluates Atlassian's own RovoDev Agent
(Claude 3.5 Sonnet) on 4,000 comments across 1,007 internal repositories.
Resolution by type: readability 43.3% (586/1,354), bugs 41.9% (399/952),
maintainability 36.2% (483/1,333), design 28.6%. Their own summary: "many of the
LLM-generated comments are not resolved by developers (60%-70%)." Resolution is
defined as "a subsequent commit modified the exact line where the comment was
placed". The paper carries an explicit disclaimer that it is not an assessment of
Atlassian products.

---

## What nobody has measured

1. Precision and recall for the same commercial tool, from a party that does not
   sell one of them.
2. Comments per PR by tool, at scale.
3. Whether comment volume causes the higher abandonment in arXiv:2604.03196, or
   merely correlates with it. The authors say so: "correlation does not imply
   causation."
4. Anything on Qodo or cubic beyond a single positive HN mention of cubic
   (sastraxi, https://news.ycombinator.com/item?id=46769826) and its founder
   replying (pomarie, https://news.ycombinator.com/item?id=46769920).

---

## Sources read in full

- HN 46766961 "There is an AI code review bubble", 248 comments —
  https://news.ycombinator.com/item?id=46766961
- HN 46301887 Greptile State of AI Coding thread —
  https://news.ycombinator.com/item?id=46301887
- GitHub community discussion #189767 —
  https://github.com/orgs/community/discussions/189767
- arXiv:2607.21997 "Go Home Copilot, You're Drunk"
- arXiv:2510.05450 Goldman et al. (Atlassian)
- arXiv:2604.03196 Chowdhury et al. (MSR '26)
- arXiv:2508.18771 Gan/Sun et al.
- arXiv:2603.23448 c-CRAB (NUS)
- arXiv:2603.11078 CR-Bench (Nutanix)
- greptile.com/benchmarks, greptile.com/greptile-vs-coderabbit
- docs.coderabbit.ai/reference/configuration
- uber.com/en-US/blog/ureview/
- research.aimultiple.com/ai-code-review-tools/
- linearb.io/resources/engineering-benchmarks
- r/ExperiencedDevs threads 1o1a601, 1grd2d9, 1q525yn, 1r0iepg
- r/devops threads 1onfv66, 1qntnva
