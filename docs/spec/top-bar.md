# Spec: The Bar

Status: agreed — option B, being built

The three options were drawn against each other in `docs/spec/top-bar-compare.html` and B was
chosen: our strip carries Code, Issues and Pull requests itself, and their other six tabs move
behind the repository's name. So the section below titled "What it does not take" is the option
that was **not** taken, and is kept only because the argument in it is still the cost of B —
see "What B costs" beneath it.

## Problem Statement

The bar across the top is the last part of every screen this extension takes over that is
still entirely GitHub's. A Participant who has installed this now meets our Home, our Working
Set and our pull request screen through a strip that answers to none of them: it names a page
that no longer exists, advertises a key it no longer owns, and offers four controls the Rail
already does better.

Measured on a live signed-in window, 1920 wide, by `scripts/probe-header-dom.js`:

- **On Home** the bar is `header.GlobalNav`, 64px tall, holding twelve controls. Nine of them
  are unlabelled icon buttons packed into the right 500px; the 1169px between the "Dashboard"
  crumb and the search button at x=1355 is empty.
- **Off Home** — read on `/flowline-labs/flowline/pull/1934` — it is 100px, because a second
  row carries the repository nav: Code, Issues 183, Pull requests 8, Discussions, Actions,
  Projects, Security and quality, Insights, Settings, with owner and repository crumbs and a
  Switch repository control on ⌥⇧R.
- **`/` no longer belongs to their bar on Home.** Pressing it puts the caret in the Rail's
  "Filter repositories" input and their dialog never opens, while their own button still reads
  "Open quick search dialog, type / to search". The bar is advertising a shortcut we took.
- **The crumb says "Dashboard"**, which is a name for one page where there are now three
  Destinations, and it never says which one the reader is on or what is owed on it.
- **There is no unread count to draw.** Their bell is a bare inbox octicon linking to
  `/notifications`, with no label and no number anywhere in it, and
  `/notifications/indicator` answers `200 {"mode":"global"}` to the reader's own cookies. So
  the most GitHub itself knows here is whether something is waiting, not how much.

Four of the twelve controls are things the Rail answers on Home, and each is a complaint
already weighed in the Home spec's evidence table: the hamburger drawer duplicating the
repository list (36 upvotes), the create menu standing in for a New-repository button (2
asks), the fifteen-item account menu against the Rail's five, and finding a repository at all
— theirs covers recent repositories only, which is the Hacker News complaint. The Copilot
button is a second entry point to the thing carrying 200 upvotes and 108 👍 against it, on a
page where we deliberately never render the first one.

## Solution

One strip of ours, 40px, on every screen this extension renders, and on no other address.
(48px as first built. Standing on the page it was still a band: nothing in it stacks, so the
space over and under a 28px control was only pushing the work down. 40 leaves six pixels either
side of a control.)

Three regions, left to right:

- **Context.** The way home, then what the reader is looking at. The mark is on every screen
  rather than on Home alone: a pull request has no Rail beside it, so without it the whole of
  our navigation there pointed further into one repository. Beside it, `owner/repo` on a page
  inside a repository, and nothing on Home, where the Rail one row below already names the
  Destination and counts it. The number went the same way: `#1934` sat twenty pixels above a
  title that is that number in large type. A crumb earns its place by saying what nothing else
  on the page says.
- **Search, and ours.** One control, `cmd+K`, over every repository the Participant has and
  every Involved item, answered from the cache so it returns before a network round trip.
  It sits over the start of the reading column rather than pinned to the right edge at
  x=1355, and it names the key it actually owns. This is the answer to both "the repository
  search covers recent only" and the command palette deprecation listed at 405.
- **What is not ours.** The notifications mark — a dot rather than a number, because a dot is
  the whole of what `/notifications/indicator` knows — and the Participant's face
  carrying the same five-item menu the Rail has — switch account, settings, the shortcut
  sheet, hand the page back to GitHub, sign out. The inbox behind the bell stays GitHub's:
  it is out of scope in the Home spec and a different product surface.

Nothing else. No Copilot entry, no create menu duplicating the Rail's, no drawer, no
greeting, and 48px rather than 64px — the same 16px the "padding too large" complaint (34
upvotes) is about, given back on every screen rather than one.

### What it does not take: the repository nav

The second row off Home — Code, Issues, Pull requests, Actions, Settings — stays GitHub's.
`docs/spec/pull-request-review.md:96` decided this in writing: "the site header, the
repository nav, the pull request title and its Files, Commits and Checks tabs — is GitHub's
and stays GitHub's, both because those parts already work and because a page that is half
theirs must navigate like theirs." Six of those nine tabs go to pages this extension does not
render, and a Participant pressing Insights or Settings inside a bar of ours would be handed
straight back to a page that looks nothing like the strip they pressed it from.

### What B costs, and what pays for it

That argument was not enough, and the reason is the count: their two rows are 100px before a
repository's page begins, and B is 48. Half the top of every page in the product is worth more
than the muscle memory of six tabs a reader visits monthly.

What makes it safe is that the tabs are **read rather than reproduced**. `theirNav.ts` takes
`nav[aria-label="Repository"]` — measured inside `header.GlobalNav`, so one gate hides both of
their rows — and turns their own anchors into the strip and the menu. Nothing is hardcoded, so
a repository with Discussions switched off has no Discussions row, Insights keeps their odd
`/network/dependencies` address, and a tenth tab GitHub adds next year appears in the menu
without a line of ours changing. The one invented rule is which three stay in the strip, plus
this: whichever tab GitHub marks as current stays in the strip even if it is not one of the
three, so the bar can always say where the reader is.

`docs/spec/pull-request-review.md:96` has to be edited for this: it says the repository nav
stays GitHub's. That sentence was true when the only page taken was a conversation.

### Read rather than reproduced, and read by us

Reading their row costs the row being there, and on a press it is not. Their header hydrates
from a painted frame, so a bar arriving over another repository draws before their nav exists,
and what an address alone can promise is Code and Pull requests. Photographed on
`flowline-labs/flowline`: a hundred and ninety-five issues, and a bar with no way to them.

So the row is a read of ours now, and no longer a thing the bar hopes to find in the page.
`github/repoTabs.ts` is one parser used twice — on the live row, and on the document GitHub
serves for a repository's front page, which is the only place the row is served. The gateway
takes it out of that document, `app/warming.ts` reads it when the pointer rests on any link
into a repository, and it is kept under the repository's own name.

The keeping is what a single stored row could never be. One row for all of GitHub is `bun`'s
tabs above `hello-world` for the length of the hydration, which is a reader pressing Issues and
landing somewhere else; keyed by owner and repository, a row can only ever be drawn under the
name it was read from. Measured on the switch from `octo-org/octo-repo` to
`flowline-labs/flowline`, where their row is absent by definition: without a kept row the bar
opens saying Pull requests and gains Issues three seconds later, with one it opens saying
Issues 195 and Pull requests 9. Their live row still wins the moment it lands, counts and all.

### Where it does not render

Anywhere without a `Place`: code browsing, the notifications inbox, settings, search results.
Their bar stays whole there, unchanged and unhidden, which is also the escape hatch — "hand
this page back to GitHub" restores it on our screens too.

## Implementation Decisions

The bar is not a `Place`. A `Place` replaces one region on one address; this replaces one
element on every address we own, so it belongs with the gates rather than with the screens:
a rule that collapses `header.GlobalNav` while our own strip renders in our container.

`GlobalNav` is the hook, and it is measured rather than chosen: their bar carries
`GlobalNav styles-module__appHeader__YzYWk prc-Stack-Stack-UQ9k6`, where the first class is
stable and the second two carry Primer's per-deploy hash. Gating on the hashed pair is how
this breaks silently on a Tuesday.

Two things the gate has to survive, both known from the pages already taken:

- Their bar re-mounts on soft navigation, so the rule cannot be a one-shot style applied at
  load; it has to hold the way `gates.soft.css` holds.
- Their modules hydrate from a painted frame, so any probe re-run against this must be in a
  window the operating system is showing, or it measures a page of zeroes.

### One bar, and whose it is

The slot is made once per document and every screen's tree portals its bar into it, so the slot
will hold two bars as happily as one. For the whole second between a press and the address moving
there are two trees alive — the screen the reader is looking at and the screen arriving, started
on the promise of the press — and both of them used to draw. Two bars, one under the other, and
for good wherever the arriving screen never got the page: a press abandoned before the release, a
takeover that threw, their router quicker than ours.

The rule is `oursToDraw` in `src/ui/mount.ts`: a screen draws the bar while it has the page, or
while nobody has it. The second half is not slack. On a document load the tree renders while
GitHub's HTML is still parsing, and the bar is the first thing on the screen; held back until the
takeover, the page would have no bar at all for as long as that took, because their own is hidden
by the presence of the slot rather than by anything we could time.

What made this everyone's fault and nobody's: ten screens each unmount themselves on the one path
that says the page is GitHub's, and none of them said anything about the paths that do not. The
invariant is one screen's bar on the page, and it now has a single owner. The screens close their
half of it too — a takeover that throws comes down exactly as one that finds nowhere to stand.

Two things had to be added before that rule was true on a real page, and both were found by
pressing one. The screens do not share memory: each is built as its own bundle, so the leaving
screen's bar was never told the page had moved, the move having happened in another program
entirely. The telling goes through the document now, as `gitquiet:screen-moved`.

And a bar that stops the instant it loses the page leaves the slot empty for the eighty
milliseconds the arriving tree needs to render, which is not a smaller bar but no bar: the page
moves up by its height and back down, under the reader's pointer. So the leaving bar holds until
the arriving one says it is up (`gitquiet:bar-standing`), capped at four hundred milliseconds for
the reader who left for a page of GitHub's, where none is coming. They overlap for a frame or two,
and `glass.css` shows the last one only, so an overlap can never be seen as two.

### What separates the strip, with no line in it

The interface draws no borders (`src/ui/dress.ts`, `src/ui/quiet.css`), so a bar of eight
controls in one grey is a bar a reader cannot read. Four decisions, all of them tokens rather
than values, so every pack answers them:

- **The tab the reader is on is in the accent**, `bg-accent-muted` over `text-ink-accent`, not
  in the hover grey the tab beside it takes under a pointer. The Rail settled this first: two
  greys, one meaning "you are here" and one meaning "you could press this", is what made a
  strip with no lines read as flat.
- **The search is two steps down the ladder**, `bg-active` rather than the `bg-hover` every
  chip wears, and its hover is in the ink. It is the one control here a reader has to find
  without being told where it is, and at one step it was the faintest thing in the strip.
- **Every tab and every menu row carries a glyph**, matched to their own tab name by its first
  word (`src/ui/tabMarks.ts`), because the row is read off GitHub's nav and their names move.
  A glyph column is what a reader scans a menu of six by.
- **The bar carries the pack's shadow.** Its fill is one step off the page's own, and on a
  pack whose chrome is darker than its content, Cursor's and Vesper's among them, that step is
  two per cent of a grey. A layer over a page has to say how far off it is, and only a shadow
  says that.

### The palette behind ⌘K — built

`src/domain/finding.ts` decides what is offered, and the whole of it is a fold over lists that
have already arrived. No request, no debounce, no spinner: the answers move with the keystrokes.

| Where | What it searches | Where it comes from |
| --- | --- | --- |
| Home | every repository, plus every pull request and issue the Courts hold | already on the screen |
| A pull request, a repository list, a commit | every repository | the store, as the last visit to Home left it |
| Any page inside a repository | a bare number, as `#N` in that repository | typed, not read |

Four decisions worth keeping:

- **Cache only, off Home.** A pull request page has no business asking GitHub for a hundred and
  fifty repositories on the chance somebody presses ⌘K. A reader who has never opened Home is
  offered no search at all rather than made to wait for one, which is why the control disappears
  rather than greying out.
- **A number is a navigation.** Reading #1934 and wanting #1938 is the most repeated walk in a
  review day, and their own interface answers it with the address bar. `/pull/N` rather than a
  guess between pull and issue: GitHub forwards `/pull/N` to `/issues/N` and not the reverse.
- **Ranked, not filtered.** Everything matching is offered; a repository whose own name starts
  with what was typed stands above one that merely contains it, and both above a title that
  matches in the middle of a word.
- **Portalled to the body, and reset there.** Nothing on their page can clip it, and the price is
  that their input styling reaches it — hence the one named rule in `quiet.css`.

Measured live, `scripts/verify-palette.js`, against a signed-in account with 154 repositories:
on Home ⌘K opens on what is owed and `ego` narrows to four; on `flowline#1934` the store answers
`githubpro` in one, and `1938` offers `#1938 flowline-labs/flowline`.

## Out of Scope

- The notifications inbox, as in the Home spec. Only its count appears here.
- Organisation and enterprise navigation. Their account menu reaches it; ours links out to it
  rather than reproducing it.
- The repository nav row, per the section above.
- Full-text search over code and issues. Their dialog remains one press away for it; ours
  answers repositories and Involved items, which is what the cache can answer instantly.

## Evidence

| Complaint | Weight | Answer here |
| --- | --- | --- |
| Repositories duplicated in sidebar and hamburger | 36 upvotes | No drawer in our bar |
| Repository search covers recent only | Hacker News | `cmd+K` over every repository |
| Command palette deprecation | listed at 405 | Same control, ours |
| No New-repository button | 2 asks | Create lives in the Rail; not duplicated |
| Chat box not optional | 200 upvotes, 108 👍 | No Copilot entry point |
| Padding too large | 34 upvotes | 64px → 40px, and 100px → 40px + their nav |

## Further Notes

The unread question is settled and the answer narrows the design: `/notifications/indicator`
answers `{"mode":"global"}` to cookies and their own bell carries no number, so a dot is not a
compromise here — it is everything that can honestly be drawn. Anything more would need the
inbox itself, which is out of scope.

The second thing worth writing down before any of this is built: this is the third widening
of the vision, after Home and Involved Issues. `CONTEXT.md` still says the work around a pull
request is "the whole of it". A bar on every screen is the point at which that sentence is no
longer true of the product, and it should be edited on purpose rather than quietly outgrown.
