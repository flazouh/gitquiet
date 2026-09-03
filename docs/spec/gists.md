# Spec: Gists

Status: built, and since rebuilt as screens rather than as additions to GitHub's page — see
`plans/007-give-the-gists-a-screen.md` for why that changed and what it cost. All four pain
points in the research are answered, all three Open Questions are closed, and two more gaps
found in a later sweep are answered as well. Verified live on a real account. The vocabulary
below is in `CONTEXT.md`. Evidence is in the notes repository's `research/gist-pain-points.md`,
five sweeps across Hacker News, Reddit, GitHub Community discussions, and thirteen years of
third-party tooling.

Covers `gist.github.com`, a different host from `github.com`. Two slices, in the order they
ship: the secret/private warning first, because it is small and answers a safety complaint
rather than a convenience one; organizing and searching a reader's own gists second, because it
is the larger build and the one every other slice's evidence agrees is the biggest gap.

## Why this was a different kind of page, and no longer is

Every other screen this extension draws stands on a React application GitHub built in the last
few years — `code-view`, `pull-requests`, `issues-react` — and takes over a region of it, hiding
what GitHub drew and putting its own in the same place. `gist.github.com`, read live on
2026-09-02, has no `react-app` anywhere on it. It is Rails-rendered with `gist-pjax-container`
and `gisthead`, the same vintage of markup the rest of GitHub left behind years ago.

This spec originally read that as a reason not to take the page: no region to take over, and a
page that is "plain, readable, and not slow". Two things have since made that argument wrong.

`plans/006-stand-on-the-body.md` established that a full-replacement screen does not need a
React application under it at all — it stands on `document.body` and hides by position. And the
host permission this spec worried about paying for is paid: `*://gist.github.com/*` is in
`host_permissions` and a content script already matches it.

What was left was the third reason, that GitHub's gist page is fine. It is fine. It is also not
this interface, and a reader who has spent the day in this one can tell. So the gist pages are
screens now, standing the way `/pulls` and `/notifications` do, and the one page that is still
GitHub's is the editor — which gets room instead. See Implementation Decisions.

## Slice 1: the secret/private warning

### Problem

"Secret" reads as "private," and it is not. A secret gist is unlisted — reachable by anyone who
has the link, indexable, and not access-controlled — and GitHub's own page says so only in a
tooltip nobody hovers over. Read live on a gist created today: the badge is
`<span class="Label" title="Only those with the link can see this gist.">Secret</span>`. The
truth is already in the markup. It is one hover away from being read.

The record of people acting on the wrong belief:

- Reddit, 2019, top comment at 16 upvotes: "A secret gist is not really private. Anyone who has
  the secret gist link has view access." A second reader the same year, after finding the
  visibility toggle gone: "You cant" make a gist private, full stop.
- Reddit, 2019, a different thread: "Once the genie is out of the bottle, you can't put it
  back in... Once something secret is made public, it can't be made secret again" — the
  direction of the mistake people make is always the same one, toward believing they have more
  privacy than they do.
- Hacker News, 2022: "gists have no true 'private' mode, only 'secret' (URL-obscurity, not
  access control)," said as the thing that needed clarifying mid-thread, which means it wasn't
  obvious going in.
- Hacker News, 2025, on GitHub's secret-scanning policy reaching unlisted gists: "I wish I had
  known that there are no private github gists. Wish this was made more clear." "Calling them
  'secret' seems ambiguous at best, outright misleading at worst."

### Solution

One banner, drawn once, on a secret gist's own page: plain words above the fold saying the link
is the only thing keeping this out of a search result, with nothing else claimed and nothing
hidden behind a hover. Not drawn on a public gist, where it would say nothing anybody needs.

Read off the same `.Label` GitHub already renders — the `title` attribute is not read, because
`selectorHygiene.test.ts`'s rule against a natural-language attribute standing alone applies here
too, and because rewording a tooltip is cheaper for GitHub to ship than renaming the badge's own
text. The badge's structure (`.Label` inside the gist header) plus its own text, "Secret", is the
anchor.

## Slice 2: organize and search your own gists

### Problem

The single largest number recorded — GitHub Community discussion #7923 at 2,086 upvotes, asking
for organization-owned gists — is explicitly out of reach; it needs a GitHub backend change,
not a browser extension. The two next-largest, most corroborated gaps are both things a client
can answer.

**No organization.** Hacker News, 2012, the thread announcing GitHub's own Gist redesign:
"I was hoping that they would finally add the ability to put a gist in a folder or tag one :("
"I just wish a way to label or organize my gists. I have dozens of them." "I hope we get to see
Collections for gists, because I am finding them really unmanageable otherwise." Fourteen years
later, r/git, 2021, in answer to somebody asking: "GitHub Gists are one or more files, they do
not support folders/directories," flatly. GitHub Community discussion #13772, 54 upvotes: a
gist's own name is fixed at creation, taken from whichever file sorts first by ASCII, and cannot
be changed — so a reader with forty gists is reading forty filenames and guessing.

The market answer is the strongest signal in the whole survey: GistPad, a VS Code extension that
fakes tags through a `#tag` convention in the description because there is nothing native to
hook into, has **446,000 to 464,000 marketplace installs** — more adoption than any GitHub star
count anywhere in this research. Lepton, an Electron app for the same reason, carries 10,336
GitHub stars. Gistbox ran a paid organizer from 2013 to 2017 on the same pitch — "long-term
memory for the professional software developer" — and was folded into Cacher, which still sells
the same idea today at $9.99 to $29.99 a seat a month.

**No real search.** GitHub Community discussion #131464, 13 upvotes, 2024-07-09: the `/`
keyboard shortcut that used to focus gist search stopped working, and GitHub support's own
reply, quoted in the thread, is that the removal was intentional because "it wasn't being used
very much." Discussion #140427, the user's side of the same change: "Very frustrating that this
feature was removed... it's such a pain compared to how simple it was before." A reader with 500
gists in that same thread says GitHub's search does not index gist content at all, and built his
own local tool because of it. Hacker News, 2012: "It's always been a huge pain to search for
something you know you gisted, but can no longer find without browsing through 20 pages of
3-line excerpts" — and the reader who wrote that built a third-party search tool the same week,
which only ever searched titles, never file contents, for the same reason GitHub's own search
still doesn't.

### Language

`CONTEXT.md` has no words for anything here. These are proposed.

**Label**: a word a reader attaches to one of their own gists, kept by this extension rather than
by GitHub, because gists carry none. Not GitHub's own word — GitHub has none — chosen over "tag"
because Bot Finding already uses "Finding" for something Reason-adjacent and "tag" is a git word
this codebase keeps for a ref. A gist may carry more than one.
_Avoid_: tag, folder, category

**Named**: a gist whose own display name a reader has set, in place of the filename GitHub picked
by ASCII sort. Stored the same way a Label is, because GitHub has no field for either.
_Avoid_: renamed, titled, custom name

**Own Gists**: the set this screen reads and organizes — every gist the signed-in reader owns,
public and secret both. Not "my gists," which is GitHub's own words for the page and reads oddly
as a name for a set kept by an extension rather than by the reader inside GitHub's own UI.
_Avoid_: my gists, personal gists

### Solution

Three pieces, all client-side, all stored in the extension's own storage rather than asked of
GitHub, because GitHub has no field for any of them:

1. **A Label bar over the list.** Every Own Gist can carry one or more Labels, added from a small
   control beside each row. Labels a reader has used before are offered again rather than
   retyped. The list can be filtered to one Label at a time, which is the folder GitHub never
   built, done without pretending gists actually moved anywhere.
2. **A Name over the filename.** The same control lets a reader give a gist its own Name, shown
   in place of the ASCII-sorted filename everywhere this extension draws a row. GitHub's own
   name for the gist is untouched — this is what this extension shows, not a write back to
   GitHub, because there is no route to write a display name to.
3. **Search that reads file contents.** GitHub's own search reads titles only, confirmed live and
   in the discussions above. This extension's search reads the Own Gists list already in hand —
   description, filenames, Labels, and (for gists small enough to be worth it) the file content
   itself, fetched once and kept — and matches against all of it, not only the title.

### What this does not do

Nothing here writes to GitHub. A Label and a Name are read back by this extension and by nothing
else — not by GitHub's own page, not by another device without this extension installed, not by
anybody else looking at the same gist. That is the honest limit of a client-only answer to a
server gap, and it is said here so the difference from what GistPad or Cacher do (their own
servers, their own sync) is not accidentally implied.

Gist creation and editing are untouched. The editor-is-too-small complaint (Reddit, 23 points:
"the display I would expect it to take the full width least and be much taller") is real and
recorded in the notes repository's `research/gist-pain-points.md`, but it is a different surface — the create/edit flow
rather than the list — and is not in this slice.

## Implementation Decisions

### A second, smaller content script

`src/entrypoints/gist.content.tsx` is matched only to `*://gist.github.com/*` and is the small
shell that stands these screens. Separate from `shell.content.ts`, which carries press routing,
reading ahead and prepared screens for a site this one does not have.

It uses `mount.ts` and `shell/screen.tsx`, which the first version of this spec ruled out. What
it still never imports is `place.ts`: that module is `github.com`'s router, where `/{owner}`
names a person and here it names a gist list. The Places live in `src/ui/gistPlace.ts` instead,
and both stand on `body` — the full-replacement kind, per `plans/006`.

### Addressing

Four addresses, read by domain parsers the same shape as `blameIn` and `repoHomeIn`, all
host-gated to `gist.github.com` rather than `github.com`:

- `gistListIn(url)` for `/{owner}` and `/{owner}?page={n}` — a reader's Own Gists.
- `gistViewIn(url)` for `/{owner}/{gistId}` — one gist. A third segment is one of their own
  sub-pages, forks or revisions, and stays theirs.
- `isGistStarred(url)` for `/starred`.
- `isGistEditing(url)` for `/` and `/{owner}/{gistId}/edit` — the two forms, which get a
  stylesheet and no screen.

### Reading the list whole

`readOwnGists` follows their own "Older" link and holds every page, to a depth of thirty. The
page the reader is already on is not re-fetched: the content script is running in it. A page
that fails keeps what came before it and the screen says the list is short, because a list
quietly missing its oldest gists is a search that quietly says no about a gist the reader is
sure they wrote.

This is what answers "browsing through 20 pages of 3-line excerpts", and it is what makes every
filter on the screen mean what it says.

### Their editor gets room, not a screen

The two forms are forms, and GitHub already knows how to post them. Rebuilding one would mean
owning gist creation, which is a write with no route this extension has any business inventing
a second way to make. `src/ui/gistEditing.css` only changes how much of the window their own
form may use: measured live in a 1256 by 888 window, their editor is 978 by 322 and becomes
1222 by 577.

The same reasoning keeps Edit, Delete, Star and Fork as links to GitHub's own pages on the gist
screen. Every one of them is a write.

### Where a Label and a Name live

`storage.sync`, keyed by gist id, the same storage settings already use — so a Label set on one
machine is there on the next, the same promise `storage.sync` already makes for display
settings. Not `storage.local`: a Label is worth carrying between machines the way a display
setting is, and is small — a handful of words per gist, not the hundred-kilobyte payloads
`unlimitedStorage` exists for.

### Search over file content

Reading every Own Gist's every file's content is a request per gist, which is one request per
row on a list that may run into the hundreds — the reader with 500 gists from the Community
thread is the worked case this has to answer for. Read lazily, the first time a search is typed
rather than on every visit to the list, and kept once read: a gist's content does not change
without a new revision, so a second search moments later costs nothing more.

## Open Questions, all three now closed

- **How to write and read a Label's control.** Settled as an inline editor folded behind
  "Label / name…" on each row, with a `datalist` of every Label this reader has used before, so
  one typed once is not typed twice.
- **Pagination depth.** Settled as every page, to a bound of thirty. See "Reading the list
  whole" above.
- **Starred gists.** Settled: `/starred` serves the same `.gist-snippet` rows and the same pager
  as a reader's own list, so the same reader and the same screen answer it. It never calls them
  "your gists".

## Considered and not built

- **Bulk delete.** A real gap with real evidence — a whole webapp (`gist-cleaner`) exists for
  it, and at least five "delete all your gists" scripts are themselves published as gists. Not
  built, for the reason the editor is not rebuilt: it is a write, and this extension does not
  invent second routes for writes. The client-side half of the complaint is finding the junk,
  and that is what search, Labels and the five orders are for.
- **Sort by creation date**, asked for in `isaacs/github#582`. Their row prints one date and
  which date it is depends on the sort their page was already serving, so honouring it would be
  a list that silently reorders itself into a lie.
- **Image paste in the editor, pull requests on gists, org-owned gists.** All three need
  GitHub's server. `#7923` at 2,086 upvotes is the largest number in the whole survey and is
  still out of reach.

## Evidence

Full sweep, with every quote and URL, is the notes repository's `research/gist-pain-points.md`. Restated here only where a
number decided the scope:

| Fact | Value |
| --- | --- |
| Org-owned gists, largest number recorded, out of reach | GitHub Community #7923, 2,086 upvotes |
| GistPad's VS Code marketplace installs | 446,000–464,000 |
| Lepton's GitHub stars | 10,336 |
| Cannot rename a gist after creation | GitHub Community #13772, 54 upvotes |
| GitHub intentionally broke gist search's keyboard shortcut in 2024 | GitHub Community #131464, 13 upvotes |
| A reader with 500 gists built his own search tool because GitHub's does not read file content | GitHub Community #140427 |
| "Secret" read as access-controlled, and is not | Reddit, 2019, 16-upvote top comment; Hacker News, 2022 and 2025 |
