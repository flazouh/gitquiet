import { createContext, useContext, useEffect, useRef } from "react"
import { heldDown, type Command, type Profile } from "../keys/commands"
import { commandFor, read, type Waiting } from "../keys/match"
import { ROOT_ID } from "./mount"

/**
 * The part of the page that is ours.
 *
 * This interface is a guest on GitHub's page, and GitHub keeps thirty dropdowns
 * in the document at all times — every one of them marked as a menu, whether it
 * is showing or not. Asking the whole page whether anything is open therefore
 * always answers yes, and the keyboard would go quiet for the length of the
 * review. Only what we put up can be what the reader is in.
 */
const Ours = createContext<HTMLElement | null>(null)

/** Names the element every dialog and menu of ours is drawn inside. */
export const KeyboardScope = Ours.Provider

/**
 * Whether the keypress is going somewhere it will be typed.
 *
 * Read off the composed path rather than off `event.target`: the diff renderer
 * keeps its rows in a shadow root, and an event crossing a shadow boundary is
 * retargeted to the host on the way out — so `target` says "the diff" for a
 * keystroke that is actually landing in a comment box inside it.
 *
 * While a box has the focus the keyboard is silent, Escape included. A note
 * discards itself on Escape and a menu closes itself; reaching over their heads
 * would take the reader's half-written comment down with whatever else was
 * open.
 */
const beingTypedIn = (event: KeyboardEvent): boolean => {
  const [innermost] = event.composedPath()
  const element = innermost instanceof HTMLElement ? innermost : null
  if (element === null) return false

  const name = element.tagName
  return name === "INPUT" || name === "TEXTAREA" || name === "SELECT" || element.isContentEditable
}

/**
 * Whether a dialog or a menu of ours has the screen.
 *
 * Whatever is open on top is the innermost thing, so it owns the keyboard for
 * as long as it is up — Escape above all, which has to close the dialog the
 * reader is looking at rather than reach past it and close what they opened it
 * from. The page's own keys go quiet instead of firing behind it. Both are only
 * in the document while they are showing, so their being found is the question
 * being answered.
 *
 * Asked of our own interface rather than of the page: GitHub's markup is not an
 * answer to what the reader has open here.
 */
const somethingIsUp = (within: ParentNode): boolean =>
  within.querySelector('dialog[open], [role="menu"]') !== null

/**
 * Which part of the page to ask, before the interface has said where it is.
 *
 * The scope is an element, so it is only known once React has put one on the
 * screen — one render after the first. Asking the whole document in the
 * meantime meant asking GitHub's, whose two dozen permanently-present menus
 * always answer yes, so a key pressed in the first moments of a page did
 * nothing and the press that appeared to work was the second one.
 *
 * The container the interface is drawn into exists before any of that: the
 * content script makes it, names it, and hands it to React. Finding it by name
 * is therefore an answer about our own markup at a time when nothing else is.
 * Where there is no such element — a test, a page this was never mounted on —
 * the document is still the honest answer.
 */
const scopeIn = (target: Document): ParentNode => target.getElementById(ROOT_ID) ?? target

/**
 * The keyboard, for as long as the component asking is on screen.
 *
 * One listener, in the capture phase, on the document: GitHub's own shortcuts
 * are live on this same page — `s` reaches for their search, `g` starts half a
 * dozen of their sequences — and a key we have claimed has to be taken out of
 * the air before their handlers see it. Anything we have no answer for is left
 * strictly alone, so their page keeps working exactly as it did.
 *
 * Several components may call this at once. Each answers the commands it owns:
 * the file browser moves between files, the tree opens its own filter. A
 * command nobody has claimed does nothing at all rather than being swallowed.
 */
export const useKeys = (
  profile: Profile,
  handlers: Partial<Record<Command, () => void>>,
  target: Document = document
): void => {
  // Through a ref: handlers are usually written inline and would otherwise
  // rebind the listener on every render of the page.
  const answer = useRef(handlers)
  answer.current = handlers
  const ours = useContext(Ours)

  // The key a sequence was opened with, kept across presses rather than in
  // state: nothing on the screen changes while a chord is half typed, and a
  // render between the two keys would be a render nobody asked for.
  const waiting = useRef<Waiting>(null)

  useEffect(() => {
    if (profile === "off") return

    const onKey = (event: KeyboardEvent) => {
      // A prepared route has a complete tree, but it cannot answer for the page
      // until its root is connected. Its listeners stay inert in the meantime.
      if (ours !== null && !ours.isConnected) return
      // A press left unread is still a press the reader made, so a sequence half
      // typed before one is given up on rather than left open: several
      // components bind the keyboard at once, and a `j` that the file browser
      // answered would otherwise leave a `g` pending here for the next press to
      // finish into a Destination nobody asked for.
      if (
        event.defaultPrevented ||
        beingTypedIn(event) ||
        somethingIsUp(ours ?? scopeIn(target))
      ) {
        waiting.current = null
        return
      }

      const press = {
        key: event.key,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        alt: event.altKey,
        shift: event.shiftKey
      }

      // A key being held down, which the operating system sends thirty times a
      // second for as long as the finger is there. Every one of them used to be
      // dropped, so holding `j` moved one file and then nothing happened at all.
      //
      // Read on its own rather than through the sequence: a chord is two
      // deliberate presses and cannot be held, and the leader arriving over and
      // over would finish one of GitHub's on the letter after it. The pending
      // sequence goes for the same reason it goes for any press this layer takes
      // — a `g` left in the air is a Destination nobody asked for.
      if (event.repeat) {
        waiting.current = null

        const again = commandFor(press, profile)
        if (again === null || !heldDown(again)) return

        const keep = answer.current[again]
        if (keep === undefined) return

        event.preventDefault()
        event.stopPropagation()
        keep()
        return
      }

      const reading = read(
        press,
        profile,
        waiting.current,
        (command) => answer.current[command] !== undefined
      )
      waiting.current = reading.waiting

      if (reading.command === null) {
        // The leader of a sequence somebody here answers is taken as firmly as
        // the command it leads to. GitHub's own sequences start on the same key,
        // and leaving it in the air would have them halfway through one of
        // theirs while the reader finishes ours.
        if (reading.waiting !== null) {
          event.preventDefault()
          event.stopPropagation()
        }
        return
      }

      const act = answer.current[reading.command]
      if (act === undefined) return

      // Every command but the way out is taken out of the air: GitHub's own
      // shortcuts are live on these same letters and would fire behind us.
      // Escape is left in it. Everything that can be closed is listening for
      // Escape — menus, bubbles, dialogs, the browser's own handling of them —
      // and a handler at the top of the page that swallowed it would close the
      // outermost thing while the innermost one stayed exactly where it was.
      if (reading.command !== "dismiss") {
        event.preventDefault()
        event.stopPropagation()
      }
      act()
    }

    target.addEventListener("keydown", onKey, true)
    return () => target.removeEventListener("keydown", onKey, true)
  }, [profile, target, ours])
}
