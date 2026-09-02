# 008 — The last two pages, and where the list ends

- **Status**: DONE. Compare is built. Conflicts was already answered.
- **Severity**: LOW
- **Category**: Coverage
- **Source**: `research/pages-to-replace.md` in the notes repository, ranked candidates 4 and 6

## A note on measuring whether a screen drew

Worth reading before anything below, because it cost an hour of this pass. The code view
*looked* unbuilt when measured through `textContent` and `querySelectorAll`. The diff
engine renders into a `<diffs-container>` custom element with a shadow root, so both read
empty on a page that was drawing the file perfectly. The measurement was wrong, not the
code. Anything checking whether a screen drew should take a screenshot or measure the
container's height, not count nodes.

## Compare, and where its file list actually lives

This section first said not to build it, on the grounds that its markup had no name.
It has a name. I had not looked hard enough, and the way to find it was written in this
same plan one paragraph further down: watch the network, not the document.

Watching a signed-in compare load shows the page carries no file list at all and defers
it to:

    /{owner}/{repo}/compare/file-list?range={base}...{head}

which answers with ordinary diff markup — a `#toc`, a row per file, both counts, and an
`<svg title>` naming what happened to it. That is the address to read, and it is now in
`domain/compare.ts` as `fileListRoute`.

Two things about the address parser were worth testing, because both were wrong first:

- A branch may carry a slash. `claude/gist-screen` is two segments once a path is split,
  so the range is rejoined rather than read out of the first segment after `compare`.
- The longest separator decides and does not fall back. `main...` read as a two-dot
  range gives a head of a single dot, which is a comparison against a branch that cannot
  exist. An address that names a separator and does not finish it is unfinished, not
  shorter, and their own form is the right thing to leave on the screen.

The screen lists what changed, filtered by path — Community #165765, which is the whole
reason the page earns a place. It does not draw the hunks: their fragment renders a
handful of files and defers the rest, so a screen that fetched every hunk to show a list
would pay the whole cost of the page it replaced. Their anchors are kept instead.

Verified live on a forty-one-file comparison: 41 files, +2856 −692, matching their own
"Showing 41 changed files with 2,856 additions and 692 deletions."

## Conflicts, which was already answered

The research ranks this sixth and says what to do about it: "Do the path list on the
pull request first. Replace the editor only if people still leave for GitHub after they
see the paths."

The path list is built. `docs/spec/conflicted-files.md` specified it, `Merge.tsx` draws
it, and every acceptance criterion in that spec is covered by a test in
`merge.test.tsx` — including the link out to their conflicts page. That spec's status
line said "measured" long after it was built, which is fixed now.

The editor stays theirs, and that is a decision already written down rather than one
made here. The spec's own Out of scope says "Resolving a conflict here. Their editor
does it, and this links to it." Three things agree with it: resolving a conflict is a
write, and this codebase does not invent second routes for writes; GitHub disables
their own editor for anything but a simple line clash, so a replacement would have to
answer the hard cases their page refuses; and the research conditions the whole move on
whether people still leave after seeing the paths, which nobody has measured.

If that measurement is ever taken and says they do leave, this is the page to build
next, and it should get a spec before it gets a screen.

## Where the list ends

All six pages the research ranked are now answered:

| # | Page | State |
| --- | --- | --- |
| 1 | Files changed | Built |
| 2 | Code view | Already built |
| 3 | Notifications | Already built |
| 4 | Compare | Built |
| 5 | Blame | Already built |
| 6 | Conflicts | Path list built; editor out of scope by the spec's own decision |
