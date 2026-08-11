# Spec: The stack that does not exist yet

Status: ready-for-agent

## Problem

GitHub draws a blue banner across the top of a pull request whose branch sits on
another pull request's branch, above their own header and above everything this
extension draws:

> This pull request can be stacked with other pull requests. **Learn more about
> stacks** [Preview stack]

Seen on `octo-org/hello-world#527`, `fix/base-run-skip-gate` going into
`feat/executor-privilege-split`, standing over our whole interface.

Two things are wrong with it being theirs. It is the last piece of GitHub's
chrome left on a page this extension has otherwise taken over, so it reads as a
seam. And what it says is a fact this interface has no notion of at all: today
`snapshot.merge.stack` is either a stack GitHub holds or nothing, and both
drawings of a stack — `StackTree` in the header, `TheStack` on the merge card —
return `null` below two layers. A pull request that *could* be a layer and is
not has never been a state anything here can be in.

That state is common and it is the expensive one. A reader who has based a
branch on a branch is already reviewing a chain; until somebody presses their
button, GitHub keeps no stack for it, so nothing lands together, nothing rebases
when the layer underneath moves, and every one of our own stack answers — which
layer this is, what one press lands, what is holding it up — has nothing to say.

## What GitHub knows, measured

Probed on `flazouh/stack-probe`, which holds a stack GitHub made (`#8 feat-a ->
main`, `#9 feat-b -> feat-a`, `#10 feat-c -> feat-b`, stack number 11), a merged
pull request based on `main` (`#12`), and a pair created for this: `#15
probe-w1 -> main` and `#16 probe-w2 -> probe-w1`, which GitHub has not stacked
and which show the banner.

**`page_data/merge_box` cannot tell the state apart.** The `STACK` condition
arrives on every pull request. On one that can be stacked it says exactly what it
says on one with nothing to stack:

| Pull request | `STACK` condition | `stackedBaseRefName` | Banner |
| --- | --- | --- | --- |
| `#10`, in a stack | `stack: {number: 11}`, 3 entries | `main` | no |
| `#12`, merged, on `main` | `stack: null`, `entries: []` | `main` | no |
| `#16`, can be stacked | `stack: null`, `entries: []` | `probe-w1` | yes |

So the answer is not in the payload the gateway already fetches. `#16` and `#12`
differ only in `stackedBaseRefName` equalling `baseRefName`, which is true of
every ordinary pull request as well and therefore says nothing.

**Two other places do know.** Their page HTML embeds
`pullRequestsLayoutRoute.bannersData.banners.canStackBanner.render`, which was
`true` on `#15` and `#16` and `false` on `#8`, `#9`, `#10` and `#12`. It is a
boolean inside 295 KB of document, and it says only yes or no.

`GET /<owner>/<repo>/pull/<number>/page_data/preview_stack` says the same thing
and says the whole of it. On `#16`, 200 with a JSON array, newest first:

```json
[
  { "stackId": null, "stackNumber": null, "id": 4205779207, "number": 16,
    "title": "probe w two", "url": "/flazouh/stack-probe/pull/16",
    "headBranch": "probe-w2", "baseBranch": "probe-w1", "state": "OPEN" },
  { "stackId": null, "stackNumber": null, "id": 4205778980, "number": 15,
    "title": "probe w one", "url": "/flazouh/stack-probe/pull/15",
    "headBranch": "probe-w1", "baseBranch": "main", "state": "OPEN" }
]
```

On `#8`, `#10` and `#12`, 200 with `null`. Not an error: a body of `null` is
GitHub saying there is nothing to propose, either because a stack already exists
or because there is no chain.

This route is better than the banner flag on every count. It is a few hundred
bytes on a route that exists for this question. `null` against an array answers
the same yes or no. And it carries a `baseBranch` per entry, which the `STACK`
condition's own entries do not carry at all — so the branch the proposed chain
would land on is the foundation's base, `main`, read rather than guessed. That is
the fact `stackedBaseRefName` was added to `Stack.floor` for, and here it arrives
for free.

**What "Preview stack" does.** One `GET page_data/preview_stack`, then a Primer
dialog titled "Preview stack" holding a NavList of the same entries newest first,
with Cancel and Create stack under it. Create stack does:

```
POST /<owner>/<repo>/pull/<number>/page_data/pull_request_stacks
{"pullRequestIds":[4205801354,4205801723]}
```

— GitHub's own numeric ids out of the preview payload — and then re-reads
`page_data/header`. Pressed on a second pair made for it, `#17`/`#18`, it created
stack number 19: `preview_stack` there now answers `null`, the `STACK` condition
carries two entries, and `stackedBaseRefName` moved from `probe-x1` to `main`. So
a proposal is not a suggestion about the future; it is a description of the stack
one POST would make.

**The ids run foundation first, which the recording above reads the wrong way
round.** `4205801354` is the smaller of the two and therefore the older, which is
`#17`, the layer sitting on `main`. Their dialog lists the chain newest first and
sends it reversed. Sent the way the list reads, GitHub answers 422 and says why:
`Pull requests must form a stack, where each PR's base ref is the previous PR's
head ref`. Sent foundation first the same pair answers 200 and
`{"stackNumber":34}`. Measured against `probe-y2` and `probe-d2`, one refusal and
one stack each.

**Their banner in the DOM.** `section[data-component="Banner"][aria-label="Can
Stack Banner"]`, inside `header[class*="PageLayout-Header"]` — a sibling of
`[class*="PullRequestHeader"]`, which is why the band that hides their header
misses it.

**No route that knows about the chain says how big any layer of it is.** The
`preview_stack` entries carry `stackId`, `stackNumber`, `id`, `number`, `title`,
`url`, `headBranch`, `baseBranch` and `state`. The `STACK` merge condition's
entries carry `isUnstackable`, `title`, `number`, `state`, `url`, `headBranch`
and `headOid`. Neither has a count of files or of lines in it.

The counts exist on a route of their own, one pull request at a time:
`page_data/diffstat`, seventy bytes, the two line counts and their sum. This
codebase already reads it per row — `GitHubGateway.sizeOf`, `sizesOf` in
`src/app/sizes.ts`, eight at a time, kept in the third part of the store — which
is how the Working Set and a repository's list show a size at all. So the price
of a size on every row of a proposal is one request per layer, less the layer
being read, whose files the snapshot already carries. Lines only: files per layer
would be `/changes`, which is three quarters of a megabyte for one large pull
request and the reason no list has ever shown a file count.

Drawn on the strip and nowhere else, and measured on the two chains made for it:
`#61 probe-ln1 -> main` with `#62 probe-ln2 -> probe-ln1`, and `#63` to `#74`,
twelve layers each on the one before it. Read from `#62`, the strip asks for one
diffstat, `#61`'s; GitHub's own page asks for `#62`'s in the same second, from
`fetch-utilities`, which is theirs. Read from `#74`, it asks for four — `#70` to
`#73`, the four rows of the window that are not the layer being read — and not
eleven. Read from `#68` in the middle it asks for `#66`, `#67`, `#69` and `#70`,
which is the same window centred on another seat.

The reader comes down from `src/screens/pullRequest.tsx` through
`PullRequestScreen` and `Shell` as another prop, the way `makeStack` does, and
`Shell` hands the strip the counts for the layer being read out of
`snapshot.files` rather than a way to ask for them.

## Decision

A pull request carries `proposal`: the chain GitHub would make out of it, or
nothing.

`snapshot.proposal`, not `snapshot.merge.proposal`. `MergeState.stack` is on the
merge state because its own reason says so — "it is a fact about merging before
it is anything else: it changes how many pull requests one press lands". A
proposal changes nothing about a press. Nothing lands together, nothing holds
anything up, and the merge card must go on saying what it says today. It is a
fact about this pull request's branch neighbourhood, which is where the branches
themselves are.

`Chain` is the layers and the branch they land on. `Stack` is a `Chain` with
GitHub's number for it. A proposal is a `Chain` with no number, because that is
the whole of the difference: nobody has made it, so nobody has numbered it.

Read in the same parallel batch as the merge box, and its answer is never
load-bearing. `preview_stack` failing, or arriving in a shape nothing has seen,
leaves the proposal absent and the pull request on the screen — unlike `changes`,
where a failure is the read failing. A payload remembered before this existed has
no `preview` key at all, and that is a proposal absent rather than a miss.

### What is drawn, and where

One strip above the header card, in the place their banner occupies, and their
banner gated out by name so there are not two.

**It draws a proposal and never a stack.** For a chain that already exists there
is nothing to propose: GitHub renders no banner there, `preview_stack` answers
`null`, and the header's own tree is drawing that chain inside the card below. A
second drawing of the same chain on the same screen is precisely the fault the
last two commits were spent on — `f0d0ee3` turned both existing drawings over so
that one stack could not be read two ways, and adding a third above them would
put it straight back.

**It is `StackTree`, not a third drawing of a layer.** The same rows, the same
`t-stack-*` gutter, the same tier step, the same trunk row at the head, the same
window and cut counts. `StackTree` takes a `Chain` instead of a `Stack` and one
flag saying whether the chain is one GitHub holds. Three facts follow from that
one flag: a proposed chain colours no row by what a press lands, dims no row for
being left out of one, and links itself up as it arrives. All three are wrong
about a stack that exists and right about one that does not.

`pressing.ts` widens from `Stack` to the structural `{ layers }` it already only
reads, so `whichLayer` and `aroundHere` answer about a proposal without knowing
what a proposal is.

**The sentence at the head of the strip** says that these pull requests can
stack, and stops there. It counts nothing and it names no branch. The reasoning
that put both there was wrong about the strip's own drawing: the rows are the
count, and the trunk row is the branch, one line under a sentence that was saying
the same two things again. The count is still worth having for a reader who is
being read to, and that reader already had it from the list's own name.

**The list drops the word "stack" from its name on a proposal**, and reads "Layer
2 of 2". The one place a proposed chain is drawn is a region named "Proposed
stack", so a list inside it carrying those same two words is one name announced
twice on the way in. A chain GitHub holds keeps "Stack, layer 3 of 5", because
the card around that one is named for the pull request rather than for the chain.

**Every row says how big its layer is, and the header's own tree says nothing.**
That is the one thing the two drawings of a chain differ on in what they say
rather than in how they say it, and both halves of it are the same argument. A
reader on the strip is deciding about pull requests they have not opened: one
press stacks all of them, from then on a merge on any one lands the layers
underneath, and there is nowhere else on the screen to find out how much work
each layer is. A reader in the header is standing in a chain that exists, one
layer at a time — the well directly above that tree counts the layer they are on,
and every other layer is a page this extension draws, whose own header counts it
when they get there. The cost settles the rest: the strip stands only while
nobody has pressed the button, and the header's tree is on every layer of every
stack, where the longest chain in GitHub's own feedback is twenty two.

The two counts and not a file count, and only for the rows the window draws.
Files per layer would be `/changes`, three quarters of a megabyte for one large
pull request; a row the window cut off is a request for a number nobody sees.

Nothing holds a place for a count while GitHub answers. Everything a row says
stands at its leading edge, the row is as wide as its content and the strip is as
wide as the page, so a count lands in space no row was using and the row grows to
the right. A place held for one would be eighty pixels of empty row on every
layer for as long as the reads take, on a row the reader may be standing on,
which is filled and would show it. The rows are linking up while these arrive,
which is the whole reason it matters.

**The strip carries a tone of its own**, and it is the only card on the column
that does. Every other one is a surface, which is what makes a page of them read
as one page; this one is not part of the pull request at all. Sharing the header
card's fill left a sentence and three rows floating over the title with no
boundary between them: measured on the Cursor dark pack, both cards computed to
`rgb(20, 20, 20)` and the seam was the page floor showing between them at 1.03:1,
against 3:1 as the floor for a boundary anyone can see. It takes
`--color-accent-muted`, which is the one token that changes hue rather than
lightness — two packs put `inset` and `surface` at the same value, so a fill from
the ladder is invisible on the packs the seam is worst on — and it is the colour
GitHub's own banner already taught this reader to read as a notice. Measured
again on the same pack, the strip composites to `rgb(40, 45, 49)` and the seam is
1.32:1. No pair of fills in the set reaches 3:1, which is why the gap under the
strip is twice any other gap on the column.

The exception lives in `quiet.css` beside the rule it is an exception to. That
file sets the fill of every `section[aria-label]` at a specificity no utility
class beats, and it takes the border off them as well — so the `border border-line`
this strip carried, and the paragraph of reasoning above it about a hairline box,
had never drawn a line on any screen.

### The linking

The rows arrive unlinked and link up. Each layer starts in the seat of the layer
it sits on — one gutter back and one row up — and takes the step of its own tier
from there, and the arm is written into the joint as it lands. That is the one
thing making this stack would do to these pull requests, drawn as movement:
today they all sit on the same branch, and stacking moves each of them onto the
one before it.

`motion.css` is sceptical of motion by default, and rightly — "an interface that
announces itself with choreography in the middle of a page that does not reads as
a different site rather than a better one". This one earns it on the file's own
terms. Everywhere else in the interface motion says where something came from,
over content that is already true. Here the content is not true yet: the subject
of this strip is a chain that does not exist, and the assembling is the claim
rather than a decoration on it. It runs once, on arrival.

Built out of the vocabulary: `--duration-quick` for the travel, `--duration-micro`
for the beat and for the arm, `--ease-out` on the layers and `--ease-in-out` on
the arm, and the step is the `--stack-reach` the gutter is already measured in.
The one new number is `--scale-mark`, which a twelve-pixel glyph needs because
the four surface scales above it are all within four percent of rest.

`transform`, not the `margin-left` the tier is drawn with, so nothing relayouts.
The stagger is `--stack-tier`, which every row already carries, and it stops
climbing after four so the deepest chain the window draws still lands inside the
run. Measured on `flazouh/stack-probe#16`: the first layer lands at 230ms and its
arm closes at 240ms, the second lands at 310ms and closes at 320ms, and a five
layer chain finishes at 480ms.

Under `prefers-reduced-motion` the chain is drawn linked, on the frame it
arrives. The block at the foot of `motion.css` says what that means: the row is
there either way, and what goes is the arriving.

### Making it

The strip has one button and it makes the stack the rows describe. A preview that
cannot be acted on is worse than the banner it replaced: GitHub's banner leads to
a press, and ours would lead nowhere.

**What the write sends is read again at the press, not kept from the draw.** The
gateway asks `preview_stack` and POSTs the ids it answers with, foundation first.
The strip can sit on the screen for as long as the reader is reading, and in that
time a branch can move, somebody else can stack the same pull requests, or a layer
can be merged. Ids kept from the draw would send GitHub a chain that no longer
exists, and GitHub's 422 for that names branches the reader can no longer see.
Nothing is read off the snapshot the strip was drawn from, unlike the merge and
the branch update, which both ask the card which of GitHub's two routes to use:
what is in the chain is GitHub's answer rather than the card's.

`writing` in `src/screens/pullRequest.tsx` wraps it, as it wraps every other ask
on the page, which reports the failure and still fails for the caller to see. The
CSRF path is the one every write here takes and nothing new: `GitHub-Verified-
Fetch: true` alongside the two headers these routes answer 406 without, and the
cookies do the rest.

**The press stands at the head of the strip, at the trailing edge of the sentence**,
which is the row and the corner GitHub puts their own Preview stack button on. It
used to stand under the rows, and that cost a whole row of its own: measured on
`flazouh/stack-probe#57`, the card was 158 pixels tall for about 110 pixels of
content, and it is 124 with the press on the sentence's row.

**The press says one thing, and the strip says the rest.** The button reads "Make
the stack" in every state, and gains a turning circle while GitHub has not
answered. It used to rewrite itself to "Making…", which said what the sentence
beside it now says and moved the target under the pointer of a reader who is
deciding whether to press again.

**It is marked rather than disabled while GitHub answers.** `disabled` on the
focused button drops the reader onto `<body>` — measured at 260ms after Enter —
so the sentence about what they just pressed is on a strip they are no longer
standing in. `aria-disabled` says the same thing and keeps them where they are,
and the press itself already refuses a second run, because a keyboard and a
second window both reach it.

**The sentence is a live region**, and it is the only part of the strip that
answers a press. "These pull requests can stack." at rest, "Making the stack."
while GitHub has not answered, "These pull requests stack now." when it agrees,
and GitHub's own words when it will not. Every state has a sentence, including
the resting one: a region that is empty until something happens is a region an
assistive technology has nothing to attach a change to, and the reader who
pressed the button hears nothing back. Before this, none of the three states was
announced at all — no `aria-live`, no `role=status`, no `role=alert` in any of
them.

**When the button goes, the reader's place goes to the strip.** The button is the
only thing on the strip a reader can stand on and it unmounts on the answer,
which would put them at the top of the document two cards above the sentence
saying what happened. The strip takes `tabindex="-1"` and takes the focus, but
only where the button held it: a reader who moved on keeps where they went.

On success the strip says the pull requests stack and stops offering to make
them. That state lasts about a second — GitHub answers before the re-read lands,
and a strip still reading "These pull requests can stack" over a stack that
exists is the one thing it must not say. Then the read comes back with no
proposal and a stack on the merge state, the strip stops being drawn at all, and
the header's own tree takes the chain over with the merge card underneath saying
what one press now lands. Nothing is drawn optimistically: the stack on the
screen after the press is the stack GitHub holds.

**A refusal is written in GitHub's words, in the same sentence.** The two that
will happen are the pull requests having moved and the reader not being able to
write to the repository, and both are sentences GitHub already writes better than
we would. The button stays where it is and can be pressed again, which is the
right offer for both: the first is fixed by re-reading the page and the second is
not the reader's to fix. Not a toast. The toast is for the writes whose control is
gone by the time the answer arrives — a row's menu closes on the press — and this
button is still on the screen under the reader's pointer.

**What is held about a press is keyed on the chain it was about.** The strip
stands for as long as the reader reads, and a re-read can arrive with other pull
requests in the proposal. Kept across that, GitHub's refusal about the pair that
is gone would stand beside rows it was never about. The layer numbers are the
key, so a proposal with other pull requests in it is another proposal.

**No confirmation.** GitHub asks twice because their first press only opens the
preview; ours is that preview, already open, with the rows the reader would be
agreeing to under their eyes. The merge card's own second press is for the presses
that end the reading, and this one ends nothing: every pull request stays where it
was and still opens on its own page, and what changes is that a merge on any of
them lands the layers underneath. It is also undoable, though not here — GitHub's
own page unstacks — so the rows and the sentence do the work the second press
would otherwise do.

## Out of scope

- Undoing a stack, or any of the rebasing GitHub does once one exists.
- The Working Set, which already folds rows into stacks off branch names and
  therefore already draws the chain a proposal describes.

## Acceptance

1. On a pull request GitHub would stack, the strip stands above the header card
   and draws every layer of the proposal, trunk row first, newest last.
2. Their `Can Stack Banner` is not on the screen.
3. On a pull request in a stack GitHub holds, the strip draws nothing, and the
   header's tree is unchanged.
4. On an ordinary pull request, nothing changes at all.
5. No row of a proposal is dimmed, and none is coloured as landing.
6. `preview_stack` failing, answering `null`, or answering a shape nothing knows
   leaves the pull request on the screen with no strip.
7. A payload remembered without a `preview` key decodes, with no strip.
8. Under `prefers-reduced-motion` no row travels.
9. The strip carries one button, reading "Make the stack", at the trailing edge
   of the sentence and above the rows, and one press makes the stack: no dialog,
   no second press.
10. While GitHub has not answered, the button turns a circle, the sentence reads
    "Making the stack.", the reader's place is still on the button, and a second
    press does nothing.
11. When GitHub answers, the sentence says the pull requests stack now, the
    button goes and hands the reader's place to the strip, and the read that
    follows takes the strip off the screen and leaves the chain drawn by the
    header's tree.
12. When GitHub refuses, their sentence replaces the strip's own, the button
    stays where it is and can be pressed again, and the rows are untouched.
13. A pull request read through a surface with no such write wired has no button
    on its strip.
14. Every one of those four sentences is in a live region, so a reader who is
    being read to is told what the press did.
15. A rerender with other pull requests in the proposal drops whatever was held
    about the last press.
16. The strip does not share the header card's fill.
17. Every row of the strip says how many lines its layer adds and takes away,
    `+N` in the pass colour and `−N` in the fail colour, with a real minus sign.
18. The row of the layer being read says it without a request, and the strip asks
    GitHub about the other rows of the window and about no others.
19. A layer nobody has counted, because the read failed or has not answered, is
    the row exactly as it was drawn — no zeroes, and no space held for a count.
20. The chain in the header carries no counts on any row.

## Related

- Both existing drawings: `src/ui/StackTree.tsx`, `src/ui/TheStack.tsx`
- Their direction, settled: commit `f0d0ee3`
- The trunk, and where it is read from: commits `1191f54`, `91dae3f`
- What the merge box says about a stack: `src/github/wire.ts`
- The write routes, recorded: `docs/spec/github-write-api.md`
