# Spec: A person's own pages

Status: draft-for-review

Covers three addresses that share one subject: `/LOGIN`, `/LOGIN?tab=repositories`
and `/LOGIN?tab=stars`.

## Problem Statement

These three pages are the first pages a reader opens about a person, and none of
them answers the question the reader arrived with.

They are not slow. Measured signed out on 2026-08-14, three runs each, they
answer in 0.24 s to 0.89 s and weigh 202 KB, 314 KB and 301 KB. Every other page
in the replacement ranking was ranked on measured slowness. That argument does
not apply here, so this one is different: the data is present and the shape is
missing.

**The repositories tab is a flat list, and the ask to group it is the loudest on
the record.** Three discussions ask for the same thing and carry 1,679 upvotes
between them: [#4174](https://github.com/orgs/community/discussions/4174) (686),
[#41348](https://github.com/orgs/community/discussions/41348) (589, 403 👍) and
[#17662](https://github.com/orgs/community/discussions/17662) (404, 312 👍). The
oldest opened in June 2021. Nothing has shipped. A commenter at 116 upvotes names
the page exactly: it "is little more than an ordered list, rather than say,
something like a more complex hierarchy". The next two, at 92 and 78, say they
went to GitLab for it.

The page holds 30 rows. Each row already carries the language, the star count,
the fork count and a `<relative-time>` for the last push. Nothing on the page
uses any of it to separate work that is alive from work abandoned in 2019, and
archived repositories sit in the same list as current work.

**The stars tab is a bookmark system that cannot be searched.** GitHub documents
the limits itself: the search bar "only searches based on the name of a
repository or topic, and not on any other qualifiers", sorting offers three
choices, and filtering offers language and type. Lists have been in public
preview since 2021, are described as public only, and stop at 32. The requests,
with staff replies from 2021 on two of them:
[#8626](https://github.com/orgs/community/discussions/8626) private lists (439),
[#8636](https://github.com/orgs/community/discussions/8636) a "not in list"
filter (312), [#8293](https://github.com/orgs/community/discussions/8293) an API
(243), [#46887](https://github.com/orgs/community/discussions/46887) more than 32
lists (142).

**Curation by hand is the documented failure mode, and it has failed since
2014.** Astral shipped as the tagging tool for stars and collected 145 points on
Hacker News, where the two sharpest comments are the whole problem. Xorlev: "It'd
be a lot more valuable if it offered some initial organization (e.g. by primary
language, or by author). Otherwise I'm left with several hundred stars to
categorize. The interface is gorgeous, but doesn't really do much." spullara: "Not
sure why I would want to do all this busy work." GitHub Lists repeat the
mistake, which is why #8636 exists: it is a reader asking for help with the
backlog the feature created. Five more tools shipped since, three of them in the
last year, and one of them is a Chrome extension whose entire stated purpose is
to make `?tab=stars` searchable and taggable. Its README names the pain as
"pagination hides the full picture of your stars", "no personal tagging system",
"no real notes layer", "hard to revisit what you saved and why".

**On a profile, the largest element is the weakest signal on the page, and it is
often wrong.** [HN 11404482](https://news.ycombinator.com/item?id=11404482), 207
points, does not agree that the contribution graph should go, and does agree on
what it measures. One reader says it "has come up in job interviews in a negative
way". Another says "I do 95% of my work on Github in private repos at work... so
my contribution graph is pretty abysmal". By GitHub's own rules a commit counts
only when the authoring email is connected to the account, a calendar selection
is capped at one month, and a squash merge collapses a series into one square. A
search for `profile contribution graph` in `community/community` returns 564
discussions, and 22 of the first 25 by relevance are reports of a graph showing
the wrong number or nothing at all. Achievements are worse: 695 discussions, and
the first 25 are almost all one report, that the badge never appeared.

**The question a reader actually brings is on the same thread, at one comment.**
konschubert: "there is a point in having a coarse activity indicator in order to
assess how likely somebody is going to respond to issues or pull requests." A
hiring manager writing about how he reads a profile says the same thing from the
other side: the review, discussion and feedback history is the signal. A reader on
r/github says it about every profile visualiser: "A lot of us don't maintain our
own repo, but we do PR to opensource which is not shown in your design."

So the reader wants two answers. Will this person answer me. Is this work alive.
The pages hold the data for both and print green squares and a badge instead.

## Solution

Three screens, one subject, and one rule they share: **group rather than filter**,
which is the rule every other screen here already follows.

### The person

Their `Layout-sidebar` stays exactly as it is. The avatar, the name, the bio, the
follow button and the Sponsor button are outside the frame this takes, they are
how a reader acts on a person, and they already work. Two headers about one
person is the mistake the pull request screen avoids.

### Profile — `/LOGIN`

Four bands, in this order.

**Answering.** One band with the answer to "will this person reply". Built from
their public events: how many reviews, pull requests and issue replies they left
on other people's repositories in the last 90 days, when they last did, and in
how many repositories. A person with 200 commits to their own repository and no
reply to anybody in three months reads differently from the reverse, and today
both are one shade of green.

**The work, by kind.** A per-week stacked bar over the last year: pull requests,
reviews, issues, commits. Same period as the calendar, same data source, and it
says what the squares will not.

**The calendar, labelled.** Drawn, because readers know it and look for it, and
labelled with what it counts and what it misses: commits on default branches
whose author email is connected, squash merges as one square, private work
excluded unless the reader owns it. A reader who has been asked about their graph
in an interview is owed that sentence.

**Their repositories, grouped.** The first band of the repositories screen below,
capped at six, with the group counts and a link to the tab.

Achievements are not drawn. Nothing about a badge tells a reader whether to trust
a repository or expect a reply, and the badge is the single largest source of
support traffic on this page.

### Repositories — `/LOGIN?tab=repositories`

Four groups, in this order, each with a count, each collapsible, and the state
remembered:

- **Moving** — pushed in the last 30 days.
- **Quiet** — pushed before that.
- **Retired** — archived.
- **Forked** — a fork the person has not pushed to. Collapsed by default.

One row shows the name, the description, the language, the stars, the last push
as a date rather than "2 years ago", and up to three topics. Two figures sit
above the groups: the language share of everything they own, and a strip showing
when each repository last moved, so a page of 30 rows answers "is any of this
alive" without being read.

Search covers every repository the person has, not the 30 on the page, and
matches the name, the description and the topics. GitHub's own search here
matches the name.

### Stars — `?tab=stars`

The same grouping, and the reader chooses the axis rather than tagging anything:

- **By language** — the default.
- **By owner** — which answers "what else of theirs did I keep".
- **By life** — Moving, Quiet, Retired, which is how a bookmark from 2021 to a
  dead project becomes visible.

GitHub's Lists are shown where they exist and are never required. A reader with
zero lists gets the same screen as a reader with 32.

Two figures: the language share of what they keep, and the same last-moved strip.
Nothing here writes to GitHub, so no list is created, renamed or filled from this
screen.

## Language

Four words for `CONTEXT.md`, if this is agreed.

**Pick**:
A repository a Participant has starred. GitHub spends one word, "star", on two
things: what one reader saved and what the crowd counted, and a screen that shows
both needs two words. A Pick is the reader's; Stars are the crowd's.
_Avoid_: star, favourite, bookmark

**Moving**:
A repository pushed to in the last 30 days. The group a reader is looking for
when they ask whether a project is alive.
_Avoid_: active, recent, fresh

**Quiet**:
A repository with no push in the last 30 days and no archive flag. Not dead, and
not what the reader came for.
_Avoid_: stale, inactive, old

**Answering**:
What a Participant has done lately on somebody else's work: reviews, replies on
issues, pull requests opened elsewhere. The answer to the only question a reader
brings to a stranger's profile, and the thing the contribution graph is used as a
proxy for.
_Avoid_: activity, engagement, responsiveness

## User Stories

1. As a Participant who received a pull request from a stranger, I open their
   profile and see in one band whether they answer anybody, so I know what to
   expect from a review conversation.
2. As a Participant choosing between two libraries, I open the author's
   repositories and see Moving separated from Retired, so I can tell a live
   project from a graveyard without opening each one.
3. As a Participant with 400 Picks, I open my stars and find the auth library I
   kept in 2021 by language, without having tagged it.
4. As a Participant whose graph is empty because their work is private, I read
   the label under the calendar and know the page is not calling me idle.
5. As a Participant looking at my own repositories, I collapse Forked once and it
   stays collapsed.

## Implementation Decisions

### The places

All three pages serve `turbo-frame#user-profile-frame` as the content region,
with `Layout-sidebar` and `Layout-main` around it and a bare `<main>` above.
Measured on the three fetched pages, not guessed.

| Place | `owns` | Proof of which tab |
| --- | --- | --- |
| `profile` | `/LOGIN` with no tab, or `?tab=overview` | `include-fragment` whose `src` carries `tab=contributions` |
| `person-repos` | `?tab=repositories` | `#user-repositories-list` |
| `person-stars` | `?tab=stars` | `turbo-frame#user-starred-repos` |

- `regions`: `turbo-frame#user-profile-frame`.
- `fallback`: `main`, as on `ISSUES` and `NOTIFICATIONS`. There is no pjax
  container and no repository frame on these pages.
- `stages`: the region.
- `soft`: `holding` with the per-tab proof above. The frame is shared by all
  three tabs, so the frame alone cannot say which one a press is going to, and a
  rule that hid it would blank the tab the reader is still reading.
- `bands`: none. The sidebar is outside the region and stays.

`/LOGIN` is the shortest address of the three and must be asked last in
`BY_ADDRESS`, after every other place, exactly as `REPO_HOME` is. A login is one
segment, so the parser must reject GitHub's own one-segment addresses. The
existing `NOT_AN_OWNER` list in `src/domain/repoHome.ts` is the one list to
extend, never a second copy.

### Data access

Nothing here needs a request GitHub does not already make.

- **Rows.** The served document holds 30 rows with the name, description, topics,
  language, star count, fork count and last push. Read from the document on
  arrival, as `frontInDocument` reads a repository's front page.
- **Later pages.** `?page=N` on the same address, same shape. Page 1 is drawn
  from the document, and the rest are warmed behind it. Grouping needs all of
  them, so the group counts are marked provisional until the last page lands.
- **Pick order.** The stars tab is served in "recently starred" order, so the
  reader's own order is the row order. No extra request, and no `starred_at`
  header needed.
- **The calendar.** `/users/LOGIN/contributions` returns 370 day cells carrying
  `data-date`, `data-level` and a count in the `<tool-tip>` text. Verified on
  2026-08-14.
- **Answering.** Public events, which `src/github/activity.ts` already reads
  without cookies. Their anonymous limit is 60 an hour against the address, so
  this is asked once a visit and kept, exactly as Activity is.

### Behaviour

- Groups collapse, and the state is remembered per Participant, as the Home
  sections are.
- The axis chosen on the stars screen is remembered.
- No write path. No star, no unstar, no list.

### Figures

Two shapes only, and both are built from tokens rather than a chart library:
a share bar, which `src/ui/Standing.tsx` already draws for languages, and a strip
of cells, which the calendar already is. `prefers-reduced-motion` removes the
travel on both, per `motion.css`.

Language colours come from GitHub's own palette, as `Standing.tsx` already does.
Everything else uses `--color-*`, so packs and dark mode follow.

### Keyboard

`g p` for the person under the pointer is not added yet. The existing chords
stay. Groups answer to the same collapse key the Home sections use.

## Testing Decisions

- Parser tables per address, accepting `/LOGIN`, `?tab=repositories`,
  `?tab=stars`, and rejecting `/settings`, `/orgs/...`, `/marketplace`,
  `/LOGIN/REPO`, `?tab=achievements`, `?tab=followers`, `?tab=packages`,
  `?tab=projects`.
- `src/ui/place.test.ts` gains the three addresses and the negative cases.
- Grouping is a pure function over rows, tested by table: 30 days is the edge,
  archived beats Moving, a fork with no own push is Forked.
- One render test per screen against fetched fixtures.
- A figure test that a share bar's segments sum to 100 and that an empty set
  draws nothing.
- Decoder tests against the three saved pages in `.research/profile-page/pages/`,
  promoted to `fixtures/` when the shapes settle.

## Out of Scope

- The achievements, followers, following, packages, projects and sponsoring tabs.
- Editing your own profile, pinning, and the profile README's own repository.
- Creating, renaming or filling a List. The screen reads them.
- Organisation pages. `/ORG` shares this address shape and does not share the
  content, so it stays GitHub's until it has a spec of its own.
- Fake-star detection. `/stargazers` returns 404 since 30 June 2026, so the data
  is gone.

## Evidence

| Complaint | Weight | Answer here |
| --- | --- | --- |
| Repositories cannot be grouped | 686 + 589 + 404 upvotes, 715 👍 | Four groups, counts, collapsible |
| "Little more than an ordered list" | 116 upvotes | Groups, not a list |
| Readers leave for GitLab over it | 92 and 78 upvotes | Same feature, no organisation needed |
| Stars search matches a name only | GitHub docs | Name, description and topics, over every page |
| Lists are public only | 439 upvotes, 133 👍 | Nothing on this screen is published |
| Lists stop at 32 | 142 upvotes, 75 👍 | No list needed to have a group |
| No "not in list" filter | 312 upvotes, 88 👍 | Grouping needs no list at all |
| Tagging by hand is busy work | HN 8639374 | Every group is derived |
| "Pagination hides the full picture" | tool README | All pages fetched, one list |
| Graph used to judge people | HN 11404482, 207 points | Answering above it, and a label on it |
| Graph shows the wrong number | 22 of first 25 discussions | Label says what it counts |
| Badges never appear | 695 discussions | Not drawn |
| Real work is pull requests elsewhere | r/github, 457 points | Answering counts exactly that |
| `/stargazers` removed, `?tab=stars` is what is left | 111 + 47 upvotes | The tab gets the controls |

## Further Notes

**This widens the vision, and `CONTEXT.md` should say so before any of it is
built.** `docs/spec/home.md` already records that same debt in the same words.
The scope is the whole of GitHub, and the document still reads "the work around a
pull request... That is the whole of it". The four words above go in the
vocabulary at the same time.

The research this stands on is
`research/profile-pages-pain-points.md` in `flazouh/gitquiet-notes`, with the
fetched pages and their index in `.research/profile-page/`.

Two things are still unknown and both are cheap to settle. Whether the anonymous
events route carries enough history for a 90-day Answering band on a busy person,
or whether it stops at 300 events and needs a shorter window. And whether these
three pages navigate softly between each other, which decides whether the gate
needs the per-tab proof at press time or only at load.
