# Gist pain points, ranked by evidence

Research date: 2026-09-02. Five sweeps: Hacker News (Algolia, ~25 queries, six threads read in
full), Reddit (GooseWorks' live search API, standard web tools were domain-blocked), GitHub
Community discussions (`gh api graphql`, real `upvoteCount`, not estimated), competitor tooling
(15+ tools surveyed), and a live probe of gist.github.com's own markup.

## The architectural fact first

gist.github.com is a different host from github.com. GitQuiet's manifest grants
`host_permissions: ["*://github.com/*", ...]` and its content script matches
`*://github.com/*` — neither covers a different subdomain. Building anything here means a new
host permission and a new content-script match, which is a Chrome Web Store re-review and a
re-consent prompt for every existing user, not just a new page under an existing grant.

The page itself is also a different era of GitHub: read live on `octocat/6cad326836d38bd3a7ae`,
there is no `react-app` at all. It is Rails-rendered — `gist-pjax-container`, `gisthead`,
`gist_options-button` — the same vintage of markup the pull request pages left behind years ago.
So the pain here is not "slow virtualized rendering," the way it was on `/blob` and `/blame`. It
is neglect: a flat list, weak search, and a naming trap.

## 1. No way to organize your own gists

Every source agrees this is the biggest gap, and it is the only pain point with a decade of
competing tools built to fill it and nothing else.

- **HN, 2012, 287 points**: the thread announcing GitHub's own Gist redesign is almost entirely
  people asking for what it still didn't ship. chadscira: "I was hoping that they would finally
  add the ability to put a gist in a folder or tag one :(" farslan: "I just wish a way to label
  or organize my gists. I have dozens of them." kmfrk: "I hope we get to see Collections for
  gists, because I am finding them really unmanageable otherwise."
  (https://news.ycombinator.com/item?id=4906842)
- **Reddit, 2024**: "I create gists to save automation scripts... I can't find a way to give it a
  proper name. It randomly takes any file's name... multiple gists can have files with same
  name. So it becomes hard to find."
  (https://www.reddit.com/r/github/comments/1frnhde/how_to_edit_githubgist_title/)
- **GitHub Community #13772**, 54 upvotes: cannot rename a gist or edit its description after
  creation — the name is auto-set from the first file by ASCII sort order.
  (https://github.com/orgs/community/discussions/13772)
- **r/git, 2021**: "GitHub Gists are one or more files, they do not support
  folders/directories," flatly, in answer to someone asking.
- **Competitor tooling**, ranked by adoption: GistPad (VS Code extension) at **446,000–464,000
  marketplace installs** — the single largest adoption number in this whole survey — adds
  tag-based grouping via a `#tag` convention in the description because there is nothing native
  to hook into. Lepton (Electron app), 10,336 GitHub stars, exists for tags and language
  grouping. Gistbox, a dedicated organizer with labels and search, ran 2013–2017 and was folded
  into Cacher, a paid successor ($9.99–$29.99/seat/month) that kept the same pitch: "long-term
  memory for the professional software developer," because a flat list does not scale as one.
  Two more tools — a VS Code extension and a Chrome extension — exist solely to fake folders
  through file-naming or a project-based file explorer.
- **GitHub's own answer**: none. Confirmed live — the gist list page has no folder, tag, or
  project concept anywhere in its markup.

## 2. Weak search, and GitHub made it worse in 2024

- **GitHub Community #131464**, 13 upvotes, 2024-07-09: the `/` keyboard shortcut that focused
  gist QuickSearch stopped working. GitHub support's own reply, quoted in the thread: "this
  change was in fact intentional... it wasn't being used very much."
  (https://github.com/orgs/community/discussions/131464)
- **GitHub Community #140427**, 4 upvotes, 2024-10-02: the user-facing half of the same
  complaint. "Very frustrating that this feature was removed... it's such a pain compared to how
  simple it was before." A second commenter, with 500 gists, built his own local search tool
  because "GitHub search does not index gist content."
  (https://github.com/orgs/community/discussions/140427)
- **HN, 2012**: SeoxyS, in the same redesign thread: "It's always been a huge pain to search for
  something you know you gisted, but can no longer find without browsing through 20 pages of
  3-line excerpts." ryandaigle built a third-party search tool for exactly this reason and
  reported it back to the thread: "it is (surprisingly?) case sensitive, it only searches
  titles, not file contents."
- **Competitor tooling**: five separate small tools exist purely to search gists — three Chrome
  omnibox extensions, a `gh` CLI fuzzy-search extension (`gh-fzgist`), and GistPad's own
  in-editor filter.

## 3. "Secret" reads as private, and is not — a safety issue, not a UX one

This is the one pain point that is not "organize better." It is people acting on a false belief
about who can see their gist, which is a different kind of problem than the other two.

- **Reddit, 2019**, 16 upvotes on the top comment: "Once the genie is out of the bottle, you
  can't put it back in... Once something secret is made public, it can't be made secret again."
  A second thread the same year: "A secret gist is not really private. Anyone who has the secret
  gist link has view access. How do I create a private github gist?" Answer: "You cant."
- **HN, 2022, on self-hosted Gist alternatives**: "gitgud / MaxLeiter exchange clarifies a common
  point of confusion: gists have no true 'private' mode, only 'secret' (URL-obscurity, not
  access control)."
- **HN, 2025, on secret scanning news**: "I wish I had known that there are no private github
  gists. Wish this was made more clear..." "Calling them 'secret' seems ambiguous at best,
  outright misleading at worst, and definitely worth an added warning."
- GitHub's own scanning partners now report secrets found in "unlisted" (secret) gists as if
  they were public, which they functionally are — the thread above is reacting to that policy
  landing in 2025 and readers only then learning what "secret" has always meant.

## 4. The editor is too small to use

- **Reddit, 2024**, 23 points, 27 comments: "I find the edit window is extremely tiny to be
  usable... To be able to modify a code efficiently the display I would expect it to take the
  full width least and be much taller." The top reply is resignation, not a fix: "I never
  actually write code in the online gist editor, I just paste some finalized code blocks into
  it." (https://www.reddit.com/r/github/comments/1bihlv7/)
- **GitHub Community #13206**, 6 upvotes: "the Gist window is soo small," "is not resizable."
- Fixable client-side — this is a CSS/layout constraint on GitHub's own page, not a data
  limitation — but it is a create/edit-flow fix, a different surface than the list.

## Below the cut, and why

| Pain point | Evidence | Why not now |
| --- | --- | --- |
| Gists 404 and lose drafts | Reddit, 12 points, "Lost everything" | GitHub's own reliability bug; an extension cannot fix a 404 |
| Discover feed is a spam wasteland | Reddit, live Nov 2025 thread | Server-side moderation problem; most users do not know the feed exists |
| Org-owned gists | GitHub Community #7923, **2,086 upvotes** — the largest single number in this whole survey | Needs a GitHub backend change (org accounts cannot own gists); nothing a browser extension can do about it |
| Broken `document.write` embeds, GitHub's ad line in embeds | HN, 2012, multiple comments | Happens on third-party sites embedding a gist's `.js`, which is not a page this extension's content script ever runs on |
| No PR/merge workflow for gist forks, no line comments | HN, 2012, shazow and halayli | Real, but a feature GitHub's server would have to ship; nothing here to build against |

## What this rules in

Two things are both true at once: the single biggest number in the whole survey (#7923, 2,086
upvotes) is explicitly out of reach, and the two next-biggest, most corroborated, most-tooled-for
pain points — organizing a gist list, and searching it — are the ones a client-side extension can
actually answer, because gist.github.com already serves every gist's metadata in its own list
page and a client can hold whatever structure GitHub doesn't.

The secret/private confusion is smaller by upvote count but different in kind: it is a warning,
not a feature, and it is the cheapest of the four to build — a banner wherever a secret gist is
shown, saying plainly that the link is the only thing keeping it out of a search engine's hands.
