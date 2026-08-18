import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  DIFF_KNOBS,
  SIGN_ON_KNOBS,
  THEME_KNOBS,
  type Knob,
  type Settings,
  TREE_KNOBS
} from "../domain/Settings"
import { type ArtName, useArt } from "./art"
import { HERE, TINT } from "./dress"
import { OVER_ID, outsideHost } from "./outside"
import { sampleOf } from "./SettingsPreview"

export type SettingsDialogProps = {
  readonly settings: Settings
  readonly onChange: (settings: Settings) => void
}

/** A knob, what it is set to, and where a change to it is written. */
type Pick = (key: string, value: string) => void

/** One heading's worth of knobs inside a tab. */
type Part = {
  /** Named only where a tab holds more than one, which is the advanced one. */
  readonly heading?: string
  readonly knobs: ReadonlyArray<Knob<string, string>>
  readonly chosen: Record<string, string>
  readonly onPick: Pick
}

/**
 * What the panel on the right is showing.
 *
 * `peeked` is the choice the pointer is on, which is not the choice that has
 * been made: the picture answers "what would this do" without anything being
 * changed and put back.
 */
type Look = {
  readonly knob: Knob<string, string>
  readonly chosen: string
  readonly peeked: string | null
}

type Told = (look: Look) => void

/** The glyph is a name here, because which set draws it is read in a render. */
type Page = {
  readonly id: string
  readonly label: string
  readonly note: string
  readonly art: ArtName
}

const PAGES: ReadonlyArray<Page> = [
  {
    id: "appearance",
    label: "Appearance",
    note: "Light or dark, which colour pack paints the screens, and which set draws the glyphs.",
    art: "appearance"
  },
  {
    id: "diff",
    label: "Diff",
    note: "How a changed file is drawn.",
    art: "diff"
  },
  {
    id: "files",
    label: "Files",
    note: "The rail down the side, and what it says about each file.",
    art: "files"
  },
  {
    id: "advanced",
    label: "Advanced",
    note: "The knobs most readers never need, kept out of the way rather than out of reach.",
    art: "settings"
  }
]

/**
 * One knob: what it is called, the gist of it, and the choice.
 *
 * Three lines of prose per row put twenty-two rows past the height of any
 * dialog, and a reader looking for the one they came in for reads the names.
 * The whole trade is a pointer away in the panel beside this, and is here in
 * full for anyone having the row read out, who has no panel to look at.
 */
const Row = ({
  knob,
  chosen,
  onPick,
  onLook
}: {
  readonly knob: Knob<string, string>
  readonly chosen: string | undefined
  readonly onPick: Pick
  readonly onLook: Told
}) => {
  // Radios are grouped by name, and two dialogs' worth of the same knob on one
  // page would otherwise be one group that can only hold a single answer.
  const group = useId()
  const held = chosen ?? knob.fallback
  const look = (peeked: string | null) => onLook({ knob, chosen: held, peeked })

  return (
    <li
      className="flex items-center gap-4 py-3"
      onPointerEnter={() => look(null)}
      onFocus={() => look(null)}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-ink">{knob.label}</span>
        <span className="text-xs text-ink-muted">{knob.gist}</span>
        <p className="sr-only">{knob.note}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={knob.label}
        // One reset for the whole control: a pointer crossing from one choice to
        // the next passes between them, and a reset on each would flicker the
        // picture back to what is in use on the way.
        onPointerLeave={() => look(null)}
        // Wrapping rather than truncating: three short words fit across, and the
        // one knob with four long ones falls into two rows instead of becoming
        // four unreadable stubs.
        // A trough rather than a box: the choices sit in a tint and the chosen one
        // is the only filled thing in it, which is what a reader is looking for.
        className={`${TINT} flex w-[13.5rem] shrink-0 flex-wrap gap-0.5 rounded-md p-0.5`}
      >
        {knob.choices.map((choice) => (
          <label
            key={choice.value}
            onPointerEnter={() => look(choice.value)}
            onFocus={() => look(choice.value)}
            /*
             * Wide enough for the longest word any knob offers, which is
             * `Characters`. It used to be narrower and truncate, and `Charac…`
             * beside `Words` and `Off` is a choice a reader has to guess at —
             * the one thing a row of choices cannot afford.
             */
            className="flex min-w-16 flex-1 cursor-pointer items-center justify-center rounded-sm px-1.5 py-1 text-center text-[11px] text-ink-muted hover:text-ink has-[:checked]:bg-accent-emphasis has-[:checked]:font-semibold has-[:checked]:text-ink-on-emphasis"
          >
            <input
              type="radio"
              name={group}
              value={choice.value}
              checked={choice.value === held}
              onChange={() => onPick(knob.key, choice.value)}
              className="sr-only"
            />
            <span className="truncate">{choice.label}</span>
          </label>
        ))}
      </div>
    </li>
  )
}

const Rows = ({ part, onLook }: { readonly part: Part; readonly onLook: Told }) => (
  <>
    {part.heading === undefined ? null : (
      <h3 className="pt-4 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
        {part.heading}
      </h3>
    )}
    <ul className="flex flex-col divide-y divide-line-muted">
      {part.knobs.map((knob) => (
        <Row
          key={knob.key}
          knob={knob}
          chosen={part.chosen[knob.key]}
          onPick={part.onPick}
          onLook={onLook}
        />
      ))}
    </ul>
  </>
)

/**
 * The picture, and the whole of what the knob costs.
 *
 * Hidden from assistive technology on purpose: every word of it is already in
 * the row this is showing, and a mockup of a diff read out loud is noise. It is
 * a panel for looking at.
 */
const Panel = ({ look }: { readonly look: Look }) => {
  const shown = look.peeked ?? look.chosen
  const choice = look.knob.choices.find((one) => one.value === shown)

  return (
    <aside
      aria-hidden
      /* The top is left clear rather than padded evenly: the way out of the
         dialog sits in that corner, and forty-four pixels is where the column
         beside this one starts its first row. */
      className="flex w-72 shrink-0 flex-col gap-3 border-l border-line bg-surface px-4 pt-11 pb-4"
    >
      {/* The frame the preview stands in is an inset fill rather than a box, so
          the picture inside it separates itself the way the app does. */}
      <figure className="flex min-h-36 items-center justify-center overflow-hidden rounded-md bg-inset p-3">
        {sampleOf(look.knob.key, shown)}
      </figure>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink">{look.knob.label}</span>
        <span className="text-[11px] text-ink">
          {choice?.label}
          {shown === look.chosen ? " · in use" : ""}
        </span>
        <p className="text-xs leading-relaxed text-ink-muted">{look.knob.note}</p>
      </div>
    </aside>
  )
}

/**
 * Everything the diff and the rail can be told to do, in front of the page.
 *
 * A menu was the wrong shape for this. Every one of these knobs is a trade, the
 * sentence that explains the trade is three lines long, and a picture of each
 * choice settles it faster than either — none of which fits in a row of a
 * dropdown that also has to be scrolled past. So: the names and the switches in
 * one column, the explanation and the picture in a panel that follows the
 * pointer, and three pages rather than one column twenty-two knobs deep.
 */
export const SettingsSheet = ({
  settings,
  onChange,
  onClose
}: SettingsDialogProps & { readonly onClose: () => void }) => {
  const art = useArt()
  const Close = art.close
  const frame = useRef<HTMLDialogElement | null>(null)
  const [page, setPage] = useState("appearance")
  const [look, setLook] = useState<Look | null>(null)

  useEffect(() => {
    const box = frame.current
    if (box === null) return

    box.showModal()

    // Escape is answered here rather than left to the browser, for the reason
    // the check dialog gives: this runs inside GitHub's page, and anything
    // upstream that cancels the keypress first would quietly take the way out
    // away.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return
      event.preventDefault()
      event.stopPropagation()
      box.close()
    }

    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [])

  const pickTheme: Pick = (key, value) =>
    onChange({ ...settings, theme: { ...settings.theme, [key]: value } })
  const pickDiff: Pick = (key, value) =>
    onChange({ ...settings, diff: { ...settings.diff, [key]: value } })
  const pickTree: Pick = (key, value) =>
    onChange({ ...settings, tree: { ...settings.tree, [key]: value } })
  const pickSignOn: Pick = (key, value) =>
    onChange({ ...settings, signOn: { ...settings.signOn, [key]: value } })

  const plain = (knob: Knob<string, string>) => !knob.advanced
  const deep = (knob: Knob<string, string>) => knob.advanced

  const parts: Record<string, ReadonlyArray<Part>> = {
    appearance: [{ knobs: THEME_KNOBS, chosen: settings.theme, onPick: pickTheme }],
    diff: [{ knobs: DIFF_KNOBS.filter(plain), chosen: settings.diff, onPick: pickDiff }],
    files: [{ knobs: TREE_KNOBS.filter(plain), chosen: settings.tree, onPick: pickTree }],
    advanced: [
      { heading: "Diff", knobs: DIFF_KNOBS.filter(deep), chosen: settings.diff, onPick: pickDiff },
      { heading: "Files", knobs: TREE_KNOBS.filter(deep), chosen: settings.tree, onPick: pickTree },
      /*
       * Here as well as on the wall's own card, and this is the half that matters.
       * The card is drawn on a page a reader only reaches when an organisation puts
       * it in their way, and turning the knob on there is what stops that page ever
       * being drawn again — so the card alone is a switch with no way back. This row
       * is the way back.
       */
      {
        heading: "Signing on",
        knobs: SIGN_ON_KNOBS,
        chosen: settings.signOn,
        onPick: pickSignOn
      }
    ]
  }

  const shown = PAGES.find((one) => one.id === page) ?? PAGES[0]!
  const here = parts[shown.id] ?? []

  // The panel rests on the first knob of the page rather than on nothing: an
  // empty half of the dialog is a hole where an example should be, and the first
  // row is the one a pointer heading for the list passes through anyway.
  const first = here[0]
  const resting: Look | null =
    first === undefined || first.knobs[0] === undefined
      ? null
      : {
          knob: first.knobs[0],
          chosen: first.chosen[first.knobs[0].key] ?? first.knobs[0].fallback,
          peeked: null
        }
  const looking = look ?? resting

  return (
    <dialog
      ref={frame}
      onClose={onClose}
      // A press on the dialog element itself landed beside the card, because the
      // card fills its box.
      onClick={(event) => {
        if (event.target === event.currentTarget) frame.current?.close()
      }}
      aria-label="Settings"
      /*
       * Sized to leave the edges alone, and how much of an edge to leave is the
       * shell's to say. On a page there is nothing above this but the page; in the
       * app's own window the top-left corner belongs to the traffic lights, and a
       * dialog centred in 86% of that window put its own first heading underneath
       * them. `--sheet-away` is how much room the furniture needs, set once by
       * whichever shell this is drawn in and ignored by the one that has none.
       *
       * Centred here rather than left to the browser, which does centre a modal
       * dialog — with `margin: auto`, and both of these interfaces are built on a
       * reset that sets every margin to zero. The app's window showed what that
       * costs: the sheet sat in the top-left corner with its own first heading
       * under the traffic lights, and looked like something that had come loose.
       */
      className="t-modal m-auto h-[34rem] max-h-[calc(100vh-var(--sheet-away,4rem))] w-[64rem] max-w-[calc(100vw-var(--sheet-away,4rem))] overflow-hidden rounded-lg border border-line bg-canvas p-0 text-ink backdrop:bg-black/50"
    >
      <div className="relative flex h-full min-w-0">
        <nav
          aria-label="Settings sections"
          role="tablist"
          className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-line bg-surface p-2"
        >
          <span className="px-2 pt-1 pb-2 text-xs font-semibold text-ink-muted">Settings</span>
          {PAGES.map((one) => {
            const on = one.id === shown.id
            const Art = art[one.art]
            return (
              <button
                key={one.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setPage(one.id)
                  setLook(null)
                }}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                  on ? `${HERE} font-semibold` : "text-ink-muted hover:bg-hover"
                }`}
              >
                <Art size={14} className="shrink-0" />
                {one.label}
              </button>
            )
          })}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-baseline gap-3 border-b border-line px-5 py-3">
            <h2 className="shrink-0 text-sm font-semibold">{shown.label}</h2>
            <p className="min-w-0 flex-1 truncate text-xs text-ink-muted">{shown.note}</p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            {here.map((part, at) => (
              <Rows key={part.heading ?? at} part={part} onLook={setLook} />
            ))}
          </div>
        </div>
        {looking === null ? null : <Panel look={looking} />}
        {/* The way out belongs to the dialog rather than to the column it used to
            sit in the corner of: with the preview beside that column, its right
            edge is the middle of the card, and a close button halfway across a
            dialog is a close button nobody's hand goes to. Last in the order, so
            the sections and the knobs are reached before the way out of them. */}
        <button
          type="button"
          aria-label="Close settings"
          onClick={() => frame.current?.close()}
          className="absolute top-2.5 right-3 flex items-center rounded-md p-1 text-ink-muted hover:bg-hover hover:text-ink"
        >
          <Close size={14} />
        </button>
      </div>
    </dialog>
  )
}

/**
 * The way in, and the dialog it opens.
 *
 * Mounted only while it is open, so the page's keyboard can ask the document
 * what the reader is looking at and get an answer that is true.
 *
 * The sheet is portalled out of the tray it is opened from. The button stands in the bar's pane,
 * and that pane is glass: `backdrop-filter` makes an element the containing block for everything
 * positioned inside it, and a modal in the top layer is not exempt. Chrome paints the `::backdrop`
 * over the page and then draws the sheet into the filtered forty-pixel strip, so the reader gets a
 * dimmed page with nothing on it. `glass.css` states the constraint and the toaster and the hover
 * cards already answer it the same way, through `outsideHost`.
 */
export const SettingsDialog = ({ settings, onChange }: SettingsDialogProps) => {
  const art = useArt()
  const Diff = art.diff
  const [open, setOpen] = useState(false)
  const host = typeof document === "undefined" ? null : outsideHost(document, OVER_ID)
  const sheet = open ? (
    <SettingsSheet settings={settings} onChange={onChange} onClose={() => setOpen(false)} />
  ) : null

  return (
    <>
      <button
        type="button"
        aria-label="Display settings"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center rounded-md px-1.5 py-1 text-ink-muted hover:bg-hover hover:text-ink"
      >
        <Diff size={16} />
      </button>
      {host === null || sheet === null ? sheet : createPortal(sheet, host)}
    </>
  )
}
