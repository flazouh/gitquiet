# Building in public on X — two weeks

Repo stays private. The product is teased through evidence, never through code.

## Rules

- One claim, repeated: GitHub's pull request page is slow and organised by the wrong axis.
- Every post is evidence for that claim. Nothing else gets posted.
- Motion over stills. 8-second silent screen recordings that loop. Speed and keyboard
  flow cannot be shown in a static image.
- Numbers must be reproducible. Always name the public PR they were measured on.
- No repo, no file tree, no editor, no code in clips. Output only.
- No emoji. No hype adjectives. No "Day N of" counter.
- The ask ("reply if you want in") only appears after three posts of proof.
- Replies beat links. X suppresses posts with links; replies feed the algorithm.

## Cadence

Four posts a week, one reply-only day.

| Day | Type |
| --- | --- |
| Mon | Receipt — a number with a method |
| Wed | Motion — one interaction, 8s, looping |
| Thu | Opinion — design philosophy, no product pitch |
| Fri | Motion or receipt |
| Tue | Reply-only. No posting. |

---

# Week 1

## Mon — Receipt: the benchmark

> GitHub's PR page for microsoft/vscode#327442:
>
> 1,537ms to first byte
> 3,323ms to load
> 230 requests
>
> The same data is one 111KB JSON payload.
>
> I'm rebuilding the page.

No clip. No link. This post exists to test whether the hook lands before you invest
in a content machine. If it does nothing, the numbers are not the hook and you
reposition around the attention model instead.

## Wed — Motion: instant open

Clip: split screen. Left, github.com loading that same PR. Right, yours. Same click,
same moment. Let the left side finish loading on its own; do not cut it short.

> Same pull request. Same click.
>
> Left is github.com. Right is the extension, served from a local cache that GitHub's
> own push notifications keep current.
>
> Nothing is precomputed for the demo. It is like this every time.

The honesty line at the end matters more than the clip. Dev audiences assume demos
are rigged, and saying it out loud pre-empts the top reply.

## Thu — Opinion thread: the wrong axis

This is your highest-ceiling post. It is a design argument, not a product pitch,
which is why it travels. Six tweets.

1. > GitHub organises a pull request into Conversation, Commits, Checks, Files.
   >
   > That is organised by record type. Not one of those tabs answers the only
   > question you actually have: does this need me?

2. > So I threw out the tabs and built one axis instead. Every item on a pull request
   > sits in exactly one Court — the participant who owes the next move.
   >
   > Your Move. Waiting On Others. Settled.

3. > A review thread, a failing check, a bot finding, an unread file change, an
   > out-of-date branch — GitHub renders these in five different places with five
   > different affordances.
   >
   > They are the same thing. Something is owed to someone.

4. > The vocabulary was the hard part. I wrote a glossary before I wrote code, and
   > every term has a list of words I am not allowed to use for it.
   >
   > Court, not owner or assignee or status.
   > Your Move, not open or actionable or pending.
   > Settled, not closed or done or resolved.

5. > The banned list does more work than the definition. "Status" would have let me
   > sneak a state machine in. "Court" forces the model to stay about people.
   >
   > You cannot accidentally write the wrong feature if the word for it does not exist.

6. > It lives inside GitHub's own page. Their header, nav and tabs untouched. My part
   > drawn in Primer tokens and Octicons, so it inherits whatever theme you already run.
   >
   > Building it in public. Follow along.

## Fri — Motion: theming

Clip: toggle GitHub's theme setting. Your interface follows instantly — dark, light,
dimmed, colorblind variants. Cycle through four.

> I did not write a theme. I did not write a single colour.
>
> It is drawn in Primer tokens, GitHub's own design system, so it is whatever theme
> your account is already set to. Including the ones I have never opened.

Disproportionately satisfying to watch, and it quietly proves the extension is native
rather than an iframe bolted on top.

---

# Week 2

## Mon — Motion: the keyboard queue

Clip: enter a row from the Control Center, traverse eight items with `j`/`k`, land
back. Hands never touch the mouse. Show the counter decrementing.

> Every row on the main screen opens a Queue — the items you entered together,
> traversed one at a time.
>
> Eight review threads in eleven seconds, no mouse. You leave when the queue is empty,
> not when you get bored.

## Tue — Opinion: Effect v4 in production

Aimed at the Effect community, not at your PR-tool audience. It is small, active, and
has almost no real production examples to read.

> Shipping a Chrome extension on Effect v4 beta. Notes from the migration, since v3
> content will actively mislead you:
>
> Either is Result.
> catchAll and orElse are gone; there is one Effect.catch.
> @effect/vitest is v3-only — test clocks and property testing now come from
> effect/testing.
>
> Typed errors across a message-passing boundary have been worth the beta tax.

Do the same post shape once for WXT and once for Bun. Three small communities, each
of which will amplify a real example, is worth more than one broad post nobody shares.

## Thu — Motion: duplicate bot findings

Your most novel feature. Nobody else is solving this and everyone with two bots
installed feels it weekly.

Clip: a PR where CodeRabbit and Copilot both flag the same line. Show both. Show
yours collapsing them into one item. Then show a stale finding — its target lines
changed — greyed out.

> Two bots reviewing the same PR will tell you the same thing twice, in two places,
> and neither of them notices.
>
> Duplicate findings collapse into one item. Findings whose lines have since changed
> are marked stale, because they are almost certainly no longer true.

## Fri — The ask

Only now, after five pieces of proof.

> Two weeks in. It opens instantly, it is organised by who owes the next move, and it
> is native enough that it follows your GitHub theme.
>
> I want ten people who review pull requests every day to break it before I widen it.
>
> Reply "in" and I will send you a build.

Ten, not a hundred. A number small enough to be credible and to create pressure.
Collect replies, not emails — the reply count itself pushes the post.

---

## Tuesdays: reply-only

The highest-yield hour of your week at zero followers.

Search X for `github pr review slow`, `code review tab`, `coderabbit noise`,
`github notifications useless`. Reply to complaints with the clip that answers that
exact complaint. No pitch, no link. "Building this because of exactly that" plus an
8-second clip.

Ten replies a week beats ten posts a week until you clear roughly 500 followers.

---

## Capture setup

`ego-browser` is already wired into `bun run reload`. Script the captures against one
fixed public PR so week 1 and week 6 clips are honestly comparable and you never
rerecord by hand.

Constraints for every clip: 8 seconds or under, silent, looping, 1280x720 or tighter,
cursor visible only when the point is that you are not using it.
