import { Effect, Option } from "effect"
import { useState } from "react"
import type { Uploaded } from "../domain/attaching"
import type { Participant, Review as Given, ReviewDecision } from "../domain/PullRequest"
import type { Suggesting } from "../domain/suggesting"
import type { Review, Verdict as Said } from "../ports/GitHubGateway"
import { GHOST, PRESSABLE } from "./dress"
import { forget, held, hold } from "./held"
import { Says } from "./says"
import { Section } from "./Section"
import { remember, remembered } from "./verdicts"
import { Writing } from "./Writing"

/**
 * The three verdicts, dressed as the merge card dresses its own verbs.
 *
 * Green for the one that lets a change land, red for the one that holds it up, the plain fill
 * for the one that says something and decides nothing — the same three tones `Merge.tsx` uses,
 * so a reader who has learnt that card has learnt this one.
 *
 * No glyph on any of them, which is that card's answer too. The colour has already said what
 * kind of act this is, and a red mark beside a red word is the same sentence twice in two
 * voices — the argument `Section.tsx` makes about its own header.
 */
const VERDICTS: ReadonlyArray<{
  readonly said: Said
  readonly word: string
  /** What the button says while GitHub is being asked. See `says.tsx`. */
  readonly working: string
  readonly dress: string
  /**
   * Whether GitHub takes this one with an empty box.
   *
   * Approving needs no words and usually gets none. The other two are refused without a body,
   * so the button is out until there is one rather than pressed for a 422.
   */
  readonly wordless: boolean
}> = [
  {
    said: "approve",
    word: "Approve",
    working: "Approving…",
    dress: "bg-pass-emphasis text-ink-on-emphasis enabled:hover:opacity-90",
    wordless: true
  },
  {
    said: "request-changes",
    word: "Request changes",
    working: "Sending…",
    dress: "bg-surface text-fail enabled:hover:bg-active",
    wordless: false
  },
  {
    said: "comment",
    word: "Comment",
    working: "Posting…",
    dress: "bg-surface text-ink enabled:hover:bg-active",
    wordless: false
  }
]

/** What this reader already said, where GitHub says they said anything. */
const alreadySaid = (
  reviews: ReadonlyArray<Given>,
  login: string
): Option.Option<ReviewDecision> =>
  Option.fromNullishOr(reviews.find((review) => review.reviewer.login === login)?.decision)

const SAID: Record<ReviewDecision, string> = {
  approved: "You approved this",
  "changes-requested": "You asked for changes",
  commented: "You commented on this",
  dismissed: "Your review was dismissed"
}

/** The same sentence for a verdict this interface sent and GitHub does not hand back. */
const OURS: Record<Said, string> = {
  approve: "You approved this",
  "request-changes": "You asked for changes",
  comment: "You commented on this"
}

/** The seven characters everybody says a commit by. */
const shortly = (sha: string): string => sha.slice(0, 7)

/**
 * What the reader thinks of it, said from where they read it.
 *
 * Three presses on the page rather than a dialog behind a button at the top of another one.
 * GitHub's own path to an approval is: scroll to the top of Files changed, press Review
 * changes, choose a radio, press Submit — four acts for a verdict that is one word, and the
 * reason people report leaving comments unsent for a day.
 *
 * Folded, like every other box here. An approval is the common answer and takes no words, so it
 * stands at rest beside the fold; the other two need a body, and the box that holds one opens on
 * a press. Open by default it was a two-hundred pixel wall under a conversation that is usually
 * read without a word being added.
 *
 * Nothing is batched. A comment typed against a line was posted when it was written, so this box
 * holds only what is being said about the whole reading. That is the other half of the same
 * complaint: a review that has to be submitted somewhere else is a review that gets lost when
 * the tab closes.
 */
export const Verdict = ({
  reviews,
  viewer,
  author,
  headSha,
  keep,
  suggest,
  onUpload,
  onReview
}: {
  readonly reviews: ReadonlyArray<Given>
  readonly viewer: { readonly login: string; readonly faceUrl?: string }
  /** Whoever wrote it, since GitHub refuses an approval from them. */
  readonly author: Participant
  /** The commit being judged, which GitHub records the verdict against. */
  readonly headSha: string
  /** What an unsent note is kept under. See `held.ts`. */
  readonly keep?: string
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
  /**
   * Sends the verdict, with the commit it is about.
   *
   * The whole review rather than the word alone, because the commit belongs to the reading and
   * this panel is the only thing that knows which one was on the screen.
   */
  readonly onReview: (review: Review) => Effect.Effect<unknown, unknown>
}) => {
  /*
   * A note that outlived the page it was written on opens the box on arrival.
   *
   * The same rule as `Saying`: folded, those would be words the reader left here and cannot
   * see, which is the same as losing them.
   */
  const [waiting] = useState(() => (keep === undefined ? "" : held(keep)))
  const [text, setText] = useState(waiting)
  const [writing, setWriting] = useState(waiting !== "")
  const [sending, setSending] = useState<Said>()
  const [refused, setRefused] = useState<string>()
  /*
   * What this reader last sent, where GitHub says nothing about it.
   *
   * Read once, in the first render, so the panel is right the moment it is drawn. See
   * `verdicts.ts` for why a comment-only review needs remembering at all.
   */
  const [ours, setOurs] = useState(() => (keep === undefined ? undefined : remembered(keep)))

  const write = (said: string) => {
    setText(said)
    if (keep !== undefined) hold(keep, said)
  }

  const already = alreadySaid(reviews, viewer.login)

  /*
   * GitHub answers an approval of your own pull request with 422, so it is not offered.
   *
   * Their own page hides the whole dialog there. Commenting on your own is allowed and is what
   * an author does when they answer a round of review, so that button stays.
   */
  const mine = author.login === viewer.login
  const offered = VERDICTS.filter((one) => !(mine && one.said === "approve"))

  const send = (said: Said) => {
    const note = text.trim()
    if (sending !== undefined) return
    if (note === "" && !(VERDICTS.find((one) => one.said === said)?.wordless ?? false)) return

    setSending(said)
    setRefused(undefined)
    Effect.runFork(
      onReview({ verdict: said, note, headSha }).pipe(
        Effect.match({
          onSuccess: () => {
            setSending(undefined)
            setText("")
            setWriting(false)
            if (keep !== undefined) {
              forget(keep)
              remember(keep, { verdict: said, headSha })
              setOurs({ verdict: said, headSha })
            }
          },
          // Kept in the box, which is the whole of the complaint about their dialog: a review
          // refused there comes back empty and the words are gone.
          onFailure: (cause: unknown) => {
            setRefused(cause instanceof Error ? cause.message : String(cause))
            setSending(undefined)
          }
        })
      )
    )
  }

  /*
   * What GitHub says comes first, then what this interface sent, then nothing.
   *
   * That order and not the other: a verdict of theirs is the record, and one of ours is a note
   * about a route they answer nothing on.
   */
  const summary = Option.isSome(already)
    ? SAID[already.value]
    : ours === undefined
      ? "not read yet by you"
      : `${OURS[ours.verdict]}${ours.headSha === headSha ? "" : ", at an older commit"}`

  /*
   * A verdict on the record turns the panel's edge, the way a merged pull request turns the
   * merge card's. Nothing else in this column says "you are done here", and this is the panel
   * whose whole subject is whether the reader is.
   */
  const tone = Option.isSome(already)
    ? already.value === "changes-requested"
      ? "bad"
      : already.value === "approved"
        ? "done"
        : "plain"
    : "plain"

  const Verb = ({ one }: { readonly one: (typeof VERDICTS)[number] }) => {
    const busy = sending === one.said

    return (
      <button
        type="button"
        disabled={sending !== undefined || (!one.wordless && text.trim() === "")}
        aria-busy={busy ? true : undefined}
        onClick={() => send(one.said)}
        className={`rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ${one.dress}`}
      >
        <Says
          among={[one.word, one.working]}
          said={busy ? one.working : one.word}
          waiting={one.working}
        />
      </button>
    )
  }

  return (
    <Section name="Verdict" art="eye" summary={summary} tone={tone}>
      {/*
       * Which commit is being judged, because GitHub does not clear a verdict when the branch
       * moves: an approval given here goes on standing over whatever is pushed next, and the
       * reader is the only one who can know whether that is what they meant.
       */}
      {/* Inline rather than a flex row: the comma after the sha belongs to the sentence, and a
          gap between them read as a comma that had slipped off the end of the word. */}
      <p className="border-b border-line-muted px-3 py-2 text-xs leading-snug text-ink-muted">
        About <code className="font-mono text-ink">{shortly(headSha)}</code>, the last commit on
        this branch.
      </p>
      {writing ? (
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
          <Writing
            text={text}
            onText={write}
            placeholder={mine ? "Answer the review" : "Say what you found"}
            onEscape={() => setWriting(false)}
            onSend={() => send(mine ? "comment" : "approve")}
            suggest={suggest}
            onUpload={onUpload}
          />
          {refused === undefined ? null : (
            <p className="text-xs leading-snug text-fail">
              GitHub would not take that: {refused}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {offered.map((one) => (
              <Verb key={one.said} one={one} />
            ))}
            {/* Wearing nothing until it is pointed at, which is what `GHOST` is for: the three
                verbs beside it carry the plain fill, and a fourth control with a step of the
                ladder on it was the only thing in the row that looked like a button. */}
            <button
              type="button"
              disabled={sending !== undefined}
              onClick={() => setWriting(false)}
              className={`${GHOST} ml-auto px-2.5 py-1 text-xs font-semibold text-ink-muted enabled:hover:bg-hover enabled:hover:text-ink`}
            >
              Cancel
            </button>
          </div>
          {/*
           * Said once, under the buttons, rather than as a tooltip on a button that looks
           * broken: GitHub refuses both of those without a body.
           */}
          {text.trim() === "" ? (
            <p className="text-xs text-ink-muted">
              {mine
                ? "GitHub wants words with a comment."
                : "An approval needs no words. The other two do."}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* At rest beside the fold, because it is the common answer and the one that needs
              nothing typed. Everything else is a press away, which is still three fewer than
              GitHub's own dialog asks for. */}
          {mine ? null : <Verb one={VERDICTS[0]!} />}
          <button
            type="button"
            onClick={() => setWriting(true)}
            className={`${PRESSABLE} min-w-0 flex-1 px-2.5 py-1 text-left text-xs text-ink-muted hover:bg-active hover:text-ink`}
          >
            {text.trim() !== ""
              ? "Carry on with what you were writing"
              : mine
                ? "Answer the review"
                : "Say what you found"}
          </button>
        </div>
      )}
    </Section>
  )
}
