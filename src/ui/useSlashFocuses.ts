import { useEffect, type RefObject } from "react"

/**
 * `/` puts the caret in a box, which is the shortcut GitHub took away.
 *
 * Their gist list had it and lost it in 2024, and GitHub's own answer in Community
 * #131464 is that "this change was in fact intentional... it wasn't being used very
 * much" — against a reader in #140427: "Very frustrating that this feature was
 * removed... it's such a pain compared to how simple it was before." It costs one
 * listener to give back.
 *
 * Written once because the rule that matters is the same wherever it is used, and it is
 * the half that is easy to leave out: **not while the reader is already typing.** A `/`
 * meant for a filename, a Label, a path, or GitHub's own box is a `/`, and stealing it
 * is worse than never having the shortcut at all.
 *
 * Selects as well as focuses, so a second `/` replaces what is in the box rather than
 * appending to it — which is what a reader pressing it twice means both times.
 */
export const useSlashFocuses = (box: RefObject<HTMLInputElement | null>): void => {
  useEffect(() => {
    const heard = (event: KeyboardEvent): void => {
      // A modified slash belongs to the browser or the operating system.
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return

      const on = event.target
      const typing =
        on instanceof HTMLElement &&
        (on.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(on.tagName))
      if (typing) return

      event.preventDefault()
      box.current?.focus()
      box.current?.select()
    }

    document.addEventListener("keydown", heard)
    return () => document.removeEventListener("keydown", heard)
  }, [box])
}
