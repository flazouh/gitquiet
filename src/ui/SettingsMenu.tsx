import * as Menu from "@radix-ui/react-dropdown-menu"
import { useId, useState, type ReactNode } from "react"
import { useArt } from "./art"
import { DIFF_KNOBS, THEME_KNOBS, TREE_KNOBS, type Knob, type Settings } from "../domain/Settings"
import { ROOT_ID } from "./mount"
import { Slide } from "./Slide"

/**
 * Where everything this menu opens is drawn.
 *
 * Inside our own root, because the theme is a set of inline custom properties on
 * that element and not on `<html>`: the rest of the document is GitHub's page,
 * and our names on their root would repaint their chrome. A panel portaled to
 * `document.body` instead reads the stylesheet's defaults, which are the light
 * pack — a white menu with near-black text over a dark page. See `outside.ts`,
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
   * the knobs are read about, and this menu above the diff. Two buttons on one
   * screen answering to the same name is two identical buttons to anybody
   * listening to the page rather than looking at it.
   */
  readonly label?: string
}

const ITEM =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink outline-none data-[highlighted]:bg-hover"

/**
 * Every surface this menu opens: the menu itself and each run of choices.
 *
 * One name for the three of them, the way `ITEM` is one name for every row. The
 * height is the room Radix measured between the trigger and the edge of the
 * window, which a menu needs now that each row is two lines tall: eighteen of
 * them are taller than a laptop's viewport, and a menu that runs off the bottom
 * hides the knobs at the end of it.
 */
const PANEL =
  "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-md border border-line bg-raised p-1 text-xs shadow-pop"

/**
 * One knob: its name, what it is for, and what it is set to.
 *
 * The gist is on the row rather than behind an information icon. Every one of
 * these knobs is a trade, and a two-word label can only name it; a bubble said
 * the whole of it, but only to a reader who knew to go looking for a bubble,
 * and it cost a tooltip on every one of twenty-two rows. The whole explanation
 * and the little mockups are in the settings sheet, where there is room to
 * read them.
 */
const Row = ({
  knob,
  chosen,
  onPick
}: {
  readonly knob: Knob<string, string>
  readonly chosen: string | undefined
  readonly onPick: (key: string, value: string) => void
}) => {
  const [wanted, setWanted] = useState(false)

  return (
    <Menu.Sub open={wanted} onOpenChange={setWanted}>
      {/* Opened on the pointer arriving rather than on Radix's
          hundred-millisecond hesitation: this is a settled menu of knobs, not a
          navigation bar where a passing cursor should be ignored, and the
          hesitation reads as the menu being slow.

          On arriving, once, and not on every move across the row: a pointer
          crossing a row sends a move event a frame, and each one asked React
          for a render it then threw away. */}
      <Menu.SubTrigger className={ITEM} onPointerEnter={() => setWanted(true)}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span>{knob.label}</span>
          <span className="text-[11px] leading-tight text-ink-muted">{knob.gist}</span>
        </span>
        <span className="shrink-0 text-ink-muted">
          {knob.choices.find((choice) => choice.value === chosen)?.label}
        </span>
      </Menu.SubTrigger>
      <Menu.Portal container={inOurs()}>
        {/* No `t-dropdown`: the choices follow the pointer down a menu that is
            already open, and an entrance replayed on every row reads as each
            submenu being slow. Unanimated they simply are there — and are gone
            the moment the pointer leaves, since Radix only holds an exiting
            surface mounted while it has an animation to wait for. */}
        <Menu.SubContent
          sideOffset={4}
          className={`${PANEL} min-w-40`}
        >
          {knob.slide ? (
            /* Not a menu item: a handle is dragged, and Radix treats a press on
               an item as the choice being made and shuts the menu under it. The
               stopped press is what keeps the drag from closing the menu on its
               way down. */
            <div
              className="flex items-center gap-2 px-2 py-1.5"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <Slide knob={knob} held={chosen ?? knob.fallback} onPick={onPick} />
            </div>
          ) : (
          <Menu.RadioGroup value={chosen} onValueChange={(value) => onPick(knob.key, value)}>
            {knob.choices.map((choice) => (
              <Menu.RadioItem key={choice.value} value={choice.value} className={ITEM}>
                {/* The tick has a column of its own: labels that shift right
                    when chosen are labels the eye has to find again. */}
                <span className="w-3 text-ink-muted">
                  <Menu.ItemIndicator>✓</Menu.ItemIndicator>
                </span>
                {choice.label}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
          )}
        </Menu.SubContent>
      </Menu.Portal>
    </Menu.Sub>
  )
}

const Group = ({
  knobs,
  chosen,
  onPick
}: {
  readonly knobs: ReadonlyArray<Knob<string, string>>
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
 * the two apart. Anybody reading the menu by its structure, a screen reader or a
 * test, is told which run a row is in.
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
    <Menu.Group aria-labelledby={named}>
      <Menu.Label
        id={named}
        className="px-2 pt-1.5 pb-1 text-[11px] font-semibold text-ink-muted"
      >
        {name}
      </Menu.Label>
      {children}
    </Menu.Group>
  )
}

/**
 * Everything the screens can be told to do, behind one button.
 *
 * Built from the schema rather than written out: a knob added there appears
 * here, in the right section, with its choices and its current value, and there
 * is no second list to forget to update. Each knob is a submenu because the
 * alternative — every choice of every knob in one column — is forty rows deep
 * and unreadable, and because a submenu shows what is currently chosen on the
 * row itself, which is the thing being looked for most of the time.
 *
 * The same three sections the sheet in the bar opens on, in the same order, so
 * whichever one a reader learned first tells them where to look in the other.
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
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        className="flex shrink-0 items-center rounded-md px-1.5 py-1 text-ink-muted hover:bg-hover hover:text-ink"
      >
        <More size={16} />
      </Menu.Trigger>
      <Menu.Portal container={inOurs()}>
        <Menu.Content
          align="end"
          sideOffset={4}
          className={`t-dropdown ${PANEL} min-w-72`}
        >
          {/* First, and whole: three knobs, none of them advanced, and the
              one section here that is about the product rather than about
              this screen. */}
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
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Sub>
            <Menu.SubTrigger className={ITEM}>
              <span className="flex-1">Advanced</span>
              <span className="text-ink-muted">›</span>
            </Menu.SubTrigger>
            <Menu.Portal container={inOurs()}>
              {/* Unanimated like the rows' own submenus, and for the same
                  reason. */}
              <Menu.SubContent
                sideOffset={4}
                className={`${PANEL} min-w-72`}
              >
                <Section name="Diff">
                  <Group
                    knobs={DIFF_KNOBS.filter((knob) => knob.advanced)}
                    chosen={settings.diff}
                    onPick={pickDiff}
                  />
                </Section>
                <Section name="Files">
                  <Group
                    knobs={TREE_KNOBS.filter((knob) => knob.advanced)}
                    chosen={settings.tree}
                    onPick={pickTree}
                  />
                </Section>
              </Menu.SubContent>
            </Menu.Portal>
          </Menu.Sub>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
