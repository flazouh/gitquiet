import { createContext, type KeyboardEvent, useContext } from "react"
import { DEFAULT_PROFILE, type Profile } from "../keys/commands"
import { type Letter, letterFor } from "../keys/letters"

/**
 * Whose keys these are, for everything below the screen that knows.
 *
 * A context rather than a prop, because the things that answer to letters are at
 * the bottom of the tree — an item inside a menu inside a row inside a Court —
 * and threading the profile through six components that have no opinion about
 * keyboards is how a prop ends up being passed by every component in a codebase.
 *
 * The default is the standard profile, so a menu rendered by a test or by a
 * screen that has not got around to providing this still answers to its letters.
 */
const Whose = createContext<Profile>(DEFAULT_PROFILE)

/** Names the profile every menu and dialogue inside this reads its letters against. */
export const Keying = Whose.Provider

export const useKeying = (): Profile => useContext(Whose)

/**
 * The letters whatever is on top answers to, as a handler it can wear.
 *
 * Handed to the element the reader is inside — a menu's content, a dialogue's
 * panel — rather than added to the document, and that is the whole design. The
 * page's own keyboard deliberately stands down while a menu of ours is up (see
 * `useKeys`), because Escape and `j` belong to the innermost thing on the screen;
 * a second document listener for these would be that rule broken by the layer
 * that wrote it. A handler on the thing that is up is only live while it is.
 *
 * A press that is answered is taken firmly out of the air. Three things would
 * otherwise hear it: the menu's own typeahead, which jumps focus to whatever item
 * starts with that letter; GitHub's page underneath, where half these letters are
 * their own shortcuts; and the browser. Radix reads a prevented default as "this
 * press was somebody else's", so preventing it here is also how its typeahead is
 * told to leave the key alone.
 *
 * Nothing is answered where the reader has turned the keyboard off. That setting
 * exists so somebody who lives in GitHub's own shortcuts keeps them untouched,
 * and a letter that closed a pull request from inside our menu would be exactly
 * the surprise they turned it off to avoid.
 */
export const useLetters = (
  answers: Readonly<Partial<Record<Letter, () => void>>>
): ((event: KeyboardEvent) => void) => {
  const profile = useKeying()

  // Not memoised. The table is written inline where the items are, so it is a
  // new object on every render and a `useCallback` around it would be a
  // dependency check that never holds — and nothing subscribes to this handler
  // the way an effect subscribes to a listener, so a new function costs nothing.
  return (event: KeyboardEvent) => {
    if (profile === "off" || event.repeat) return

    const letter = letterFor(
      {
        key: event.key,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        alt: event.altKey,
        shift: event.shiftKey
      },
      Object.keys(answers)
    )
    if (letter === null) return

    const act = answers[letter]
    if (act === undefined) return

    event.preventDefault()
    event.stopPropagation()
    act()
  }
}
