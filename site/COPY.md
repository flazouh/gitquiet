# Landing page copy

Rewritten 2026-08-16. Three things changed it: the first Court is `Needs You`
now, the speed claim finally has measurements behind it, and the hero was three
times longer than any comparable site's.

## What the measurements say about length

Hero copy, read off the live pages on 2026-08-16:

| Site | Headline | Subhead | Whole page |
| --- | --- | --- | --- |
| Raycast | 4 words | 15 words | 1625 words |
| Zed | 4 words | 15 words | 2084 words |
| Warp | 6 words | 19 words | 806 words |
| Graphite | 6 words | 14 words | 609 words |
| CodeRabbit | 8 words | 10 words | 3166 words |
| **GitQuiet, before** | **4 words** | **44 words** | **~870 words** |

The headline was already the right length. The subhead was two to four times
everyone else's, and the page argued rather than showed. Whole-page length is
not the problem: CodeRabbit runs to 3166 words. The hero is.

Rule taken from that table and applied below: **headline 4 to 6 words, subhead
16 words or fewer, one idea per section.**

---

## 1. Hero

**Skip link:** Skip to the screens

**Nav:** gitquiet · Add to Chrome

**Headline**

> A faster, quieter GitHub.

**Subhead** (16 words)

> Redraws fourteen pages on github.com so you can see what needs you. Opens a
> pull request in 287ms.

**Primary button:** Add to Chrome

**Under the button:** Chrome and Edge. No account, no server.
Also for Safari, or as a macOS app.

**Trust line**

> Your code and reviews stay in your browser. Your teammates see your reviews
> and comments exactly as before, whether they installed it or not.
> [Read the privacy policy.](#)

Cut from the old hero: "GitQuiet is a browser extension for GitHub pull request
review", and "from a pull request to a failing Actions run", and the four-way
list of who acts next. The first is a category label the reader can see from the
button. The second is detail. The third is the mechanism, and it now has its own
section below.

---

## 2. The Working Set

No copy. The live screen carries it. The four group headings are the only words
on it, and they are the product's own:

**Needs You** · **Waiting** · **Running** · **Settled**

---

## 3. Speed *(new section)*

**Eyebrow:** Measured on microsoft/vscode, August 2026

**Heading**

> Two seconds, or a fifth of one.

**Body**

> Rest on a row for a moment and GitQuiet has already read the pull request
> ahead. Press it and the page is there in 287ms. GitHub is still showing you
> the list you clicked away from, and it stays there for two seconds.

**The numbers, as a pair**

| | GitHub | GitQuiet |
| --- | --- | --- |
| The page you pressed, readable | 2050ms | 287ms |
| Pressed with no pause first | 2138ms | 1635ms |

**Caption under the table**

> The gap is the reading-ahead. Press without pausing and GitQuiet saves you
> about half a second, not two. Both numbers are medians of four, signed in,
> reproducible with `scripts/benchmark-click-flow.js`.

Put the race video here. It shows exactly this and needs no further words.

---

## 4. The idea

**Eyebrow:** The idea

**Heading** (was "Is it my turn?")

> Does this one need me?

**Body** (was 5 sentences, now 3)

> A review thread waiting on your reply. A failing check. A file that changed
> since you read it. GitHub shows those in five different places, and not one of
> them says whether it is yours to move. Here they are one list, in four groups.

**The four groups**

| Group | Means |
| --- | --- |
| **Needs You** | You can act on it now. |
| **Waiting** | Someone else has to act. |
| **Running** | A machine is working. Nothing to do but wait. |
| **Settled** | Finished. |

Changed: `Your Move` is `Needs You`. The module is called Courts, after the ball
being in someone's court, and `Your Move` was a chess word inside a tennis
metaphor. It was also the only two-word name in a set built on one-word names.
`Needs You` says what the group is for instead of naming the mechanism, and it
still means something in the desktop app, where there is no github.com in sight.

Also cut: "A comment from a bot" and "A branch that needs the latest main" from
the opening list. Five examples is a paragraph. Three is a point.

---

## 5. Four complaints

**Eyebrow:** Public threads, read August 2026

**Heading**

> Four complaints, and the answer to each.

Keep all four verbatim. They are quotations with counts attached and they are the
most persuasive thing on the page. No changes.

---

## 6. Against Refined GitHub

**Eyebrow:** The comparison

**Heading**

> What about Refined GitHub?

**Body** (was 3 sentences, now 2)

> Refined GitHub fixes hundreds of small annoyances on GitHub's own pages, and
> 100,000 people use it. The two extensions differ in where they start.

| | Refined GitHub | GitQuiet |
| --- | --- | --- |
| The approach | Improves the pages GitHub drew, one annoyance at a time. | Redraws fourteen pages on github.com itself. |
| A pull request | Conversation and Files changed stay separate tabs. | One screen. No tabs. |
| A comment on code that moved | Closed as not planned, under the label "impossible". | Stays visible, on the version of the code you wrote it about. |
| Your work across repositories | GitHub's own lists, improved. | One list, grouped by what needs you. |

**Note under the table** (was 2 sentences, now 2, tightened)

> The third row is the tracker's own verdict, and it is fair: keeping a comment
> on code that moved means fetching every comment in the pull request's history,
> which a tool that improves GitHub's page cannot reasonably do. GitQuiet draws
> that page itself, so the comment stays.

---

## 7. Every screen

**Eyebrow:** Every screen

**Heading**

> These are the real screens, not pictures of them.

Captions, unchanged except where marked:

1. **Sorted by what needs you** *(was "Sorted by whose move it is")*
   Every pull request you are in, from every repository, in one list.
2. **Everything still unresolved, above the diff**
   Review threads, failing checks, bot comments and the commits pushed since you
   last looked.
3. **A commit, read like a pull request**
   The file tree beside the code, and the next file one key away.
4. **One repository, grouped the same way**
   Seven pull requests that build on each other show as one row.
5. **An issue in the order you read it**
   What it is, then what was written, then what everybody said about it.
6. **Every issue you were given**
   From every repository, on one page rather than three tabs of a dashboard.
7. **Three thousand issues, filtered**
   The filter sits above the list, on a repository with three thousand of them.
8. **History, one line per commit**
   Each commit shows its message and the size of its change on one line.
9. **The README and the file tree at once**
   Both on one screen, so neither one buries the other.
10. **Opens on the line that broke**
    The failing assertion, instead of a log to scroll. The eleven passing jobs
    show as a count.
11. **Runs grouped by the work they belong to**
    One page of oven-sh/bun showed twenty-five runs for two branches. This lists
    the two.
12. **Two fields, not eight**
    A title and a body. Labels and assignees wait until the issue exists.

---

## 8. Close

**Heading**

> Nothing changes for anybody else.

**Body**

> Every review, comment and merge goes through GitHub, so a colleague who has
> never installed GitQuiet sees your work exactly as usual. No account, no
> server. GitQuiet uses the GitHub session you already have.

**Button:** Add to Chrome
**Under it:** Also for Safari, or as a macOS app.

Cut: "and your code stays in your browser" here, because the hero already says
it and saying it twice reads as protesting.

---

## 9. Footer

gitquiet · Source, under AGPL-3.0 · Not affiliated with GitHub.

---

## Files to change

| What | Where |
| --- | --- |
| Hero headline, subhead, trust line | `site/src/Page.tsx` |
| The four group names and meanings | `site/src/Page.tsx` (`COURTS`) |
| Screen captions | `site/src/features.ts` |
| Comparison table | `site/src/Page.tsx` (`AGAINST`) |
| Complaints | `site/src/pains.ts`, unchanged |
| Speed section | new, numbers from `video/src/measurements.ts` |

`site/src/assets.tsx` lines 150 and 292 still say "grouped by who acts next" and
need the same treatment. So does `README.md:6`.
