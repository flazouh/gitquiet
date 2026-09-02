# 008 — The two pages left, and why neither is built yet

- **Status**: OPEN. Findings only. Nothing here is built.
- **Severity**: LOW for Compare, LOW for Conflicts
- **Category**: Coverage
- **Source**: `research/pages-to-replace.md` in the notes repository, ranked candidates 4 and 6

## Where the list stands

That research ranked six pages. Four are now answered:

| # | Page | State |
| --- | --- | --- |
| 1 | Files changed — `/pull/N/files` | **Built.** The parser reads it, and both words for it: GitHub redirects `/files` to `/changes`. |
| 2 | Code view — `/blob`, `/tree` | Already built, before this pass. Confirmed live: syntax highlighting, line numbers, the tree beside it. |
| 3 | Notifications | Already built. `NOTIFICATIONS` in `place.ts`. |
| 5 | Blame | Already built. `BLAME` in `place.ts`. |
| 4 | Compare — `/compare/...` | Not built. See below. |
| 6 | Conflict editor — `/pull/N/conflicts` | Not built. Not investigated. |

A note on #2, because it cost an hour of this pass: the code view *looked* unbuilt when measured
through `textContent` and `querySelectorAll`. The diff engine renders into a `<diffs-container>`
custom element with a shadow root, so both read empty on a page that was drawing the file
perfectly. The measurement was wrong, not the code. Anything checking whether a screen drew
should take a screenshot or measure the container's height, not count nodes.

## Compare, and why not to scrape it today

The research already hedges: "Weaker evidence than Files changed. Build it if compare is a daily
path for the same people who review." Its own strength rating is medium, against very high for
Files changed.

Probed live on 2026-09-02, signed in, on `flazouh/gitquiet/compare/main...claude/gist-screen`:

- No `react-app.embeddedData` payload at all. Two `react-partial.embeddedData` scripts, both
  shell: `docsUrl`, and the signed-in header's own props.
- None of the older markers either: no `diffs-container`, no `file-header`, no
  `data-file-path`, no `data-tagsearch-path`, no `js-diff-progressive`.
- No filename from the diff appears anywhere in 271KB of HTML.
- `turbo-frame` and `include-fragment` both present.

So the file list arrives in a deferred fragment, and the initial document says nothing about
what changed. Building here means finding that fragment's address, fetching it, and parsing
markup with no name yet.

**The argument against doing that now is the rest of this session.** GitHub moved two payload
shapes underneath this codebase in one day: the Working Set's row id became a global node id,
and the blob page's `rawLines` moved to `codeViewBlobLayoutRoute.StyledBlob` with the plain
JSON variant no longer carrying it at all. Both were caught, one of them only because a
screenshot looked wrong. A third reader built against undocumented markup that GitHub is
visibly mid-rewrite on is the most fragile thing that could be added right now, and it would be
added for the weakest-evidence page on the list.

### What to do instead, when this is picked up

1. **Ask first whether compare is a daily path.** The research conditions the whole item on it.
   Everything below is wasted if the answer is no.
2. **Find the fragment, not the page.** Watch the network on a signed-in compare with the
   extension off, and record the address the file list actually arrives at. That address is the
   thing to read, and it is the thing to put in `check-drift.ts` so it cannot move silently.
3. **Add it to the drift check before writing the screen.** Both of this session's breakages
   were invisible to 4,400 passing tests and obvious to `check-drift.ts` in one run. A reader
   with no drift coverage is a reader that fails in front of a reader.
4. **The strongest single feature is path filtering.** Community #165765: "GitHub's `/compare`
   page does not support filtering by path. That means when there a lot of changes in the other
   projects it gets very hard to read the comparison." This codebase already has the tree, the
   filter and the diff to answer that with.

## Conflicts

Not investigated in this pass. The research rates it "low for speed, high for missing facts",
which makes it a different kind of build from every other page here: the complaint is not that
the editor is slow but that it does not tell you enough. That is a spec question before it is
an engineering one, and it should get the same treatment `docs/spec/gists.md` got — the
evidence read first, the language settled, then the screen.
