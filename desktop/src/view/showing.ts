import { sameReference, type PullRequestRef } from "../../../src/domain/PullRequestRef"

/**
 * Which of the two screens the window is showing.
 *
 * A pair of states rather than an address. The extension navigates because it lives
 * inside somebody else's navigation; here there is one window, and going back to the
 * list is the list being drawn again — which also means it is read again, and a pull
 * request the reader has just dealt with is gone from it.
 *
 * Held out here rather than in the component, because the two things that change it are
 * not both in React. A press on a link is answered by a rule installed on the document
 * before anything is rendered — it has to be, since a link followed in this window
 * replaces the app with a web page — and that rule cannot reach a component's state.
 * It was reaching it through a callback the component registered on the way past, which
 * is a second copy of this state's identity, in a module that also has to say what to do
 * when nobody has registered yet. One window, one root, one of these.
 */
export type Showing =
  | { readonly at: "list" }
  | { readonly at: "card"; readonly reference: PullRequestRef }

const THE_LIST: Showing = { at: "list" }

let showing: Showing = THE_LIST
const watchers = new Set<() => void>()

const now = (next: Showing): void => {
  showing = next
  for (const tell of watchers) tell()
}

/**
 * This window becomes that pull request.
 *
 * The one already on the screen is not opened again, and that guard is the whole reason
 * this is a function rather than a setter. A reference read off a link is a new object
 * every press, so React sees a new value and every read the card keyed on it runs
 * again: the card is torn down, GitHub is asked for it a second time, and the reader
 * loses their place in a file they were reading. A press on a link to the card you are
 * already on is a press that should do nothing at all. See `elsewhereThan`, where the
 * extension met this same fault and wrote down what it cost.
 */
export const openCard = (reference: PullRequestRef): void => {
  if (showing.at === "card" && sameReference(showing.reference, reference)) return
  now({ at: "card", reference })
}

/** The list, which is the screen this window goes back to and starts on. */
export const openTheList = (): void => {
  if (showing.at === "list") return
  now(THE_LIST)
}

export const nowShowing = (): Showing => showing

export const watchShowing = (tell: () => void): (() => void) => {
  watchers.add(tell)
  return () => {
    watchers.delete(tell)
  }
}
