# Landing page copy

Rewritten 2026-08-16.

## The frame

GitHub is where the work lives. GitQuiet is where you do it.

That is the whole positioning, and every line on the page has to sit inside it.
GitHub keeps being the system of record: the repositories, the reviews, the
merges, the permissions, the teammates. GitQuiet is the place you actually sit
and work, and it happens to open on github.com's own URLs today and in a window
tomorrow.

**Words that are now banned from the page.** Each of them describes the
plumbing, and each of them makes GitQuiet sound like a patch on somebody else's
product rather than a place of its own:

- redraws
- fourteen pages
- on github.com itself
- improves, fixes, replaces

The comparison section that used to carry them is gone, so there is nowhere left
on the page where they belong.

**The analogue to hold in your head.** Gmail is where the mail lives; Superhuman
is where you read it. Superhuman's page never says it redraws Gmail's pages. It
says what it is like to work there.

## What the length measurements said

Hero copy, read off the live pages on 2026-08-16:

| Site | Headline | Subhead | Whole page |
| --- | --- | --- | --- |
| Raycast | 4 words | 15 words | 1625 words |
| Zed | 4 words | 15 words | 2084 words |
| Warp | 6 words | 19 words | 806 words |
| Graphite | 6 words | 14 words | 609 words |
| CodeRabbit | 8 words | 10 words | 3166 words |
| **GitQuiet, before** | **4 words** | **44 words** | **~870 words** |

Headline 4 to 6 words, subhead 16 or fewer, one idea per section. Whole-page
length is not the constraint. CodeRabbit runs to 3166 words.

---

## 1. Hero

**Skip link:** Skip to the screens

**Nav:** gitquiet · Add to Chrome

**Headline**

> A faster, quieter GitHub.

**Subhead** (12 words)

> GitHub is where your work lives. GitQuiet is where you do it.

**Primary button:** Add to Chrome

Nothing under it. The button stands alone, and the closing card is where the
other browsers are named.

---

## 2. The Working Set

No copy. The live screen carries it, and the only words on it are the product's
own group names:

**Needs You** · **Waiting** · **Running** · **Settled**

---

## 3. Every screen

No header. The screens carry themselves, and the caption beside each one is the
only copy:

1. **Sorted by what needs you**
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

## 4. Close

**Heading**

> It opens fast, then leaves you alone.

**Body**

> The page is read before you press it. What needs you sits at the top, and
> everything else stays out of the way.

Nothing else on the card. The close carries the same two words as the headline,
fast and quiet, in the form a reader can check on the next press: the page is
read ahead, and the list puts what needs an answer first. No number, because the
speed section is gone and a figure in a closing card is a figure nobody can
check from a closing card. What a teammate sees is not the subject: they see
GitHub, which the reader already assumes.

**Button:** Add to Chrome
**Under it:** Also for Safari, or as a macOS app.

---

## 5. Footer

gitquiet · Source, under AGPL-3.0 · Not affiliated with GitHub.

---

## Where the old language still lives

`Your Move` is `Needs You` now. The module is called Courts, after the ball being
in someone's court, and `Your Move` was a chess word inside a tennis metaphor. It
was also the only two-word name in a set built on one-word names. `Needs You`
says what the group is for rather than naming the mechanism, and it still means
something in the desktop window, where there is no github.com in sight.

Each of these says "grouped by who acts next" or counts pages, and each needs the
same pass:

| File | Line |
| --- | --- |
| `README.md` | 6, 19 |
| `site/src/assets.tsx` | 150, 292 |
| `site/src/Page.tsx` | hero |
| `site/src/features.ts` | caption 1 |
