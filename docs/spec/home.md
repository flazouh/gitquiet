# Spec: Home

Status: draft-for-review

## Problem Statement

GitHub's home dashboard is the page its own users voted against. The announcement of the
current design — [community/community#177902](https://github.com/orgs/community/discussions/177902),
"Home dashboard update [Public preview feedback]" — carries 361 👎 against 127 👍, with 355
comments and 253 replies. That thread is the best evidence available anywhere about what
this page should be, because it is a thousand developers describing the same page we are
about to replace.

Read together with the older feedback, the complaints resolve into one structural mistake:
the page tries to be two things at once and is neither.

**A work queue** answers "what needs me right now". **Orientation** answers "where do I
go". GitHub put both on one page, then added a chat box, a greeting and changelog
advertisements on top, so the queue is diluted by things nobody asked for and the
navigation is duplicated in two places at once.

What Participants say, with the votes each carries in that thread:

- The chat box is not optional enough. "pretty sick i just dont like the AI chat thingy, it
  should be optional" (200 upvotes, 108 👍), "Add me an option to remove the useless AI
  bullshit or opt-out of it" (54). The opt-out exists at `settings/copilot` under "Dashboard
  entry point"; a Participant had to find it and post it in the thread, where it collected
  9 ❤️ from people who had been looking.
- The greeting is worse than useless. "The 'Good morning, {username}!' at the top is too
  precious for my taste. I come here to review PRs, not to exchange pleasantries with the
  LLM" (86 upvotes, 36 👍).
- Repositories were displaced by advertisements. "I dont particularly care much for the
  Github changelogs that replaced other repos I might be interested in" — the single
  most-voted comment in the thread (222 upvotes, 142 👍).
- The lists are ordered by last-updated, so they are stale rather than actionable. "I have
  a PR from 2016 which appears in the list (and the most recent activity dates from 2020),
  that's not exactly what I'd call recent" (34). Another: "my 'Home' shows one PR from 2017
  and three issues that are not especially important to me" (8 👍). GitHub's answer in the
  thread was repeatedly "take a look at the filters", and it repeatedly did not help.
- Nothing can be put away. "I'd love it if I could hide PRs and issues I don't want to see
  anymore" (17). Sections cannot be reordered or removed either (33, and again at 2): a
  Participant who unchecked every agent filter still had the agent module occupying the top
  of the page.
- The rows are too fat. "The list items have excessively large paddings, I'd prefer a
  (much) more compact view" (34).
- Getting anywhere costs more than it did. "Now it takes two taps to access my repo instead
  of one"; "I just want to start a new bloody project why have you hidden everything behind
  the bloody chat bot?"; two separate requests for a plain New-repository button. On Hacker
  News, on the same page: the repository search "only searches for 'recent' repos… you will
  pull your hair out trying to search for that one repo".
- Navigation is duplicated. "The repositories on the left is a duplicate of the
  repositories in the hamburger menu. I think the one in the hamburger menu should be
  removed" (36).
- Row actions hide behind hover. "Why does this appear on hover? Hover is terrible UX for
  touch inputs" (11).
- The feed was moved out and people want it back on this page — see the Activity section
  of the Solution, where that evidence is set out in full.

Older discussions say the same thing without the AI: "Dashboard feed is completely
unhelpful as a dashboard" ([#131070](https://github.com/orgs/community/discussions/131070),
19 upvotes) — "It's just a bizarre algorithmic feed full of things I don't care about". And
"Github is my work tool, please create a home page that help me instead of taking my focus
away" ([#53780](https://github.com/orgs/community/discussions/53780), 61 upvotes), where a
replying Participant names the cost exactly: the current home screen "is just a speed bump
on the road to where you're actually going".

There is a second problem, which is ours. This extension takes over four addresses — a
pull request's conversation, a commit, `/pulls` and `/owner/repo/pulls` — and `github.com/`
is not among them. The page every session starts on is still entirely GitHub's, and a
Participant who has installed this arrives every morning at the page above before reaching
anything we built. There is also no navigation of our own anywhere: leaving a pull request
means the back button, which GitHub's own soft navigation is known to break.

## Solution

Two mechanisms: a Rail that never leaves, and a Home with three Destinations.

### The Rail

A narrow vertical strip pinned to the left edge of every screen this extension renders —
Home, the Working Set, a repository's list, a pull request, a commit. Roughly 15rem
expanded and 3rem collapsed, and **collapsed is a working state rather than a hidden one**:
the repository faces stay, and each Court keeps its count, so "is anything mine?" is
answered at 3rem without expanding anything. This is the answer to two taps becoming one,
and it is the reason a Participant never needs the back button to leave a pull request.

Top to bottom: the three Destinations with live counts, pinned repositories, every other
repository behind a filter that searches all of them, a create action, and the Participant
at the bottom.

It replaces GitHub's hamburger drawer rather than sitting beside it. Their own Participants
asked for exactly one of those two lists to die.

The Participant menu behind the face is five items — switch account, settings, the shortcut
sheet, hand the page back to GitHub, sign out — and deliberately not a copy of GitHub's
fifteen-item menu.

### Home, and the three Destinations

`github.com/` becomes ours, and lands on one of three Destinations, remembered per
Participant and changed from the Rail rather than from a settings page:

- **Working Set** — the Courts, as they already are on `/pulls`. The default.
- **Repositories** — orientation, ranked by the Participant's own work in each.
- **Activity** — what happened elsewhere, chronological.

The choice matters less than it looks, because every Destination is one chord away, and
that is deliberate: GitHub lost this argument by picking a side for everybody.

**An empty Working Set is where the other Destinations appear.** When no pull request is the
Participant's move, the Courts do not render an empty box — the space becomes their
repositories, and below that their activity. This is the answer to "my Home is of really
low value to me and mostly empty", and it means the adaptive behaviour Participants want
never moves the address under them.

### Involved Issues

Issues appear alongside pull requests, because their absence is a complaint we would
otherwise reproduce: "it took me 3 minutes to find my open issues when I expected those to
be displayed in the dashboard". An Involved Issue is one the Participant authored, was
assigned, or was mentioned in, and it takes a Court by the same rule a pull request does.

One setting: **mixed** — issues and pull requests in the same Courts, so a Court is
genuinely everything owed — or **separate**, issues in their own section below. Mixed is
the default, because a Court that is only some of what is owed is not a Court.

Inside a mixed Court the two kinds are **seamed rather than interleaved**: the pull requests,
then a quiet rule marked `Issues`, then the issues. Interleaving them by age was tried and
measured against a live account — nine pull requests and fifteen issues in Waiting,
read as one long list in two rhythms, with the review column starting and stopping down the
page. The seam is drawn only where there is something on both sides of it, and the Court's
count still covers everything owed, which is what the paragraph above is protecting.

An issue row keeps the pull request's tracks and **spans the four it cannot fill** — review,
checks, comments, diff — with its remarks and up to two of its labels' own words, right-aligned
where a pull request keeps its diff. Two things were rejected on the way: holding those tracks
open (four blank cells per row, which read as data that failed to arrive) and giving the issue a
shorter template (the title track takes up the slack, so the repository column walks sideways
down the list). Labels are named rather than counted now that they have somewhere to stand —
`agent:claude-code` is the whole triage answer where "4 labels" was a number — in this
interface's own quiet chip rather than GitHub's per-repository palette, half of which is
unreadable on this surface.

### Activity

The feed belongs on Home, below the work, and not on a page of its own. The evidence is
unusually specific:

- "I'd like an option for the Feed to be my default view" (146 upvotes, 102 👍).
- "Do we really need to have the feed as a separate page? Much less annoying to have it
  under the home page" (57). The same Participant, later: "I actually do like the
  issues/PRs view, would be a lot more comfortable to use if the feed was directly
  underneath it".
- "An option to view the feed below the lists would be nice" (34).
- "Either integrate the Feed or make it an option to set as the default" (8 👍).
- On moving it to a side-menu link: it "disrupts natural scanning habits and creates an
  'out of sight, out of mind' problem, since menus are often ignored. This should earn its
  place back in the center." That comment rules out the cheap answer of linking out to
  `/feed` from the Rail and calling it covered.

And they want the feed itself fixed, which is an older and larger pile: a discussion titled
"Bring back the old feed please, the new 'For You' tab is horrible", another titled "Feed in
Dashboard — Just give me the chronological order", and
[#173638](https://github.com/orgs/community/discussions/173638), "The updated dashboard-feed
looses important functionality (no more commits)".

So Activity is reverse-chronological, never ranked, includes pushes, and groups by
repository so that fourteen stars in a row cost one line rather than fourteen.

### The design constraint

Nothing on Home is there because we wanted the Participant's attention. Every row is
something owed, something they pinned, or something that happened — and each of the three
is separable and dismissable. No greeting, no chat entry point, no promoted content, ever.

## Language

Additions to `CONTEXT.md`, in its own form:

**Rail**:
The strip of navigation present on every screen this extension renders, holding the
Destinations, the Participant's repositories and their own face. Collapses to faces and
counts, never to nothing.
_Avoid_: sidebar, drawer, nav

**Destination**:
One of the three things Home can be: Working Set, Repositories, Activity. A Participant
chooses which one Home lands on; all three are reachable by one chord from anywhere.
_Avoid_: tab, view, page

**Involved Issue**:
An issue the Participant authored, was assigned, or was mentioned in. Takes a Court by the
same rule an Involved Pull Request does.
_Avoid_: my issue, assigned issue

**Activity**:
What happened in the repositories and to the people a Participant follows, in the order it
happened. Not owed to anyone, which is what keeps it out of the Courts.
_Avoid_: feed, timeline, news

## User Stories

1. As a Participant, I want the Rail on every screen, so that leaving a pull request is one
   press rather than a back button that may not work.
2. As a Participant, I want the collapsed Rail to keep repository faces and Court counts, so
   that collapsing costs me information density and not information.
3. As a Participant, I want the Rail's collapsed or expanded state remembered, so that I set
   it once.
4. As a Participant, I want to pin any number of repositories, so that GitHub's limit of six
   stops being my limit.
5. As a Participant, I want the Rail's repository filter to search every repository I have,
   not the recent ones, so that finding a repository is typing rather than remembering.
6. As a Participant, I want repositories ranked by my own work in them — open pull requests,
   running checks, my last push — so that the list answers where my work is rather than
   where I have been.
7. As a Participant, I want to create a repository, an issue and a pull request from the
   Rail, so that starting something is not hidden behind a chat box.
8. As a Participant, I want to choose which Destination `github.com/` lands on, so that the
   page I open fifty times a day is the page I wanted.
9. As a Participant, I want to change that choice where I see it rather than in a settings
   page, so that the setting is discoverable by the people it is for.
10. As a Participant, I want each Destination reachable by one chord, so that the landing
    choice is a convenience rather than a commitment.
11. As a Participant, I want an empty Working Set to show my repositories and activity
    instead of an empty box, so that Home is useful on a quiet morning.
12. As a Participant, I want Involved Issues in my Courts by default, so that a Court is
    everything owed rather than the pull-request half of it.
13. As a Participant, I want to separate issues from pull requests with one setting, so that
    the mixing is my choice.
13a. As a Participant, I want the issues inside a Court kept below its pull requests under a
    quiet rule, so that a Court holding nine of one and fifteen of the other still reads.
13b. As a Participant, I want an issue row to show its labels' words rather than a count of
    them, so that I can tell what an issue is about without opening it.
14. As a Participant, I want Courts ordered by whose move it is rather than by last update,
    so that a pull request from 2016 is never the first thing I see.
15. As a Participant, I want anything settled long ago held back or aged out, so that Home
    is about now.
16. As a Participant, I want to dismiss a row until it has new activity, so that "not this
    one, not again" is expressible.
17. As a Participant, I want to reorder and collapse sections by dragging and clicking their
    headings, so that arranging Home does not mean visiting a preferences screen.
18. As a Participant, I want my arrangement and dismissals remembered, so that I arrange
    once.
19. As a Participant, I want row actions visible rather than revealed on hover, so that
    reaching one is not a game of aim.
20. As a Participant, I want rows in measured fixed columns, so that a list reads as a list
    rather than as a zig-zag.
21. As a Participant, I want Activity below the work on the same page, so that I do not have
    to remember a second address to see it.
22. As a Participant, I want Activity in the order it happened, so that nothing decides for
    me what I care about.
23. As a Participant, I want pushes in Activity, so that the thing GitHub removed is back.
24. As a Participant, I want fourteen stars on fourteen repositories to cost one line, so
    that the interesting events are not buried by the cheap ones.
25. As a Participant, I want to scope the Rail and Home to one organisation, so that an
    account that exists for one organisation looks like it.
26. As a Participant, I want Home to render from what was last read before any request
    lands, so that opening it is instant on a cold morning.
27. As a Participant, I want no greeting and no chat box anywhere on Home, so that the page
    is about my work.
28. As a Participant, I want one press to hand Home back to GitHub, so that anything not
    covered here is not a dead end.

## Implementation Decisions

### The place

A fifth `Place` in `src/ui/place.ts`, added to `PLACES`, plus `isHome` in
`src/domain/pages.ts` and entries in `pageAt` and `PLACE_OF` in
`src/entrypoints/shell.content.ts`.

Both addresses, `/` and `/dashboard`. Read off the live page by
`scripts/probe-home-dom.js`: the two differ only in `route-pattern` — `/` against
`/dashboard(.:format)` — and are otherwise the same controller, the same action and the same
DOM to the element. Claiming one and not the other would leave a reader who typed the alias
looking at the page this spec exists to replace.

The selectors below were read off the live document rather than guessed, as the other two
list pages were. This page is Rails-rendered like a repository's list rather than React like
`/pulls` — there is no `react-app` element at all — and its modules are `react-partial`
elements whose `partial-name` is stable, semantic and free of the per-deploy hash that
Primer's class names carry. That is a better hook than anything the other pages had.

**The region** is `div#dashboard.dashboard`, 680 wide inside `main.flex-1`. It holds an
`h1.sr-only` reading "Dashboard" and one `div.news`, and that is the whole of the centre
column.

**The bands.** Two, and each is a band because of what it holds rather than where it sits:

- `div.copilotPreview__container` — measured to contain, in one element: the greeting
  ("Good evening, flazouh!"), the Preview chip, the ask box, and the Agent / Create issue /
  Write code / Git / Pull requests buttons. Five separate complaints in the Problem
  Statement are all this one element. It is inside the region, so taking the region takes it
  — the band is worth naming anyway, for the soft gate and for the case where a reader keeps
  GitHub's lists but not their chat.
- `aside.feed-left-sidebar[aria-label="Account"]` — outside `main`, 320 wide, holding the
  account switcher, the Home and Feed links, and `nav[data-testid="dashboard-repositories"]`
  ("Top repositories", ten of them, then "Show more"). This is what the Rail replaces, and
  it is the reason the Rail cannot simply be rendered inside the region.

  This one had to be narrowed, and `/feed` is why. That page carries the same aside to the
  attribute — GitHub named this page's furniture after the feed rather than the other way
  round — so a rule naming it plainly would take the feed's own sidebar off the screen for
  as long as GitHub took to answer a press of Home. It is proved against the region
  instead: `div.feed-background:has(#dashboard.dashboard) aside.feed-left-sidebar[…]`.
  `/feed` is `dashboard_feed#show`, names its column `div#feed.dashboard`, and carries
  neither `#dashboard.dashboard` nor the Copilot container — so the proof is false there
  and true here. Its own contents, for whenever that page is worth taking too, are
  `main.flex-1 > div#feed.dashboard > div.news > feed-container`.

`react-partial[partial-name="dashboard-lists"]`, 680x629, holds both of their lists — one
`DashboardListView` for pull requests, one for issues. Worth knowing precisely because it is
the module this spec's Courts stand in for, and because their own markup confirms the two
kinds already share a column.

**The soft gate** keys on `meta[name="route-controller"]="dashboard"` with
`route-action="index"`, or on `div#dashboard.dashboard` in the DOM. Both are true of this
page and no other, which is what a gate on the site's most soft-navigated address needs.

One measured precondition for anyone re-running the probe: every module here hydrates from a
painted frame. In a window the operating system is not showing, all of them sit at "Loading",
`visibilityState` stays `hidden` even for the active tab, and every box measures 0x0 —
faking the flag does not help, because the wait is on paint. The probe now says so and stops
rather than printing a page of zeroes.

The Rail is not part of any `Place`. It is rendered by our own screens, inside our own
container, so it needs no region of GitHub's and cannot be broken by their layout moving.

### Data access

Three reads, in the order they are worth building:

**Repositories, derived, no new request.** Every row the shelves already return names a
repository, so the first Rail list is built from `workingSet(shelf)` reads that
`src/app/workingSet.ts` already makes, plus a pin set held locally. This is exactly the
"repositories I am working in" list GitHub cannot produce, and it costs nothing. Its
limitation is honest and known: a repository where the Participant has no Involved Pull
Request is invisible until the next read exists.

**Repositories, real.** A `repositories` method on `GitHubGateway` — the port has no
repository read of any kind today; every method there is a pull request, a commit, a search,
a shelf or a portrait. Needed for repositories with no open pull request, and for ranking by
last push.

**Activity.** `GET /users/{login}/received_events/public` returns the chronological feed in
one request. Verified against a live account: 60 events came back, 41 of them pushes and 14
stars, which both confirms that pushes are available — the thing
[#173638](https://github.com/orgs/community/discussions/173638) is about — and confirms the
noise the grouping rule exists for. One measured caveat: the public variant's push payload
carries `ref`, `head` and `before` only, with no commit array and no size, so commit
subjects need either the authenticated variant of the same route or a follow-up read per
push. Establish which before designing the row.

All three go behind the gateway seam in the domain's own words, as everything else does, and
all three are kept the way pull requests are kept, so Home renders from the last read before
any request lands.

### Behaviour

Ranking is by Court, then by whose move it is longest overdue — never by last update, which
is the rule that puts 2016 at the top of GitHub's version.

Dismissal is stored per row with the activity mark it was dismissed at, so "until there is
new activity" is a comparison rather than a timer. It reuses the shape of `Dismissal` in
`CONTEXT.md` rather than inventing a second word for the same act.

Arrangement — section order, collapsed sections, Rail width, the Destination Home lands on,
the mixed-or-separate choice for issues, organisation scope — is one settings record,
written by direct manipulation on the page rather than by a preferences dialog, and stored
where the existing settings are.

Density reuses the measured fixed tracks already in `src/ui/WorkingSet.tsx`. Row actions are
always rendered rather than revealed on hover.

### Keyboard

`g d` stays the Working Set, because Participants already press it and said so. `g r` for
Repositories, `g f` for Activity, `g h` for Home. The Rail's filter takes focus from `/`,
and `cmd+K` opens the same filter as a palette over any repository or Involved item — worth
doing well, since GitHub is deprecating their command palette behind a feature preview and
the complaint about it is listed at 405 in their own discussion search.

## Testing Decisions

The seam is `GitHubGateway`, as it is everywhere else: Home, the Rail and the three
Destinations are exercised as real code against a fake gateway Layer, and no test asserts
how anything was computed.

Behaviour tests carry the weight, one per story that can fail silently: an empty Working Set
shows repositories and activity rather than a box; a dismissed row stays gone until its
activity mark moves; a Court holds Involved Issues when mixed and not when separate; the
collapsed Rail still shows counts; ranking never puts a stale item first — a fixture with a
2016 pull request in it earns its place permanently.

Pure tests cover the two new rules: Court assignment for an Involved Issue, and Activity
grouping, including the fourteen-stars case measured above.

A contract test records `received_events` and decodes it with the same `Schema` production
uses, so the thin push payload becoming thinner is a failing build rather than an empty row.

## Out of Scope

- Rebuilding GitHub's ranked "For You" feed. Activity is chronological; the ranked version
  is the thing four discussions ask them to undo.
- Fixing GitHub's own feed staleness. Four discussions report a frozen feed; it is their
  backend and not reachable from here.
- The notifications inbox. A real problem with its own crop of tools shipped this year, and
  a different product surface.
- Discussions as a Destination or a Court member. Asked for once, at 2 upvotes; issues come
  first and Discussions can follow the same rule if they earn it.
- Mobile web. This is a desktop extension; the responsive complaints are about GitHub's
  mobile site.
- Repository grouping into folders or subgroups, asked for since 2019. Pins cover most of
  it; nesting is a later question.
- Taking over `/owner/repo` itself. Named here only because the Rail makes it the obvious
  next page, and it needs its own spec.

## Evidence

Every claim above, with what it is worth and whether this spec answers it. Counts are from
[#177902](https://github.com/orgs/community/discussions/177902) unless stated.

| Complaint | Weight | Answer here |
| --- | --- | --- |
| Chat box not optional | 200 upvotes, 108 👍 | Never rendered |
| Greeting | 86 upvotes | Never rendered |
| Changelog cards displaced repositories | 222 upvotes, 142 👍 | No promoted content; repositories are a Destination |
| Feed wanted on Home, and by default | 146 + 57 + 34 + 8 | Activity below the work; Home's landing is a choice |
| Stale items first (2016, 2017) | 34, and 8 👍 | Ranked by Court, aged out |
| No way to hide a row | 17 upvotes | Dismissal until new activity |
| Padding too large | 34 upvotes | Measured tracks |
| Sections cannot be reordered or removed | 33, and 2 | Drag and collapse, remembered |
| Two taps to a repository | thread | Rail, on every screen |
| Repository search covers recent only | Hacker News | Filter over every repository |
| Six-pin limit | [#28350](https://github.com/orgs/community/discussions/28350) | No limit |
| Repositories duplicated in sidebar and hamburger | 36 upvotes | One Rail, no drawer |
| Hover-only row actions | 11 upvotes | Always rendered |
| Sidebar recent activity lost | 11 👍 | Courts and counts in the Rail |
| Issues hard to find | [#131070](https://github.com/orgs/community/discussions/131070) | Involved Issues in Courts |
| No New-repository button | 2 asks | Create action in the Rail |
| Organisation-specific home | 2 asks | Organisation scope |
| Command palette deprecation | listed at 405 | `cmd+K` over repositories and Involved items |
| Feed lost commits | [#173638](https://github.com/orgs/community/discussions/173638) | Pushes included |
| Feed is algorithmic | "give me the chronological order" | Never ranked |

## Further Notes

**This widens the vision, and `CONTEXT.md` should say so before any of it is built.** That
document reads "Make the work around a pull request as good as it can be… That is the whole
of it", and the sibling spec puts "repository home… issues, search" explicitly out of scope.
Home, Involved Issues and Activity cross that line. The line is worth crossing — the page
being replaced is the one every session starts on, and a Participant cannot reach a
well-made pull request screen through a page that wastes their first ten seconds — but it
should be crossed on purpose, in writing, with the four words above added to the vocabulary.

One thing is still unknown, and it is cheap to settle: whether the authenticated
`received_events` route carries commit subjects, which decides whether an Activity push row
can name what was pushed or only that something was.

The DOM is no longer among the unknowns. `scripts/probe-home-dom.js` has been run against a
live signed-in dashboard and the selectors above are measured, including the finding that
one element carries the greeting, the chat box and the five action buttons together.

One risk worth naming: Home is the page GitHub is actively rebuilding. The preview it is
being taken from shipped this year and is still changing, so the probe should be re-run and
the gate re-measured on a schedule rather than once — the 587 ms lesson from the repository
list was the cost of assuming a region was stable.
