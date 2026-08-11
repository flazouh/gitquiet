import { Effect, Option } from "effect"
import { putsBack, type RowDoing } from "../domain/doable"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { reasonFor } from "./refusal"
import { done, refused } from "./Toasts"
import { SAID } from "./rowDoings"

/**
 * How a surface asks GitHub for one of the row verbs.
 *
 * The `ask` half of `Asking`, taken as a function rather than as that type, so
 * that this module knows nothing about the menu it was written for: the merge
 * card asks the same five things of the same gateway and wants the same sentence
 * afterwards.
 */
export type Ask = (doing: RowDoing, reference: PullRequestRef) => Effect.Effect<void, unknown>

/**
 * The pull request, named the way it is named everywhere it is spoken about.
 *
 * `owner/repo#12` and not `#12`. A toast is read at the top of the window, a
 * second after the row that caused it has moved into another Court or out of the
 * filter altogether, and the Working Set holds pull requests from every
 * repository the reader touches — so the number alone is a sentence about
 * something the reader has to go and find.
 */
const named = (reference: PullRequestRef): string =>
  `${reference.owner}/${reference.repo}#${reference.number}`

/**
 * Asking GitHub for a verb, and saying either what happened or why it did not.
 *
 * The whole of what a surface owes the reader after a press, in one place because
 * both halves were being written out again at every control: the refusal, which
 * is the only thing an optimistic list can do with a no, and the way back, which
 * is what makes a single press honest. A verb with an opposite is offered it here;
 * a verb without one — merging — gets the sentence and nothing else, and is asked
 * about twice before it goes instead.
 *
 * Undoing is asked for through this same function, so the undo of a close is a
 * reopen that reports itself and can be undone in turn. That is not a flourish:
 * the reader who undid the wrong row needs the same way out the first press gave
 * them, and a one-way undo would be a second mistake with no answer.
 */
export const askAndSay = (
  ask: Ask,
  doing: RowDoing,
  reference: PullRequestRef
): Effect.Effect<void> =>
  ask(doing, reference).pipe(
    Effect.map(() => {
      done(
        `${named(reference)} ${SAID[doing]}`,
        Option.match(putsBack(doing), {
          onNone: () => undefined,
          onSome: (back) => ({
            said: "Undo",
            go: () => {
              Effect.runFork(askAndSay(ask, back, reference))
            }
          })
        })
      )
    }),
    Effect.catch((cause) => Effect.sync(() => refused(reasonFor(cause))))
  )
