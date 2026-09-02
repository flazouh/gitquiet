# 007 — Give the gists a screen, for the same reason every other page has one

- **Status**: DONE. All five steps, plus two gaps a later sweep found.
- **Severity**: MEDIUM
- **Category**: Consistency & architecture
- **Estimated scope**: a gist Place, a list screen, a gist screen; `gist.content.ts` stands them
- **Reverses**: `docs/spec/gists.md`'s Implementation Decisions, which chose to append

## Why this exists

`gist.github.com` is the one place this extension touches and does not take. The spec chose
that deliberately: no React application to replace, a page that is "plain, readable, and not
slow", and a host permission that had not been paid for yet. Two of those three have since
changed. The permission is shipped — `*://gist.github.com/*` is in `host_permissions` and a
content script already matches it — and `plans/006` established that a screen does not need a
React application under it, because a full-replacement screen stands on `document.body`.

What is left is the first reason, and it is the weakest of the three. A reader who has spent
the day in this interface arrives at their own gists and gets GitHub's page with a search bar
bolted above it. Nothing is wrong with that page. It is simply not this one, and the reader
can tell.

## What a gist screen is, in the terms `plans/006` set

That plan names two kinds of screen, and this is the first kind:

> **Full-replacement.** Home, the pull request dashboard (`/pulls`), notifications, the issue
> dashboard (`/issues`). Cross-repository views with no chrome of GitHub's the reader still
> needs.

A reader's own gist list is that shape exactly. It crosses nothing — there are no repositories
— but it is the reader's own things listed for them, and GitHub's chrome around it is a header
and a filter dropdown. So both gist screens stand on `body`, with the bar, and hide by
position rather than by naming a region.

**This is consistency, and only consistency.** It is worth saying plainly, because every other
screen here earns its place by re-filing information: a pull request is filed by what is owed
rather than by object type, and `CONTEXT.md` names the Courts that do it. A gist list has no
Court. Nobody owes anything on a gist. So this plan does not invent one, and anybody reading
it later should not go looking for the organizing idea it is missing. The organizing idea is
that the reader is already here.

## What already exists

Most of it, which is why this is smaller than it sounds. All of it is on `main`:

| piece | where | what it gives |
| --- | --- | --- |
| `GistRow` | `src/domain/gistList.ts` | id, owner, title, description, preview, secret, updatedAt |
| `rowsOnPage` | `src/github/gistList.ts` | every row off their server-rendered list |
| `gistViewIn`, `gistListIn` | `src/domain/gist.ts` | both addresses, host-gated to `gist.github.com` |
| `matchesQuery` | `src/domain/gistList.ts` | search over title, description, preview and Labels |
| Labels and Names | `src/app/gistLabels.ts` | `storage.sync`, keyed by gist id |
| `isSecretGist` | `src/github/gistVisibility.ts` | the Secret badge, read off their markup |

So the reading is done. What this plan adds is the drawing.

## The steps

### 1. A gist Place, and where it lives

Not in `src/ui/place.ts`. That module is `github.com`'s router: `placeOwning` walks
`BY_ADDRESS` for the shell, and every `owns` in it builds `https://github.com${path}`. A gist
Place belongs beside the content script that stands it, in `src/ui/gistPlace.ts`, with `owns`
building `https://gist.github.com${path}` and calling the parsers `gist.ts` already exports.

Nothing in `mount.ts` or `shell/screen.tsx` names a host — checked — so `standAScreen` takes a
gist Place as readily as any other. Two Places: `GIST_LIST` and `GIST_VIEW`, both
`fallback: "body"`, both with `regions: []` so the body is the only answer.

### 2. `gist.content.ts` stands a screen rather than appending nodes

It already runs on every gist page and already watches for `gist-pjax-container` swapping
underneath it. The change is what it does when it sees one: call `standAScreen` for whichever
Place owns the address, instead of `plantSecretBanner`, `plantGistSearch` and
`plantGistLabelsPanel`.

It must not import `place.ts`. It may import `mount.ts` and `shell/screen.tsx`, which is the
part the spec's Implementation Decisions rules out today and which this plan changes.

### 3. `GistListScreen`

The reader's own gists, drawn the way every other list here is drawn: the bar, `t-panels`, our
own rows. Everything the appended version does moves into it — the search field, a Label chip
row, the Secret badge — and stops being a thing planted beside GitHub's markup.

Search stays client-side and stays over `preview`, which is the whole point of it: GitHub's own
search does not read file content and this row already carries it.

### 4. `GistScreen`

One gist. The Secret banner becomes a panel at the top rather than a `.flash` borrowed from
GitHub's stylesheet, the files render through the diff engine the way every other file here
does, and the Labels and Name for that gist are editable in place.

### 5. The spec

`docs/spec/gists.md` says the opposite of all of this, in "Why this is a different kind of page
for this extension" and in Implementation Decisions. Both sections get rewritten to say what is
true after this plan, and to keep the reasoning that was right at the time: the page really does
carry no React application, and that really did mean something before `plans/006`.

## Order, and what can be done alone

1. **Step 1 and 2 together.** A Place nothing stands is untestable, and a content script with
   nowhere to stand is broken. Done together, the proof is a blank screen of ours on a gist
   page, which is worth seeing before anything is drawn into it.
2. **Step 3.** The list is the page a reader lands on and the one carrying the existing
   behaviour, so it moves first and the appended version comes out in the same change.
3. **Step 4.** A single gist can keep GitHub's page until this lands. It is the one step that
   can be skipped and left for later without the interface looking half-finished.
4. **Step 5** last, when the code it describes is real.

## What this ended up doing beyond the plan

The three Open Questions in `docs/spec/gists.md` were meant to stay open. All three turned out
to cost nothing once the screens existed: the Label control is an inline editor on the row, the
pagination depth is every page, and `/starred` serves the same rows as a reader's own list.

Two more gaps came out of a second research sweep, both client-fixable and neither in the
original notes: GitHub's account export carries no gist data at all, and their editor is a third
of the height of the window it sits in. Both are built. Bulk delete was found in the same sweep
and deliberately not built; the spec says why.

Gist creation and editing stay GitHub's, as planned — but the editor gets room, which is the
one thing about it a stylesheet can fix.
