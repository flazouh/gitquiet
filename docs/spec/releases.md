# Spec: Releases

Status: draft-for-review. Nothing is built. The vocabulary is proposed in the Language
section below and is not yet in `CONTEXT.md`.

Covers one address: `/{owner}/{repo}/releases`. The worked example is
[zeronsh/comet](https://github.com/zeronsh/comet/releases), 67 releases published in 23 days,
read live on 2026-08-14. Two more repositories were read the same day where comet cannot show
a fault it does not have: [vercel/next.js](https://github.com/vercel/next.js/releases) for
pre-releases and [oven-sh/bun](https://github.com/oven-sh/bun/releases) for long notes.

## Problem Statement

Every other page this extension replaces is read by a developer. This one is not. It is the
page a person lands on when a piece of software told them there was an update, and the
loudest complaint about it does not come from maintainers at all. It comes from people who
cannot work out where the download is, or which of six files to take.

### The top complaint is that the page cannot be found, or chosen from

The most upvoted thing anybody has ever written about this page is a r/LifeProTips post at
3,293 points whose entire content is where the button is: "If you ever need to download an
obscure software from github, you're looking for the 'releases' tab", and then a correction,
"releases *section*. It's not a tab."
([r/LifeProTips](https://www.reddit.com/r/LifeProTips/comments/1th0pvw/lpt_if_you_ever_need_to_download_an_obscure/))
The replies are not from beginners:

- "Every year or so I have to download something off github and every single time have to
  spend a few minutes trying to remember this lmao" (432 points)
- "I'm a software engineer with a CS degree and I took UI classes. I 100% blame GitHub for
  their shitty UI on this one (and I think most of their stuff is good)." (107 points)
- "I wish they'd make the ui more intuitive. Struggling to find the latest release shouldn't
  be this much of a shared problem." (43 points)

On r/github the same complaint runs at
[13,455 points](https://www.reddit.com/r/github/comments/1at9br4/i_am_new_to_github_and_i_have_lots_to_say/)
and [405](https://www.reddit.com/r/github/comments/16kcnbb/why_is_github_so_shitly_designed/).
A thread at 242 points asks where the download button is and gets the phrase twice: "it's like
a scavenger hunt for the download button", and "Absolutely, Scavenger Hunt is the best
description. It's usually easier to find the source code than it is to actually download a
compiled executable."
([r/github](https://www.reddit.com/r/github/comments/hete4q/where_is_the_actual_download_button_on_github/))

Choosing between the files is the second half of it. A user asked how to run TaskbarX because
"I only see these files, none are .exe", tried the x64 zip, and reported "I extracted it and
still couldn't find anything"
([r/github](https://www.reddit.com/r/github/comments/179kyab/how_can_i_download_and_run_taskbarx_i_only_see/)).

### Sixty-seven Versions described sixty Changes, and thirty said nothing

Counted over all 67 releases of `zeronsh/comet`, read through GitHub's own API on 2026-08-14:

| Measure | Value |
| --- | --- |
| Releases published, 2026-07-22 to 2026-08-14 | 67 |
| Releases whose entire notes are `**Full Changelog**: <compare url>` | 30, so 44% |
| Distinct merged pull requests those 67 releases name between them | 60 |
| Author of the release, all 67 times | `github-actions[bot]` |
| People who wrote the 60 Changes | 8 |

So the ratio is 67 records to 60 facts, and nearly half the records carry no fact at all.
GitHub draws each of the 67 as a card with a version heading, a bot avatar, a date, a notes
block and a disclosure for the files. Thirty of those cards are a heading over a link to a
comparison. This is the same shape the Actions spec found and answered: 25 Runs described 10
Strands, so the listed unit stopped being the Run. Here the listed unit stops being the
release.

The 60 Changes are also the only part a reader can act on, because they are pull request
titles with an author and a number: "Seamless local to synced switch with one-time import
wizard by @wingleeio in #79". The bot that published the release is on screen 67 times and is
never the answer to anything.

### The files are not on the page at all

Read live, `/{owner}/{repo}/releases` for comet is 389,330 bytes of HTML for 10 releases and
contains **zero** asset filenames. Every file list sits behind an `include-fragment` element
pointing at `/{owner}/{repo}/releases/expanded_assets/{tag}`. There are 21 such elements on
the page, 10 for the file lists and 10 for the tag ref pickers.

So the page whose top complaint is "which file do I download" ships 380KB without naming a
single file, and then asks the browser for more. Fetching one fragment costs another 20,807
bytes and answers for one release. The complaint that this is deliberate is four years old and
still accurate: "Github also seems to be hiding their 'Assets' (binaries et al) on the
'/releases' page for some projects behind javascript"
([Hacker News 37351016](https://news.ycombinator.com/item?id=37351016)). The 21 spinners are
also why the page does not settle: "the releases index page keeps Chrome busy indefinitely
after load, even with the tab idle"
([#202458](https://github.com/orgs/community/discussions/202458)).

What the fragment does carry is better than expected, and is the whole answer to the reader's
question. For v0.2.1 it names four files, each with a size and a `sha256:` digest, and then
appends two archives nobody uploaded:

```
zeron-0.2.1-linux-aarch64.tar.gz    sha256:1129c7ea…  25.9 MB
zeron-0.2.1-linux-x86_64.tar.gz     sha256:8c8e5fac…  27 MB
zeron-0.2.1-macos-arm64-app.tar.gz  sha256:bcb3dbac…  19.5 MB
zeron-0.2.1-macos-arm64.dmg         sha256:34e2b38f…  23.8 MB
Source code (zip)
Source code (tar.gz)
```

Those last two are the fourth-biggest complaint about this page,
[#6003](https://github.com/orgs/community/discussions/6003) at 143 upvotes, and curl's
maintainer says exactly what they cost: "GitHub still adds the auto-generates ones at the
bottom which then misleads some users pick those instead of the 'real' release files listed
just above". libusb writes a warning into the body of every release as a workaround.

### The download counts say only one file was ever wanted

GitHub's API reports a count per file. Summed over all 67 releases of comet:

| File | Downloads | Releases where it was never downloaded once |
| --- | --- | --- |
| `macos-arm64.dmg` | 186 | 33 of 67 |
| `linux-x86_64.tar.gz` | 21 | 57 of 67 |
| `macos-arm64-app.tar.gz` | 11 | 58 of 66 |
| `linux-aarch64.tar.gz` | 5 | 62 of 67 |

One file took 83% of all 223 downloads. The page gives all four the same weight, plus two
source archives above them in nobody's interest, and hides all six behind a disclosure. A
reader on an Apple silicon Mac has one correct answer out of six and has to know what `arm64`,
`aarch64`, `x86_64`, `dmg` and `-app.tar.gz` mean to find it.

The filename is also not stable. Comet's binaries are named `comet-*` up to v0.1.61 and
`zeron-*` from v0.1.62, so a reader who has done this before and knows what to look for is
looking for the wrong word.

### Eighty-nine of next.js's newest hundred entries are pre-releases

Comet publishes no pre-releases, so it cannot show the single most requested change to this
page. `vercel/next.js` can. Read on 2026-08-14 over its newest 100 releases:

- 89 of the 100 are pre-releases.
- Page one is `v16.3.1` and then `v16.3.1-canary.10` through `.18`, so 9 of 10 rows are
  canaries. The page's HTML carries 18 "Pre-release" labels.
- Reaching the newest **five** stable releases means reading 33 entries, which is four pages
  and roughly 2.2MB of HTML.
- The longest unbroken run of pre-releases in those 100 is 26.
- Those five stable tags are `v16.3.1`, `v15.5.23`, `v16.3.0`, `v16.2.12`, `v15.5.22`, so they
  are not even one sequence: two supported major lines are interleaved with no marking.

The request to separate them is the most upvoted complaint about releases anywhere:
[#4993](https://github.com/orgs/community/discussions/4993), 385 upvotes, "I really don't want
4 canary builds a day I just want to know when stable changes". Then
[#18659](https://github.com/orgs/community/discussions/18659) at 57, "it is hard for a
'normal' user to find the stable releases on /releases", and
[#6108](https://github.com/orgs/community/discussions/6108) at 38, whose author names this
exact repository: "I was trying to check the next.js release notes for recent stable release,
but got overwhelmed by scrolling past 50 pre-releases".

A search qualifier `prerelease:false` exists, and the reply to it in that thread is the point:
"this doesn't really help because it's a hidden feature that nobody knows about. it should be
a toggle in the UI." GitHub declined the list filter in 2021: "at this time this is not
something we are going to be exploring"
([#5962](https://github.com/orgs/community/discussions/5962)).

### The notes are already on the page, and CSS hides them

The 2021 refresh cut long notes with a "Read more" link, and eight separate people in
[#5962](https://github.com/orgs/community/discussions/5962) said the cut misleads them:

- "The truncated changelogs in the new UI can be very misleading; for example if it cuts after
  a bullet point, it looks like that's the end of the changelog, and the 'Read more' link is
  not very obvious."
- "on one of the first packages I opened after enabling the new view, I thought the 3-4 bullet
  points I saw was the complete release note."
- "The truncated notes prevent users from scanning or searching the changelog for keywords
  they're interested in, it makes big important releases look the same as little, patch
  releases"

Measured, the truncation costs nothing to undo. `oven-sh/bun`'s list page carries a 3,719
character notes body in the HTML, in full, and `vercel/next.js` carries 2,699. Neither
document contains the string "Read more". The notes are complete in the markup and hidden with
an `overflow-hidden` rule. A screen that draws what GitHub already sent answers this complaint
with no request and no parsing beyond what it does anyway.

### The workaround economy

Three command line tools exist whose whole purpose is choosing a file from this page for you:
[eget](https://github.com/zyedidia/eget) at 2,054 stars, whose pitch is "Tired of Clicking
GitHub Release? … No more manually browsing Release pages, matching system architectures, or
moving files around"; [ubi](https://github.com/houseabsolute/ubi), "The Universal Binary
Installer", at 588; and [dra](https://github.com/devmatteini/dra) at 351. A Chrome extension,
[GitHub Easy Download](https://chromewebstore.google.com/detail/github-easy-download/cgoeagdnkiodnaokmjelgfpkgklikdnf),
adds a single button that picks the file for your platform. Someone built a website for it and
posted it to r/coolgithubprojects: "Everyone just wants one download button for whatever
they're trying to install."

[Refined GitHub](https://github.com/refined-github/refined-github) carries ten separate
release features, which is the cleanest available map of what is missing: a "Hide
pre-releases" filter, a download count per file, a link to the changes since the previous tag
on every entry, a search over tags, and a "you are not on the latest version" notice.

## Language

`CONTEXT.md` has no word for anything on this page. These are proposed, and go in that file
before the first line of code, per its Language section.

**Version**: one entry of the releases list: a tag, notes about what changed, and the files
attached to it. GitHub calls all three of those a release, and also calls the act of
publishing one a release, which is [#5447](https://github.com/orgs/community/discussions/5447)
at 85 upvotes and half of why a repository can hold 365 tags under the words "There aren't any
releases here".
_Avoid_: release, tag, version number

**Change**: one thing that changed in a Version, as a person would say it: the pull request's
title, who wrote it, and its number. This is the unit the releases screen lists, in place of
the Version, because 67 Versions of `zeronsh/comet` described 60 Changes and 30 of the 67
described none.
_Avoid_: release note, changelog entry, commit, bullet

**Bare**: a Version whose notes name no Change, which is what GitHub's generated notes produce
when nothing landed through a pull request. Forty-four percent of the worked example. A Bare
Version is a line, never a card, because there is nothing on it to read.
_Avoid_: empty release, no-op release, patch release

**Build**: one file attached to a Version, and the platform it runs on, read out of its
filename. Carries a size and a `sha256:` digest, because GitHub's own fragment carries both.
_Avoid_: asset, artifact, binary, download, release asset

**Yours**: the Build matching the reader's own operating system and processor. One row, at the
top, resolved before the reader asks. This is the answer to the 3,293-point post and to the
three command line tools.
_Avoid_: recommended, suggested download, your platform, best match

**Source Archive**: the zip and the tarball GitHub attaches to every Version, which nobody
uploaded and nobody can remove. Never a Build, never Yours, and drawn below the Builds rather
than above them.
_Avoid_: source code zip, auto-generated asset

**Pre-release** is kept verbatim. GitHub's word is exact, readers use it, and the flag it
comes from is on the record. Nothing here renames it.

## Solution

Five principles fall out of the problem.

1. **The unit of the list is not the Version.** Sixty-seven cards described sixty Changes. The
   screen lists Changes, with the Version beside them as a marker.
2. **The download is a decision, and the screen makes it.** One row, one file, matched to the
   reader's machine, named and sized, before any disclosure. Five wrong answers do not get
   equal billing with the right one.
3. **A Bare Version is a line.** Nothing to read means no card. Thirty of comet's 67 collapse
   into thin markers between the Changes that surround them.
4. **Notes are shown whole.** GitHub already sends them whole. The truncation is a CSS rule
   and this screen does not carry it over.
5. **Pre-releases are separable in one press, and the press is remembered.** It is the most
   upvoted request about this page, GitHub declined it, and settings are already kept per
   Participant and per repository.

### The screen

**Yours comes first.** The top of the screen is one row: the reader's platform in words, the
Build that matches it, its size, and a press that downloads it. On an Apple silicon Mac
reading comet that row is `zeron-0.2.1-macos-arm64.dmg`, 23.8 MB, with its digest available.
The other Builds of the newest Version are behind one disclosure, counted. Source Archives sit
under them, named as what they are.

**Then the Changes, as one list.** Every Change is a row: its title, its author, its pull
request number, and the Version it arrived in. The rows run newest first and do not break into
cards at Version boundaries. A reader scanning for the thing that affects them reads titles
and nothing else. On comet that list is 60 rows, from 67 Versions, over 8 people.

**Bare Versions are markers, not rows.** Between Changes, the Versions that named none appear
as a single thin line carrying their tags: `v0.1.63, v0.1.64 no notes`. Consecutive ones join.
Thirty cards become a handful of lines.

**Pre-releases are one press away from gone.** A Version GitHub flagged is drawn with the word
and can be put out of sight, and the decision is kept the way Put Away is kept on the Actions
screen. With them gone, next.js's first screen is five stable Versions instead of one, and the
two major lines it maintains stop being interleaved silently.

**Standing, not a summary.** One line says how many Versions the repository has, when the
newest landed, and how many are pre-releases. It is a line because none of it is the question
anybody came with.

### What the screen does not do

Their search box stays theirs for now. It is a real complaint,
[#204071](https://github.com/orgs/community/discussions/204071), "If I enter 'v3.5' I expect
to see releases from the 3.5 minor version", and answering it properly means holding every
Version rather than the first page. Their paging stays theirs too: this reads page one, which
is the page their releases tab opens with. `/{owner}/{repo}/tags` and
`/{owner}/{repo}/releases/tag/{tag}` are separate addresses and are not covered.

## Implementation Decisions

### The place

Read on 2026-08-14, the releases list is a server-rendered Turbo page with `react-partial`
islands. It has `#repo-content-pjax-container`, it has `turbo-frame#repo-content-turbo-frame`,
and it has no `react-app`. So the regions and the fallback are the ones `ACTIONS` already uses
in `src/ui/place.ts`, and the soft gate waits on the frame rather than on a React app name.
The two `react-partial.embeddedData` payloads on the page carry `docsUrl` and the logged-out
header configuration, so neither is a data source.

### Data access

One HTML fetch of the list page carries everything except the files. The files cost one more
fetch, and only the newest Version needs them, because Yours is about the newest Version.

| Want | Source |
| --- | --- |
| Every Version on page one: tag, title, date, author, pre-release flag | the list page HTML, 10 per page |
| Every Change: title, author, pull request number | the `markdown-body` block of each Version, complete and untruncated |
| Whether a Version is Bare | its `markdown-body` naming no pull request |
| Builds of one Version: name, size, `sha256:` digest, download URL | `/{owner}/{repo}/releases/expanded_assets/{tag}`, roughly 21KB |
| Source Archives | the same fragment, `/archive/refs/tags/` links at its end |
| Paging | `/{owner}/{repo}/releases?page=N` |

Two consequences worth stating plainly. First, drawing the whole screen for the newest Version
costs two requests, and GitHub's own page costs eleven to show the same thing. Second, the
per-file download count is not in the fragment when it is read without write access, so the
counts in the Problem Statement above came from the API and this screen cannot show them on
the extension. That is
[#200055](https://github.com/orgs/community/discussions/200055) as GitHub shipped it, and
`desktop/` reaching the documented API with a token is not under the same limit.

### Matching a Build to the reader's machine

Yours is a filename match, and filenames are a convention rather than a contract. The reader's
side comes from `navigator.userAgentData` where the browser offers it, with `navigator.platform`
and the user agent string behind it, which gives the pair the match needs: an operating system
and a processor family. The Build side is read out of the filename, and comet is the ordinary
case: `macos`, `linux`, `arm64`, `aarch64`, `x86_64`, `.dmg`, `.tar.gz`.

The rule that matters is what happens when the match is not certain. A wrong file is worse than
no answer, because a wrong file is what the r/github threads above are made of. So a match is
drawn as Yours only when exactly one Build agrees on both the operating system and the
processor. Where none agrees, or more than one does, the row says so and shows every Build
named by platform instead of guessing. `zeron-0.2.1-macos-arm64.dmg` and
`zeron-0.2.1-macos-arm64-app.tar.gz` are that case on the worked example: two Builds, one
platform, and the download counts say the reader wants the first, which is a preference for the
installer over the archive and not a fact about the platform.

## Open questions

- **Tracks.** next.js's newest five stable tags are `v16.3.1`, `v15.5.23`, `v16.3.0`,
  `v16.2.12` and `v15.5.22`, which is two supported major lines interleaved, and Apache Airflow
  mixes `airflow`, `helm-chart/X.y.z` and `airflow-ctl/X.y.z` in one list
  ([#200055](https://github.com/orgs/community/discussions/200055)). Grouping those needs a word
  and a rule, and "Line" collides with Strand, which `CONTEXT.md` defines as one line of work.
- **What the reader is running.** Every complaint about finding an old version, and the whole
  value of a changelog, turns on "which one do I have". The page cannot know. Whether a reader
  can tell this screen, and whether that is worth a stored value, is undecided.
- **How deep to read.** Page one is 10 Versions, and comet's 67 are 7 pages. "What changed
  since the version I have" is a question page one answers only for a recent reader. Reading
  further costs roughly half a megabyte per page.
- **Sort order.** Releases come back in an order that mixes SemVer, PEP 440 and alphabetical
  fallback, which is [#8226](https://github.com/orgs/community/discussions/8226) at 84 upvotes:
  "I can't really make sense of what's it's trying to do". Whether this screen sorts by date
  and overrides them is undecided, and Stack Overflow's own report in that thread is that their
  newest release was not at the top.
- **Provenance.** [#190971](https://github.com/orgs/community/discussions/190971) asks for a
  badge on attested Builds and
  [#16426](https://github.com/orgs/community/discussions/16426), at 58 upvotes, asks for
  checksums. The fragment already carries a `sha256:` digest per Build, so the second is nearly
  free. Attestation is not on the page.

## Evidence

Upvote counts read live on 2026-08-14 from each discussion's own upvote button. Measurements
read the same day.

| Complaint | Weight |
| --- | --- |
| Cannot subscribe to releases without pre-releases | [#4993](https://github.com/orgs/community/discussions/4993), 385 upvotes, 27 comments |
| Auto-generated source archives cannot be disabled | [#6003](https://github.com/orgs/community/discussions/6003), 143 upvotes, 44 comments |
| A release cannot be dated to its tag | [#5447](https://github.com/orgs/community/discussions/5447), 85 upvotes, 16 comments |
| Releases come back out of order | [#8226](https://github.com/orgs/community/discussions/8226), 84 upvotes, 55 comments |
| No automatic, consistent checksums | [#16426](https://github.com/orgs/community/discussions/16426), 58 upvotes, 7 comments |
| Pre-releases cannot be hidden from the list | [#18659](https://github.com/orgs/community/discussions/18659), 57 upvotes |
| No filter between pre-release and release | [#6108](https://github.com/orgs/community/discussions/6108), 38 upvotes |
| "Commits since this Release" link removed | [#201116](https://github.com/orgs/community/discussions/201116), 20 upvotes, restored 2026-08-07 |
| Notes truncated, "Read more" missed | [#5962](https://github.com/orgs/community/discussions/5962), 8 distinct people |
| Search matches the notes body, so a version cannot be found | [#204071](https://github.com/orgs/community/discussions/204071) and [#200055](https://github.com/orgs/community/discussions/200055) |
| Download counts shown only to users with write access | [#200055](https://github.com/orgs/community/discussions/200055) |
| No provenance indicator on an attested file | [#190971](https://github.com/orgs/community/discussions/190971) |
| The page never stops re-rendering while idle | [#202458](https://github.com/orgs/community/discussions/202458) |
| Where the download is, as the top-voted advice about GitHub | [r/LifeProTips](https://www.reddit.com/r/LifeProTips/comments/1th0pvw/lpt_if_you_ever_need_to_download_an_obscure/), 3,293 points |
| "scavenger hunt for the download button" | [r/github](https://www.reddit.com/r/github/comments/hete4q/where_is_the_actual_download_button_on_github/), 242 points |
| Cannot tell which file to take | [r/github](https://www.reddit.com/r/github/comments/179kyab/how_can_i_download_and_run_taskbarx_i_only_see/) |
| Files hidden behind JavaScript on the list page | [Hacker News 37351016](https://news.ycombinator.com/item?id=37351016) |
| Three CLIs and a Chrome extension exist to pick the file for you | eget 2,054 stars, ubi 588, dra 351, GitHub Easy Download |
| 67 releases in 23 days describe 60 changes | measured, `zeronsh/comet`, API |
| 30 of 67 releases carry no changes at all | measured, `zeronsh/comet`, API |
| All 67 releases authored by `github-actions[bot]` | measured, `zeronsh/comet`, API |
| One file takes 83% of 223 downloads | measured, `zeronsh/comet`, API |
| `linux-aarch64` never downloaded in 62 of 67 releases | measured, `zeronsh/comet`, API |
| Binary renamed `comet` to `zeron` at v0.1.62 | measured, `zeronsh/comet`, API |
| 389,330 bytes of HTML for 10 releases, zero filenames in it | measured, `zeronsh/comet` |
| 21 `include-fragment` elements on one list page | measured, `zeronsh/comet` |
| One file list costs 20,807 more bytes | measured, `expanded_assets/v0.2.1` |
| Notes arrive complete in the HTML: 3,719 characters, no "Read more" | measured, `oven-sh/bun` |
| 89 of the newest 100 releases are pre-releases | measured, `vercel/next.js`, API |
| 9 of 10 rows on page one are canaries | measured, `vercel/next.js` |
| Four pages to reach the newest five stable releases | measured, `vercel/next.js`, API |
| 26 pre-releases in an unbroken run | measured, `vercel/next.js`, API |

## Further Notes

**This widens the vision a fifth time.** `CONTEXT.md` reads "Make the work around a pull
request as good as it can be… That is the whole of it", and the Actions spec already recorded
that Home, Involved Issues, Activity and Actions sit outside that line. Releases sits further
outside than any of them, because its reader is often not a developer and has no pull request
in view. The sentence should move on purpose, in writing, and this page is the strongest
argument for moving it: the Changes on this screen are pull request titles, so the page is
made of pull requests even when its reader has never opened one.

**Comet is a good worked example for a reason worth naming.** It publishes three releases a
day, mostly by bot, mostly with nothing to say, and its own product is an interface over an
agent. It is the shape a lot of 2026 repositories now have, and GitHub's page was designed for
a repository that ships once a month.
