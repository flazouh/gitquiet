import { Effect, type Option } from "effect"
import { useState } from "react"
import { type Raised, type Raising, enough } from "../domain/raising"
import type { Repository } from "../domain/repositories"
import { PRESSABLE } from "./dress"
import { Field } from "./Field"
import { Says } from "./says"
import { TheBar } from "./TheBar"
import { Writing } from "./Writing"

export type RaiseScreenProps = {
  readonly repo: { readonly owner: string; readonly repo: string }
  /**
   * What the boxes open with, which the address may have written: a "report
   * this" link arrives with the first sentence already typed, and a form that
   * opened empty would throw it away.
   */
  readonly seed: Raising
  readonly onRaise: (draft: Raising) => Effect.Effect<Raised, unknown>
  /** Where to go once GitHub has given it a number, which is the issue itself. */
  readonly onRaised: (raised: Raised) => void
  /** Restores GitHub's own form, which is still on the page behind this. */
  readonly onStepAside: () => void
  /**
   * The repository list as the last visit to Home left it, for the palette
   * behind ⌘K. Out of the store rather than off the network, as every other
   * screen reads it.
   */
  readonly recallRepositories?: () => Effect.Effect<
    Option.Option<ReadonlyArray<Repository>>
  >
}

/** What the send button says, at rest and while GitHub is being asked. */
const WORDS = ["Raise it", "Raising…"] as const

/**
 * Raising an issue — `/owner/repo/issues/new`.
 *
 * The only screen here that reads nothing. Every other one arrives with a
 * question for GitHub and something to draw while it is answered; this one has
 * all it needs the moment it appears, which is a box for a title and a box for
 * what happened. So there is no wait, nothing remembered, and nothing to freshen.
 *
 * Two fields, against the eight their own form offers. Assignees, labels,
 * projects, a milestone, an issue type and a parent are each a control standing
 * between the reader and the sentence they came to write, and each is a second
 * write on a thing that does not exist yet. They belong on the issue's own page,
 * which is where this screen goes the moment GitHub gives the issue a number.
 */
export const RaiseScreen = ({
  repo,
  seed,
  onRaise,
  onRaised,
  onStepAside,
  recallRepositories
}: RaiseScreenProps) => {
  const [title, setTitle] = useState(seed.title)
  const [body, setBody] = useState(seed.body)
  const [raising, setRaising] = useState(false)
  const [refused, setRefused] = useState<string | undefined>(undefined)

  const draft: Raising = { title, body }
  const ready = enough(draft)

  const raise = () => {
    if (!ready || raising) return

    setRaising(true)
    setRefused(undefined)

    Effect.runFork(
      onRaise(draft).pipe(
        Effect.match({
          /*
           * Deliberately left saying "Raising…" rather than set back. The next
           * thing that happens is the issue's own page, and a button that
           * un-presses itself first reads as a press that did not take.
           */
          onSuccess: (landed) => onRaised(landed),
          // Kept in the boxes on refusal, for the reason a remark is: whatever
          // GitHub objected to, what was typed is the one thing here that cannot
          // be fetched again.
          onFailure: (cause: unknown) => {
            setRefused(cause instanceof Error ? cause.message : String(cause))
            setRaising(false)
          }
        })
      )
    )
  }

  const named = `${repo.owner}/${repo.repo}`

  return (
    <div className="relative">
      <TheBar
        where={{ kind: "repository", owner: repo.owner, repo: repo.repo }}
        recall={recallRepositories}
      />
      <div className="t-panels flex flex-col gap-3 py-3">
        <div className="flex flex-col gap-2 rounded-md bg-surface p-3">
          <h1 className="text-xs font-semibold text-ink-muted">
            A new issue in <span className="text-ink">{named}</span>
          </h1>

          {/* The caret starts here, which is the field GitHub requires and the one
              a reader has words for first. */}
          <Field
            value={title}
            onChange={setTitle}
            label="What happened, in one line"
            autoFocus
            onSend={raise}
          />

          <Writing
            text={body}
            onText={setBody}
            placeholder="Anything that would help somebody reproduce it. Optional."
            focused={false}
            onEscape={onStepAside}
            onSend={raise}
          />

          {refused === undefined ? null : (
            <p className="text-xs text-fail">GitHub would not take that: {refused}</p>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!ready || raising}
              aria-busy={raising ? true : undefined}
              onClick={raise}
              className="rounded-md bg-pass-emphasis px-2.5 py-1 text-xs font-semibold text-ink-on-emphasis enabled:hover:opacity-90 disabled:opacity-40"
            >
              <Says among={WORDS} said={raising ? WORDS[1] : WORDS[0]} waiting={WORDS[1]} />
            </button>
            <button
              type="button"
              disabled={raising}
              onClick={onStepAside}
              className={`${PRESSABLE} px-2.5 py-1 text-xs font-semibold text-ink enabled:hover:bg-active`}
            >
              Show GitHub's form
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
