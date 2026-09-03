import { Effect, Option } from "effect"
import { useState } from "react"
import type { PullRequestSnapshot, PullRequestState, Stack } from "../domain/PullRequest"
import { toUrl } from "../domain/PullRequestRef"
import { whichLayer } from "../domain/pressing"
import { sizeOf } from "../domain/workingSet"
import { useArt } from "./art"
import { CARD, CHIP, GHOST } from "./dress"
import { pullRequestArt } from "./Icon"
import { BROWSER } from "./marks"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"

/**
 * What the badge says, which is the state and one thing more.
 *
 * Queued is not a fifth state: `stateOf` keeps a queued pull request open,
 * because where it stands in the line is already on the merge state. But
 * GitHub's own page badges it "Queued", and a reader arriving from there saw
 * "Open" on the same pull request — the one word saying the merge is in hand
 * was the one missing. So the badge reads the queue as well as the state, and
 * the queue wins while this is standing in it.
 */
type Badge = PullRequestState | "queued"

/**
 * Queued in the colour of a wait, and on a tint rather than a fill: the ink is
 * the pack's own busy colour, which every pack chose, where a fill under white
 * ink is a colour none of them did.
 */
const BADGE_TONE: Record<Badge, string> = {
  open: "bg-pass-emphasis text-ink-on-emphasis",
  draft: "bg-surface text-ink-muted",
  merged: "bg-done-emphasis text-ink-on-emphasis",
  closed: "bg-fail-emphasis text-ink-on-emphasis",
  queued: "bg-attention-muted text-busy"
}

const BADGE_WORD: Record<Badge, string> = {
  open: "Open",
  draft: "Draft",
  merged: "Merged",
  closed: "Closed",
  queued: "Queued"
}

/** What the moment beside the word is the moment of, said as it reads. */
const STATE_VERB: Record<PullRequestState, string> = {
  open: "Opened",
  draft: "Opened",
  merged: "Merged",
  closed: "Closed"
}

/**
 * The moment the badge is about: when a pull request reached where it stands.
 *
 * Opened for one still live, since that is when being open began, and the end
 * for one that has reached it. Not the other way round on a closed one: the
 * opening date under the word "Closed" would be read as the closing date.
 */
const momentIn = (snapshot: PullRequestSnapshot): Option.Option<string> => {
  switch (snapshot.state) {
    case "open":
    case "draft":
      return snapshot.openedAt
    case "merged":
      return snapshot.mergedAt
    case "closed":
      return snapshot.closedAt
  }
}

const Branch = ({ name }: { readonly name: string }) => (
  <span className={`${CHIP} font-mono text-xs text-ink`}>{name}</span>
)

/**
 * Which layer of a stack this is, standing right after the branch that explains
 * why the question comes up.
 *
 * Both branches on a stacked pull request are feature branches. `feat-c` going
 * into `feat-b` looks like an ordinary pull request into an ordinary branch, and
 * nothing on the row says whether one more of these follows or eleven do — which
 * is what GitHub's own preview readers described as having to keep track of
 * where they were in the stack in their heads.
 *
 * The count and nothing else. What a press would land, which layers hold it up
 * and where each one goes are the merge card's answers, and this row's job is
 * facts: it is the same width as a branch chip and it is read in passing.
 */
const Layer = ({ stack }: { readonly stack: Stack }) => {
  const Sits = useArt()["stacked-on"]
  const seat = whichLayer(stack)

  // A stack of one is a chain with no links in it, and its own panel in the
  // merge card declines to draw for the same reason.
  if (stack.layers.length < 2 || Option.isNone(seat)) return null

  return (
    <span
      // Spelt out for a reader being read to, because "3 of 3" beside two branch
      // names is a ratio with no subject. Kept off the visible chip, where the
      // mark and the place on the row already say which of the two it is.
      aria-label={`Layer ${seat.value.at} of ${seat.value.of} in a stack`}
      className={`${CHIP} flex shrink-0 items-center gap-1.5 text-xs tabular-nums`}
    >
      {/* The accent, as it is on every stacked row in the Working Set: a reader
          who has seen a stack in the list meets the same mark here. */}
      <Sits size={12} aria-hidden="true" className="shrink-0 text-ink-accent" />
      {`${seat.value.at} of ${seat.value.of}`}
    </span>
  )
}

/**
 * A control that looks like the ones in the sections below it, and no other.
 *
 * Square and wordless. Four labelled buttons took four hundred pixels off the
 * title's own line, which is how a number that identifies the pull request came
 * to be the first thing clipped; the label moved to `aria-label` and `title`,
 * where a name is read by whoever needs it and costs the row nothing.
 */
const Action = ({
  label,
  href,
  outward,
  onClick,
  children
}: {
  readonly label: string
  readonly children: React.ReactNode
} & (
  | {
      readonly href: string
      /**
       * That this link leaves the interface, for wherever the reader keeps their tabs.
       *
       * A claim about the control rather than about its address, which is why it is said
       * here and not worked out from the URL. Only the window reads it, and there it is
       * the difference between a control that works and one that does nothing: in that
       * window no link is followed, and a link to a pull request means that pull request
       * being drawn. This one points at the pull request already on the screen, so
       * unsaid it was answered by drawing that same screen again, which looks exactly
       * like a press that did not land. The rule is `desktop/src/view/where.ts`.
       */
      readonly outward?: boolean
      readonly onClick?: never
    }
  /* A press, which has no address and so nothing to leave for. */
  | { readonly onClick: () => void; readonly href?: never; readonly outward?: never }
)) => {
  // Nothing until it is pointed at: this stands on the card's own fill, and a tint on a
  // tint is a raised square rather than a button. The hover is where the control appears,
  // and it is spelt without `enabled:` because this also renders as an anchor.
  const dressed = `${GHOST} grid size-7 shrink-0 place-items-center text-ink-muted no-underline hover:bg-hover hover:text-ink`

  return href === undefined ? (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={dressed}>
      {children}
    </button>
  ) : (
    <a
      href={href}
      aria-label={label}
      title={label}
      className={dressed}
      {...{ [BROWSER]: outward === true ? "" : undefined }}
    >
      {children}
    </a>
  )
}

/**
 * Which pull request this is, as a card rather than as loose text.
 *
 * Everything else on this screen is a bordered panel with a heading strip and
 * its content beneath, so a bare row of text floating above them read as a
 * fragment of GitHub's page that had been left behind. Same border, same
 * surfaces — the name on the card, and the facts about it (author, branches,
 * size) in a recessed well underneath, rounded to the card's own corner so a
 * square fill never sits in a round frame.
 */
export const Header = ({
  snapshot,
  onUseGitHub
}: {
  readonly snapshot: PullRequestSnapshot
  /**
   * Hands the page back to GitHub and remembers that this is what was wanted.
   * Absent in a test, and in any other place that has no page to hand back.
   */
  readonly onUseGitHub?: () => void
}) => {
  const art = useArt()
  const YourMove = art["needs-you"]
  const Tick = art.tick
  const Copy = art.copy
  const External = art["external"]
  const inQueue = Option.exists(
    Option.flatMap(snapshot.merge, (said) => said.queue),
    (queue) => queue.waiting
  )
  const badge: Badge = inQueue ? "queued" : snapshot.state
  const Art = pullRequestArt(art, snapshot.state, inQueue)
  const word = BADGE_WORD[badge]
  const moment = momentIn(snapshot)
  const age = Option.getOrUndefined(Option.map(moment, (at) => ageOf(at)))
  const size = sizeOf(snapshot.files)
  const url = toUrl(snapshot.reference)
  // A merge box GitHub would not serve reads the same as one that named no stack:
  // both leave the chip and the tree off, which is what this row would draw anyway.
  const stack = Option.flatMap(snapshot.merge, (said) => said.stack)
  const [copied, setCopied] = useState(false)

  return (
    // A region rather than a `header`, because the bar above it is already one:
    // a `header` scoped to the body is a banner, and two banners on a page leave
    // a reader asking for the banner with two answers and no way to tell them
    // apart. The bar is the page's, and this one heads the pull request.
    <section
      aria-label="This pull request"
      className={`t-panel-fade mb-1.5 shrink-0 p-1 ${CARD}`}
    >
      {/* No padding of its own: the card's own inset is what holds both rows
          off its border, so the badge's fill starts where the well's fill
          starts rather than eight pixels inside it. */}
      <div className="mb-1 flex items-center gap-2.5">
        {/* The age is inside the badge rather than beside it: where a pull
            request stands and when it got there are one fact, and anyone
            arriving at it is asking both at once. Titled with the verb and the
            whole timestamp, because "4d ago" is a rounding and the exact
            moment is what an argument about a regression needs. Same corner
            and same padding as the well beneath it, so the two fills the card
            holds are cut to one shape rather than a pill above a rectangle. */}
        <span
          aria-label={age === undefined ? word : `${word} ${age}`}
          title={Option.getOrUndefined(
            Option.map(moment, (at) => `${STATE_VERB[snapshot.state]} ${momentOf(at)}`)
          )}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${BADGE_TONE[badge]}`}
        >
          <Art size={12} />
          {word}
          {age === undefined ? null : (
            <span className="font-normal opacity-80 tabular-nums">{age}</span>
          )}
        </span>

        {/* The number and the name, in one box, reading as one heading.

            Before the title and outside anything that truncates. It rode at the
            end of the heading, inside the same `truncate`, so on a long title
            the one fact that names this pull request — the fact a reader says
            out loud and pastes into a message — was the first character to be
            cut: "#2…". Leading the line also puts it in the same place on every
            pull request, which is what makes it findable without reading.

            The box is what makes it a heading rather than a third object on the
            row. On the row's own gap the number sat as far from the title as
            the badge sat from the number, so the line read as three things; at
            this gap it reads as "#1737 feat(engine): …", which is how it is
            said. No fill and muted ink for the same reason: a chip at the
            title's size made the second heaviest thing on the card a number,
            and `dress.ts` spends a file taking boxes off this interface. */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-ink-muted">
            {`#${snapshot.reference.number}`}
          </span>

          <h1 className="min-w-0 truncate text-base font-semibold">{snapshot.title}</h1>
        </div>

        <Action
          label={copied ? "Link copied" : "Copy link"}
          onClick={() => {
            Effect.runFork(
              Effect.tryPromise(() => navigator.clipboard.writeText(url)).pipe(
                // Refused by a browser that will not give a page the clipboard,
                // and there is nothing to say about it: the name on the button
                // stays "Copy link", which is the truth.
                Effect.match({ onSuccess: () => setCopied(true), onFailure: () => {} })
              )
            )
          }}
        >
          {copied ? <Tick size={14} /> : <Copy size={14} />}
        </Action>

        {/* Nothing at all where the bar is offering the way out.
            There were two GitHub controls here. One was a link to
            `toUrl(reference)`, which on the extension is the address already
            being stood on: following it reloaded the same URL and this
            interface took the page over again, so it could not do what it said.
            The other handed the page back, and that one now lives at the right
            of the strip, where it is in the same corner on all four screens
            instead of on this one. What is left is for a window that is not
            GitHub's page: there the link goes somewhere. */}
        {onUseGitHub === undefined ? (
          <Action label="Open on GitHub" href={url} outward>
            <External size={14} />
          </Action>
        ) : null}
      </div>

      <div className="flex items-center gap-2 rounded-md bg-inset px-2.5 py-1.5 text-xs text-ink-muted">
        {/* The face leads the line, at the gap the login is set in rather than
            the line's own, so the two read as one person and not as a picture
            beside a name. */}
        <span className="flex shrink-0 items-center gap-1.5">
          <Who login={snapshot.author.login} src={Option.getOrUndefined(snapshot.author.faceUrl)} />
          <span className="font-semibold text-ink">{snapshot.author.login}</span>
        </span>
        {/* No "wants to merge" between the face and the branches. The arrow
            below already says which way the work is going, and the words were
            fourteen characters of prose in a line whose job is facts. */}
        <Branch name={snapshot.headBranch} />
        <YourMove size={12} className="shrink-0" />
        <Branch name={snapshot.baseBranch} />
        {Option.isSome(stack) ? <Layer stack={stack.value} /> : null}
        <span className="ml-auto shrink-0 tabular-nums">
          {`${snapshot.files.length} ${snapshot.files.length === 1 ? "file" : "files"}`}{" "}
          <span className="text-pass">+{size.added}</span>{" "}
          <span className="text-fail">−{size.deleted}</span>
        </span>
      </div>
    </section>
  )
}
