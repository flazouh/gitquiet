import { Fragment, useEffect, useRef, useState } from "react"
import { type ArtName, useArt } from "./art"
import { FLOAT } from "./dress"
import { Field } from "./Field"
import { Owner } from "./Owner"
import { useMenuPhase } from "./useMenuPhase"

/** One line in a menu: somewhere to go, or something to do. */
export type Row = {
  readonly name: string
  /**
   * What tells this row from the others, where the name does not.
   *
   * The name does in every menu but one. The trail behind the back button lists
   * places rather than pages, and a reader who has been to the same repository
   * twice by two routes has two rows reading the same words — which React
   * reconciles as one row, drawn once.
   */
  readonly id?: string
  readonly where?: string
  /**
   * What to do instead of following the address, on an unmodified press.
   *
   * Given beside `where` rather than instead of it where the row leads
   * somewhere this interface would rather handle itself. A menu row that only
   * calls this is a row a reader cannot open in a new tab, cannot copy the
   * address of, and cannot see the destination of before pressing — so the
   * address stays real and this takes over only the plain press. A held ⌘ or
   * ⇧ still belongs to the browser.
   */
  readonly press?: () => void
  /**
   * The glyph in front of the name.
   *
   * All of them or none of them, per menu: a column of words with one picture in it reads as
   * the only row that does anything. It stays optional because the type cannot say that, and
   * a caller building rows from something it is reading — their repository tabs — has to be
   * able to hand over what it found.
   */
  readonly art?: ArtName
  /**
   * Whose picture stands in front of the name, where a picture says it better than a glyph.
   *
   * A login, because their redirect answers one with an avatar and serves an organisation
   * exactly as it serves a person. Given instead of {@link Row.art}: a list of repositories
   * wearing one repeated glyph is a column of identical marks, where six faces can be told
   * apart without any of the names being read. See `Owner`.
   */
  readonly face?: string
  /**
   * Whether this row is the one the menu is already on.
   *
   * Marked at the end of the row rather than in front of it, which is where the
   * glyph above lives: a mark on one row of a leading column reads as the only
   * row that does anything, and this one is the row that does the least.
   */
  readonly chosen?: boolean
  /**
   * The pin beside the row, where the list has an order a reader can hold.
   *
   * The Rail's own affordance, drawn the Rail's way: on every row rather than on
   * hover, quiet until held. Pressing it re-sorts the list under the open menu
   * and neither navigates nor closes — pinning is housekeeping, not a choice of
   * destination.
   */
  readonly pin?: { readonly held: boolean; readonly toggle: () => void }
}

/**
 * Which corner the menu grows out of.
 *
 * Not decoration. A menu belonging to a control at the foot of a full-height strip has to
 * grow upwards from that corner, and one belonging to a control in a bar across the top has
 * to grow down from its own — growth from the middle, or from the wrong corner, reads as a
 * panel arriving from somewhere else on the page rather than as this control opening.
 */
export type Origin = "bottom-left" | "top-left" | "top-right"

/** How many rows a narrowed menu draws, past which another letter is the answer. */
const MOST_SHOWN = 50

const PLACED: Record<Origin, string> = {
  "bottom-left": "bottom-full left-0 mb-1",
  "top-left": "top-full left-0 mt-1",
  "top-right": "top-full right-0 mt-1"
}

/**
 * A menu that grows out of the control it belongs to.
 *
 * On the page while it is open and for one close after that. While it is leaving it keeps its
 * shape and stops being a menu: there is nothing in a fading ghost worth pointing at, or
 * reading aloud.
 *
 * It was the Rail's own, and became shared the moment the bar needed the same thing pointing
 * the other way. The two differ by one word.
 */
export const Menu = ({
  name,
  open,
  onShut,
  rows,
  origin = "bottom-left",
  wide = "w-52",
  find
}: {
  readonly name: string
  readonly open: boolean
  readonly onShut: () => void
  readonly rows: ReadonlyArray<Row>
  readonly origin?: Origin
  /** How wide, where the rows are longer than a Destination's name. */
  readonly wide?: string
  /**
   * What to invite in the field above the rows, where there should be one.
   *
   * Absent on a menu of five things, which is most of them: a field over five
   * rows is a control asking to be used to reach something already on screen.
   * Present on the branch picker, where the repository being read has a
   * thousand of them and the alternative is a column nobody can reach the
   * bottom of.
   */
  readonly find?: string
}) => {
  // Set by Escape, so the phase hook knows to skip the travelling-out: a key is not a hand.
  const [byKey, setByKey] = useState(false)
  const [asked, setAsked] = useState("")
  const phase = useMenuPhase(open, byKey)
  const surface = useRef<HTMLDivElement>(null)
  const up = phase === "arriving" || phase === "here"
  const art = useArt()

  // Emptied on the way out rather than on the way in, so the rows a reader
  // narrowed to do not flash back to all thousand of them while the menu fades.
  useEffect(() => {
    if (!open) setAsked("")
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      // Their own Escape closes their command palette, and this menu is the nearer
      // thing to close while it is up.
      event.stopPropagation()
      setByKey(true)
      onShut()
    }

    const onPress = (event: PointerEvent) => {
      setByKey(false)
      const inside =
        event.target instanceof Node && surface.current?.parentElement?.contains(event.target)
      if (!inside) onShut()
    }

    document.addEventListener("keydown", onKey, true)
    document.addEventListener("pointerdown", onPress, true)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      document.removeEventListener("pointerdown", onPress, true)
    }
  }, [open, onShut])

  if (phase === "shut") return null

  const wanted = asked.trim().toLowerCase()
  const narrowed =
    wanted === "" ? rows : rows.filter((one) => one.name.toLowerCase().includes(wanted))
  /*
   * Capped at what a reader can look through. A thousand branches is a thousand
   * elements built on every keystroke, and nobody reads past the first screen of
   * a list they are typing into: the answer to "it is not in the first fifty" is
   * another letter, not a scrollbar.
   */
  const shown = find === undefined ? narrowed : narrowed.slice(0, MOST_SHOWN)

  return (
    <div
      ref={surface}
      {...(up ? { role: "menu", "aria-label": name } : { "aria-hidden": true })}
      data-origin={origin}
      /*
       * The pack's own shadow rather than Tailwind's grey one.
       *
       * A surface lying over something else is the one place a shadow earns its keep.
       * `FLOAT` is that look, on the class, so a menu portalled above the page still
       * has it.
       */
      className={`t-menu ${
        phase === "here" ? "is-open" : phase === "leaving" ? "is-closing" : ""
      } absolute z-20 flex max-h-80 ${wide} flex-col gap-0.5 overflow-y-auto p-1 ${FLOAT} ${PLACED[origin]}`}
    >
      {find === undefined ? null : (
        // The field a picker is opened to type into. Nothing else in the menu is
        // worth arriving on, and reaching for the mouse to reach the field is the
        // whole of what a picker is meant to save.
        <Field
          value={asked}
          onChange={setAsked}
          label={find}
          art="search"
          room="tight"
          autoFocus
          reachable={up}
          className="mb-1"
        />
      )}
      {shown.length === 0 ? (
        <p className="px-2 py-1 text-sm text-ink-muted">Nothing by that name.</p>
      ) : null}
      {shown.map((one) => {
        const Mark = one.art === undefined ? undefined : art[one.art]
        // The glyph is the quiet half of the row and the name is not. Both at `text-ink-muted`
        // on a raised surface is 4:1 — a menu a reader has to look twice at, which is the whole
        // of the complaint that started this: with no line anywhere, ink is what is left.
        const said = (
          <>
            {one.face !== undefined ? (
              <Owner owner={one.face} size={16} />
            ) : Mark === undefined ? null : (
              <Mark size={14} className="shrink-0 text-ink-muted" />
            )}
            <span className="min-w-0 truncate">{one.name}</span>
            {one.chosen === true ? (
              <art.tick size={12} className="ml-auto shrink-0 text-ink-muted" />
            ) : null}
          </>
        )
        const dress =
          "flex items-center gap-2 rounded px-2 py-1 text-left text-sm text-ink hover:bg-active"

        const row =
          one.where === undefined ? (
            <button
              type="button"
              {...(up ? { role: "menuitem" } : {})}
              tabIndex={up ? undefined : -1}
              onClick={() => {
                one.press?.()
                onShut()
              }}
              className={`${dress} flex-1`}
            >
              {said}
            </button>
          ) : (
            <a
              {...(up ? { role: "menuitem" } : {})}
              tabIndex={up ? undefined : -1}
              href={one.where}
              className={`${dress} flex-1 no-underline`}
              onClick={(event) => {
                // Held keys belong to the browser — a new tab, a new window — and
                // the page under this menu is staying, so the menu stays with it.
                if (event.metaKey || event.ctrlKey || event.shiftKey) return
                if (one.press !== undefined) {
                  event.preventDefault()
                  one.press()
                }
                // A plain press chose a destination, whoever carries it out —
                // `press` above, or the shell answering the link from the top of
                // the document. Either way the choosing is over.
                onShut()
              }}
            >
              {said}
            </a>
          )

        const Pin = art.pinned
        return (
          <Fragment key={one.id ?? one.name}>
            {one.pin === undefined ? (
              row
            ) : (
              <div className="flex items-center gap-1">
                {row}
                <button
                  type="button"
                  onClick={one.pin.toggle}
                  aria-label={`${one.pin.held ? "Unpin" : "Pin"} ${one.name}`}
                  // The Rail's own square, for the Rail's reasons: always drawn, a
                  // whole target, quiet until pointed at or already holding.
                  className={`grid size-6 shrink-0 place-items-center rounded hover:bg-hover ${
                    one.pin.held ? "text-ink" : "text-ink-muted opacity-60 hover:opacity-100"
                  }`}
                >
                  <Pin size={14} />
                </button>
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
