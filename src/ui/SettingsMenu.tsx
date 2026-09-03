import * as Panel from "@radix-ui/react-popover"
import { useId, type ReactNode } from "react"
import { useArt } from "./art"
import {
  DIFF_KNOBS,
  THEME_KNOBS,
  TREE_KNOBS,
  type AnyKnob,
  type Settings
} from "../domain/Settings"
import { KNOB_ART } from "./knobArt"
import { ROOT_ID } from "./mount"
import { FIELD, FLOAT } from "./dress"
import { Slide } from "./Slide"

/**
 * Where everything this button opens is drawn.
 *
 * Inside our own root, because the theme is a set of inline custom properties on
 * that element and not on `<html>`: the rest of the document is GitHub's page,
 * and our names on their root would repaint their chrome. A panel portaled to
 * `document.body` instead reads the stylesheet's defaults, which are the light
 * pack — a white panel with near-black text over a dark page. See `outside.ts`,
 * written after the bar was paid for that once.
 *
 * Asked for on every render rather than held: the root is made by the mount and
 * remade whenever the page is taken over again, so a reference kept here would
 * be a reference to an element no longer in the document.
 */
const inOurs = (): HTMLElement | null =>
  typeof document === "undefined" ? null : document.getElementById(ROOT_ID)

export type SettingsMenuProps = {
  readonly settings: Settings
  readonly onChange: (settings: Settings) => void
  /**
   * What this button is called, where it stands beside another way into the same
   * knobs.
   *
   * A screen with a files band carries two: the sheet in the bar, which is where
   * the knobs are read about, and this panel above the diff. Two buttons on one
   * screen answering to the same name is two identical buttons to anybody
   * listening to the page rather than looking at it.
   */
  readonly label?: string
}

type Control = {
  readonly knob: AnyKnob
  readonly chosen: string | undefined
  readonly onPick: (key: string, value: string) => void
}

/**
 * A knob's answers as a list to pick from.
 *
 * The browser's own control, which means the list of answers is drawn by the
 * operating system above everything else on the screen. Twenty-seven colour
 * packs in a panel of our own would be a second scrolling surface hanging off
 * the first, and near the foot of a window it would open below the edge of it,
 * where the answers at the end cannot be reached.
 */
const Pick = ({ knob, chosen, onPick }: Control) => (
  <select
    aria-label={knob.label}
    value={chosen ?? knob.fallback}
    onChange={(event) => onPick(knob.key, event.target.value)}
    className={`max-w-40 shrink-0 truncate px-1.5 py-0.5 text-xs ${FIELD}`}
  >
    {knob.choices.map((choice) => (
      <option key={choice.value} value={choice.value}>
        {choice.label}
      </option>
    ))}
  </select>
)

/**
 * A knob with two answers, as one switch.
 *
 * On and off are the only pair drawn this way, and the schema settles which
 * knobs those are, so nothing here has to read a label to know which side of
 * the track means what.
 */
const Switch = ({ knob, chosen, onPick }: Control) => {
  const on = (chosen ?? knob.fallback) === "on"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={knob.label}
      onClick={() => onPick(knob.key, on ? "off" : "on")}
      className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
        on ? "bg-accent-emphasis" : "bg-line"
      }`}
    >
      <span
        className={`size-3 rounded-full bg-raised transition-transform ${
          on ? "translate-x-3" : ""
        }`}
      />
    </button>
  )
}

/**
 * A run of sizes as one handle, in the room this panel gives it.
 *
 * The handle itself is shared with the settings sheet, which frames it its own
 * way; a row here is narrow and already spent half of itself on the label.
 */
const Handle = ({ knob, chosen, onPick }: Control) => (
  <span className="flex w-32 shrink-0 items-center gap-2">
    <Slide knob={knob} held={chosen ?? knob.fallback} onPick={onPick} />
  </span>
)

/**
 * The control each kind of knob is given, by the name the schema calls it.
 *
 * A table rather than a run of questions in the row below: what a knob is drawn
 * as is decided once, where it is declared, and a kind added there is a line
 * added here rather than another branch in the middle of a component.
 */
const CONTROLS: Readonly<Record<AnyKnob["shape"], (control: Control) => ReactNode>> = {
  list: Pick,
  switch: Switch,
  slide: Handle
}

/** One knob: its glyph, its name, and the one control that changes it. */
const Row = ({ knob, chosen, onPick }: Control) => {
  const art = useArt()
  const Drawn = CONTROLS[knob.shape]
  const Mark = art[KNOB_ART[knob.key]]

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-ink hover:bg-hover">
      {/* The label says it; the glyph is the same thing drawn, for an eye going
          down the edge of thirty rows rather than reading them. Nothing said
          twice to a reader who is listening. */}
      <span aria-hidden className="flex w-4 shrink-0 justify-center text-ink-muted">
        <Mark size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate">{knob.label}</span>
      <Drawn knob={knob} chosen={chosen} onPick={onPick} />
    </div>
  )
}

const Group = ({
  knobs,
  chosen,
  onPick
}: {
  readonly knobs: ReadonlyArray<AnyKnob>
  readonly chosen: Record<string, string>
  readonly onPick: (key: string, value: string) => void
}) => (
  <>
    {knobs.map((knob) => (
      <Row key={knob.key} knob={knob} chosen={chosen[knob.key]} onPick={onPick} />
    ))}
  </>
)

/**
 * One named run of knobs.
 *
 * A group rather than a heading followed by loose rows, and named by that
 * heading, because two of these sections hold a knob whose label is the section
 * name — Appearance holds Appearance — and a bare heading leaves nothing to tell
 * the two apart. Anybody reading the panel by its structure, a screen reader or
 * a test, is told which run a row is in.
 */
const Section = ({
  name,
  children
}: {
  readonly name: string
  readonly children: ReactNode
}) => {
  const named = useId()

  return (
    <div role="group" aria-labelledby={named}>
      <p id={named} className="px-2 pt-1.5 pb-1 text-[11px] font-semibold text-ink-muted">
        {name}
      </p>
      {children}
    </div>
  )
}

/**
 * Everything the screens can be told to do, behind one button.
 *
 * Built from the schema rather than written out: a knob added there appears
 * here, in the right section, with its own control and its current value, and
 * there is no second list to forget to update.
 *
 * One panel, and every knob in it. Each knob used to be a submenu of its own,
 * which put a reader two hovers and a portal away from a value they can now see
 * and change where they found it — and the submenus opened to the side of a
 * panel that already reached the foot of the window. What is left is a form:
 * a list to pick from, a switch, or a handle to drag.
 *
 * The same sections the sheet in the bar opens on, in the same order, so
 * whichever one a reader learned first tells them where to look in the other.
 * Advanced knobs are at the end of the same panel rather than behind one more
 * click, since scrolling to them is cheaper than finding them.
 */
export const SettingsMenu = ({
  settings,
  onChange,
  label = "Display settings"
}: SettingsMenuProps) => {
  const art = useArt()
  const More = art.more
  const pickTheme = (key: string, value: string) =>
    onChange({ ...settings, theme: { ...settings.theme, [key]: value } })
  const pickDiff = (key: string, value: string) =>
    onChange({ ...settings, diff: { ...settings.diff, [key]: value } })
  const pickTree = (key: string, value: string) =>
    onChange({ ...settings, tree: { ...settings.tree, [key]: value } })

  return (
    <Panel.Root>
      <Panel.Trigger
        aria-label={label}
        className="flex shrink-0 items-center rounded-md px-1.5 py-1 text-ink-muted hover:bg-hover hover:text-ink"
      >
        <More size={16} />
      </Panel.Trigger>
      <Panel.Portal container={inOurs()}>
        {/* Never taller than the room between the button and the edge of the
            window, and scrolled inside that: eighteen rows and their sections
            are taller than a laptop's viewport, and a panel that runs off the
            bottom holds the last of the knobs somewhere nothing can reach. The
            height Radix measured arrives in that custom property. */}
        <Panel.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          aria-label={label}
          className={`t-dropdown z-50 max-h-[var(--radix-popover-content-available-height)] w-80 overflow-y-auto p-1 text-xs ${FLOAT}`}
        >
          <Section name="Appearance">
            <Group knobs={THEME_KNOBS} chosen={settings.theme} onPick={pickTheme} />
          </Section>
          <Section name="Diff">
            <Group
              knobs={DIFF_KNOBS.filter((knob) => !knob.advanced)}
              chosen={settings.diff}
              onPick={pickDiff}
            />
          </Section>
          <Section name="Files">
            <Group
              knobs={TREE_KNOBS.filter((knob) => !knob.advanced)}
              chosen={settings.tree}
              onPick={pickTree}
            />
          </Section>
          <Section name="Advanced diff">
            <Group
              knobs={DIFF_KNOBS.filter((knob) => knob.advanced)}
              chosen={settings.diff}
              onPick={pickDiff}
            />
          </Section>
          <Section name="Advanced files">
            <Group
              knobs={TREE_KNOBS.filter((knob) => knob.advanced)}
              chosen={settings.tree}
              onPick={pickTree}
            />
          </Section>
        </Panel.Content>
      </Panel.Portal>
    </Panel.Root>
  )
}
